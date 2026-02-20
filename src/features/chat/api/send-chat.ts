import type { ChatMessage, ChatSettings } from "@/features/chat/types"

interface ChatUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ChatApiResponse {
  text: string
  usage?: ChatUsage
}

interface StreamEventChunk {
  type: "chunk"
  text: string
}

interface StreamEventUsage {
  type: "usage"
  usage: ChatUsage
}

interface StreamEventDone {
  type: "done"
}

interface StreamEventError {
  type: "error"
  error: string
}

type StreamEvent =
  | StreamEventChunk
  | StreamEventUsage
  | StreamEventDone
  | StreamEventError

export async function streamChatRequest(
  messages: ChatMessage[],
  settings: ChatSettings,
  onChunk: (chunk: string) => void
): Promise<ChatApiResponse> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 60_000)

  let response: Response
  try {
    response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        messages: messages.map((message) => ({
          role: message.role,
          text: message.text,
        })),
        settings,
      }),
    })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "Request timed out after 60s. Try again or choose a faster model."
      )
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }

  if (!response.ok) {
    const rawText = await response.text()
    let errorMessage = `API error ${response.status}`

    try {
      const data = JSON.parse(rawText) as { error?: string }
      if (typeof data.error === "string" && data.error.trim().length > 0) {
        errorMessage = data.error
      }
    } catch {
      if (rawText.trim().length > 0) {
        errorMessage = `${errorMessage}: ${rawText.slice(0, 180)}`
      }
    }

    throw new Error(errorMessage)
  }

  if (!response.body) {
    throw new Error("API did not return a stream body.")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let text = ""
  let usage: ChatUsage | undefined

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
      if (!payloadText) {
        continue
      }

      let event: StreamEvent | null = null
      try {
        event = JSON.parse(payloadText) as StreamEvent
      } catch {
        event = null
      }

      if (!event) {
        continue
      }

      if (event.type === "chunk") {
        text += event.text
        onChunk(event.text)
      } else if (event.type === "usage") {
        usage = event.usage
      } else if (event.type === "error") {
        throw new Error(event.error || "Streaming request failed.")
      }
    }
  }

  if (!text.trim()) {
    throw new Error("API returned an empty streamed response.")
  }

  return { text, usage }
}
