import {
  getInvalidJsonResponse,
  getMethodNotAllowedResponse,
  getMissingKeyResponse,
  getOpenRouterHeaders,
  getOpenRouterRequestPayload,
  json,
} from "./lib/openrouter.js"

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
  const timeoutId = setTimeout(() => controller.abort(), 45_000)

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: getOpenRouterHeaders(),
      body: JSON.stringify({
        model,
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

    const rawText = await response.text()
    let data = null
    try {
      data = rawText ? JSON.parse(rawText) : null
    } catch {
      data = null
    }

    if (!response.ok) {
      const errorMessage =
        typeof data?.error?.message === "string"
          ? data.error.message
          : `OpenRouter request failed with status ${response.status}.`
      return json({ error: errorMessage }, { status: response.status })
    }

    const rawContent = data?.choices?.[0]?.message?.content
    const text =
      typeof rawContent === "string"
        ? rawContent.trim()
        : Array.isArray(rawContent)
          ? rawContent
              .map((part) =>
                typeof part?.text === "string" ? part.text : ""
              )
              .join("\n")
              .trim()
          : ""

    if (!text) {
      return json(
        {
          error: "OpenRouter returned an empty response.",
        },
        { status: 502 }
      )
    }

    const promptTokens = Number(data?.usage?.prompt_tokens ?? 0)
    const completionTokens = Number(data?.usage?.completion_tokens ?? 0)
    const totalTokens = Number(data?.usage?.total_tokens ?? 0)
    const usage =
      Number.isFinite(promptTokens) &&
      Number.isFinite(completionTokens) &&
      Number.isFinite(totalTokens) &&
      totalTokens > 0
        ? {
            promptTokens,
            completionTokens,
            totalTokens,
          }
        : undefined

    return json({ text, usage })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return json(
        {
          error: "OpenRouter timed out after 45s. Try again or switch models.",
        },
        { status: 504 }
      )
    }

    const message =
      error instanceof Error ? error.message : "Failed to call OpenRouter API."
    return json({ error: message }, { status: 500 })
  } finally {
    clearTimeout(timeoutId)
  }
}
