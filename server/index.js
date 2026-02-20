import "dotenv/config"
import express from "express"

const app = express()
const port = Number(process.env.PORT || 8787)

app.use(express.json({ limit: "1mb" }))

app.get("/api/health", (_req, res) => {
  res.json({ ok: true })
})

app.post("/api/chat", async (req, res) => {
  const { messages = [], settings = {} } = req.body ?? {}

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({
      error: "OPENROUTER_API_KEY is not set in your environment.",
    })
  }

  const apiMessages = Array.isArray(messages)
    ? messages
        .filter(
          (message) =>
            (message?.role === "assistant" || message?.role === "user") &&
            typeof message?.text === "string"
        )
        .slice(-20)
    : []

  const model =
    typeof settings.model === "string"
      ? settings.model
      : "openai/gpt-4.1-nano"
  const systemPrompt =
    typeof settings.persona === "string" && settings.persona.trim().length > 0
      ? `You are ${settings.persona.trim()}. Keep responses grounded and directly useful.`
      : "You are a helpful AI assistant."

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 45_000)

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          ...(process.env.OPENROUTER_HTTP_REFERER
            ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER }
            : {}),
          ...(process.env.OPENROUTER_X_TITLE
            ? { "X-Title": process.env.OPENROUTER_X_TITLE }
            : {}),
        },
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
      }
    )

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
      return res.status(response.status).json({ error: errorMessage })
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
      return res.status(502).json({
        error: "OpenRouter returned an empty response.",
      })
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

    return res.json({ text, usage })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return res.status(504).json({
        error: "OpenRouter timed out after 45s. Try again or switch models.",
      })
    }

    const message =
      error instanceof Error ? error.message : "Failed to call OpenRouter API."
    return res.status(500).json({ error: message })
  } finally {
    clearTimeout(timeoutId)
  }
})

app.post("/api/chat/stream", async (req, res) => {
  const { messages = [], settings = {} } = req.body ?? {}

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({
      error: "OPENROUTER_API_KEY is not set in your environment.",
    })
  }

  const apiMessages = Array.isArray(messages)
    ? messages
        .filter(
          (message) =>
            (message?.role === "assistant" || message?.role === "user") &&
            typeof message?.text === "string"
        )
        .slice(-20)
    : []

  const model =
    typeof settings.model === "string"
      ? settings.model
      : "openai/gpt-4.1-nano"
  const systemPrompt =
    typeof settings.persona === "string" && settings.persona.trim().length > 0
      ? `You are ${settings.persona.trim()}. Keep responses grounded and directly useful.`
      : "You are a helpful AI assistant."

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60_000)
  const abortOnClientClose = () => controller.abort()
  res.on("close", abortOnClientClose)

  const writeEvent = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
  }

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          ...(process.env.OPENROUTER_HTTP_REFERER
            ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER }
            : {}),
          ...(process.env.OPENROUTER_X_TITLE
            ? { "X-Title": process.env.OPENROUTER_X_TITLE }
            : {}),
        },
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
      }
    )

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
      return res.status(response.status).json({ error: errorMessage })
    }

    if (!response.body) {
      return res.status(502).json({ error: "OpenRouter stream is unavailable." })
    }

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache, no-transform")
    res.setHeader("Connection", "keep-alive")
    res.setHeader("X-Accel-Buffering", "no")
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders()
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let usage

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
          writeEvent({ type: "chunk", text: deltaContent })
        } else if (Array.isArray(deltaContent)) {
          const text = deltaContent
            .map((part) => (typeof part?.text === "string" ? part.text : ""))
            .join("")
          if (text.length > 0) {
            writeEvent({ type: "chunk", text })
          }
        }
      }
    }

    if (usage) {
      writeEvent({ type: "usage", usage })
    }
    writeEvent({ type: "done" })
    return res.end()
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "OpenRouter timed out after 60s. Try again or switch models."
        : error instanceof Error
          ? error.message
          : "Failed to call OpenRouter API."

    if (!res.headersSent) {
      return res.status(500).json({ error: message })
    }

    writeEvent({ type: "error", error: message })
    return res.end()
  } finally {
    res.off("close", abortOnClientClose)
    clearTimeout(timeoutId)
  }
})

app.listen(port, () => {
  console.log(`API server ready at http://localhost:${port}`)
})
