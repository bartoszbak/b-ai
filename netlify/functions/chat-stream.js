import {
  getInvalidJsonResponse,
  getMethodNotAllowedResponse,
  getMissingKeyResponse,
  getOpenRouterHeaders,
  getOpenRouterRequestPayload,
  json,
} from "./lib/openrouter.js"

function createSseResponse(stream) {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

function encodeEvent(payload) {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return getMethodNotAllowedResponse(["POST"])
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return getMissingKeyResponse()
  }

  let body = null
  try {
    body = await request.json()
  } catch {
    return getInvalidJsonResponse()
  }

  const { apiMessages, settings, model, systemPrompt } =
    getOpenRouterRequestPayload(body)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60_000)

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: getOpenRouterHeaders(),
      body: JSON.stringify({
        model,
        stream: true,
        stream_options: { include_usage: true },
        temperature:
          typeof settings.temperature === "number" ? settings.temperature : 0.6,
        max_tokens: settings.conciseMode ? 220 : 500,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          ...apiMessages.map((message) => ({
            role: message.role,
            content: message.text,
          })),
        ],
      }),
    })

    if (!response.ok) {
      const rawText = await response.text()
      let errorMessage = `OpenRouter request failed with status ${response.status}.`
      try {
        const data = rawText ? JSON.parse(rawText) : null
        if (typeof data?.error?.message === "string") {
          errorMessage = data.error.message
        }
      } catch {
        if (rawText.trim().length > 0) {
          errorMessage = rawText.slice(0, 200)
        }
      }
      return json({ error: errorMessage }, { status: response.status })
    }

    if (!response.body) {
      return json({ error: "OpenRouter stream is unavailable." }, { status: 502 })
    }

    const stream = new ReadableStream({
      async start(controllerStream) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let usage

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              break
            }

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() ?? ""

            for (const rawLine of lines) {
              const line = rawLine.trim()
              if (!line.startsWith("data:")) {
                continue
              }

              const payloadText = line.slice(5).trim()
              if (!payloadText || payloadText === "[DONE]") {
                continue
              }

              let payload = null
              try {
                payload = JSON.parse(payloadText)
              } catch {
                payload = null
              }

              if (!payload) {
                continue
              }

              if (payload?.usage) {
                const promptTokens = Number(payload.usage.prompt_tokens ?? 0)
                const completionTokens = Number(payload.usage.completion_tokens ?? 0)
                const totalTokens = Number(payload.usage.total_tokens ?? 0)
                if (
                  Number.isFinite(promptTokens) &&
                  Number.isFinite(completionTokens) &&
                  Number.isFinite(totalTokens) &&
                  totalTokens > 0
                ) {
                  usage = {
                    promptTokens,
                    completionTokens,
                    totalTokens,
                  }
                }
              }

              const deltaContent = payload?.choices?.[0]?.delta?.content
              if (typeof deltaContent === "string" && deltaContent.length > 0) {
                controllerStream.enqueue(
                  encodeEvent({ type: "chunk", text: deltaContent })
                )
              } else if (Array.isArray(deltaContent)) {
                const text = deltaContent
                  .map((part) =>
                    typeof part?.text === "string" ? part.text : ""
                  )
                  .join("")
                if (text.length > 0) {
                  controllerStream.enqueue(encodeEvent({ type: "chunk", text }))
                }
              }
            }
          }

          if (usage) {
            controllerStream.enqueue(encodeEvent({ type: "usage", usage }))
          }
          controllerStream.enqueue(encodeEvent({ type: "done" }))
          controllerStream.close()
        } catch (error) {
          const message =
            error instanceof Error && error.name === "AbortError"
              ? "OpenRouter timed out after 60s. Try again or switch models."
              : error instanceof Error
                ? error.message
                : "Failed to call OpenRouter API."
          controllerStream.enqueue(encodeEvent({ type: "error", error: message }))
          controllerStream.close()
        } finally {
          clearTimeout(timeoutId)
          reader.releaseLock()
        }
      },
      cancel() {
        controller.abort()
        clearTimeout(timeoutId)
      },
    })

    return createSseResponse(stream)
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === "AbortError") {
      return json(
        {
          error: "OpenRouter timed out after 60s. Try again or switch models.",
        },
        { status: 504 }
      )
    }

    const message =
      error instanceof Error ? error.message : "Failed to call OpenRouter API."
    return json({ error: message }, { status: 500 })
  }
}
