function json(data, init = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  })
}

export function getOpenRouterHeaders() {
  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    ...(process.env.OPENROUTER_HTTP_REFERER
      ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER }
      : {}),
    ...(process.env.OPENROUTER_X_TITLE
      ? { "X-Title": process.env.OPENROUTER_X_TITLE }
      : {}),
  }
}

export function getOpenRouterRequestPayload(body) {
  const { messages = [], settings = {} } = body ?? {}

  const apiMessages = Array.isArray(messages)
    ? messages
        .filter(
          (message) =>
            (message?.role === "assistant" ||
              message?.role === "user" ||
              message?.role === "other") &&
            typeof message?.text === "string"
        )
        .map((message) => ({
          ...message,
          role: message.role === "other" ? "user" : message.role,
        }))
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

  return {
    apiMessages,
    settings,
    model,
    systemPrompt,
  }
}

export function getMissingKeyResponse() {
  return json(
    {
      error: "OPENROUTER_API_KEY is not set in your environment.",
    },
    { status: 500 }
  )
}

export function getMethodNotAllowedResponse(methods) {
  return json(
    {
      error: "Method not allowed.",
    },
    {
      status: 405,
      headers: {
        Allow: methods.join(", "),
      },
    }
  )
}

export function getInvalidJsonResponse() {
  return json(
    {
      error: "Invalid JSON body.",
    },
    { status: 400 }
  )
}

export { json }
