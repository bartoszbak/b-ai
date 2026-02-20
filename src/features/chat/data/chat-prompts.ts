import type { LucideIcon } from "lucide-react"
import {
  Cake,
  Clock3,
  Flame,
  Globe,
  Image,
  List,
  Percent,
  Plane,
  Square,
  Utensils,
} from "lucide-react"

export interface ChatPromptDefinition {
  id: string
  prompt: string
  icon: LucideIcon
}

export const CHAT_PROMPTS: ChatPromptDefinition[] = [
  { id: "schedule", prompt: "Schedule a reminder", icon: Clock3 },
  { id: "summarize", prompt: "Summarize it", icon: List },
  { id: "picture", prompt: "Tell me what’s on that picture", icon: Image },
  { id: "math", prompt: "What is 7% of 50", icon: Percent },
  { id: "dinner", prompt: "What should I eat for dinner", icon: Utensils },
  { id: "birthday", prompt: "Generate a birthday card for", icon: Cake },
  { id: "search", prompt: "Search web for", icon: Globe },
  { id: "tone", prompt: "Make this sound professional", icon: Flame },
  { id: "eli5", prompt: "Explain this like I’m 5", icon: Square },
  { id: "trip", prompt: "Plan a trip to ...", icon: Plane },
]

export const CHAT_PROMPT_PLACEHOLDERS = CHAT_PROMPTS.map(
  (item) => item.prompt
)
