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

export interface StarterPrompt {
  id: string
  label: string
  icon: LucideIcon
}

export const starterPrompts: StarterPrompt[] = [
  { id: "schedule", label: "Schedule a reminder", icon: Clock3 },
  { id: "summarize", label: "Summarize it", icon: List },
  { id: "picture", label: "Tell me what’s on that picture", icon: Image },
  { id: "math", label: "What is 7% of 50", icon: Percent },
  { id: "dinner", label: "What should I eat for dinner", icon: Utensils },
  { id: "birthday", label: "Generate a birthday card for", icon: Cake },
  { id: "search", label: "Search web for", icon: Globe },
  { id: "tone", label: "Make this sound professional", icon: Flame },
  { id: "eli5", label: "Explain this like I’m 5", icon: Square },
  { id: "trip", label: "Plan a trip to ...", icon: Plane },
]
