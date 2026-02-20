import type { ChatSettings } from "@/features/chat/types"

const responseFragments = [
  "That is an interesting prompt.",
  "I can help you break this down.",
  "Here is a clean way to think about it.",
  "This is a strong direction to continue with.",
]

export function createAssistantReply(
  userText: string,
  settings: ChatSettings
): string {
  const cleaned = userText.trim()
  const prefix =
    settings.persona.trim().length > 0
      ? `${settings.persona.trim()}: `
      : "Assistant: "

  const base =
    responseFragments[Math.floor(Math.random() * responseFragments.length)]
  const modelNote = `(${settings.model}, temp ${settings.temperature.toFixed(1)})`

  if (settings.conciseMode) {
    return `${prefix}${base} ${modelNote}`
  }

  return `${prefix}${base} You said "${cleaned}". I can expand this into a step-by-step answer when you are ready. ${modelNote}`
}
