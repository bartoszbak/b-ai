export type ChatRole = "assistant" | "user" | "other"

export interface ChatMessageMeta {
  model?: ChatSettings["model"]
  temperature?: number
  source?: "live" | "mock"
  durationMs?: number
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface ChatMessage {
  id: string
  role: ChatRole
  text: string
  createdAt: number
  meta?: ChatMessageMeta
}

export interface ChatSettings {
  model:
    | "deepseek/deepseek-r1-0528:free"
    | "openai/gpt-4.1-nano"
    | "openai/gpt-4.1-mini"
    | "openai/gpt-4.1"
    | "openai/o4-mini"
  temperature: number
  autoReply: boolean
  useOpenRouter: boolean
  showProcessingIndicator: boolean
  showResponseIconsOnHover: boolean
  moveBubblesOnIncomingMessage: boolean
  sendAsOtherPerson: boolean
  conciseMode: boolean
  persona: string
}
