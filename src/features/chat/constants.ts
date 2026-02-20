export const TYPING_STATES = [
  "Thinking...",
  "Processing...",
  "Typing...",
] as const

export const TYPING_STATE_MS = 900
export const TYPING_MIN_DURATION_MS = TYPING_STATES.length * TYPING_STATE_MS
