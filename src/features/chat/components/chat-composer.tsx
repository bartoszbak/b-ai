import { ArrowUp, Plus, Smile } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface ChatComposerProps {
  draft: string
  disabled?: boolean
  onDraftChange: (value: string) => void
  onSend: () => void
}

export function ChatComposer({
  draft,
  disabled = false,
  onDraftChange,
  onSend,
}: ChatComposerProps) {
  const canSend = draft.trim().length > 0 && !disabled

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSend()
      }}
      className="flex items-center gap-2.5"
    >
      <Button
        type="button"
        size="icon"
        disabled={disabled}
        variant="secondary"
        className="size-12 rounded-full border-0 bg-neutral-200 text-neutral-600 hover:bg-neutral-300 disabled:opacity-100"
      >
        <Plus className="size-6" />
        <span className="sr-only">Add attachment</span>
      </Button>

      <div className="relative flex-1">
        <Input
          value={draft}
          disabled={disabled}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Type your message..."
          className="h-12 rounded-full border-0 bg-neutral-200/80 pl-5 pr-12 text-[1.05rem] shadow-none focus-visible:ring-0"
        />
        <Smile className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-neutral-500" />
      </div>

      <Button
        type="submit"
        size="icon"
        disabled={!canSend}
        className={cn(
          "size-12 rounded-full border-0 text-white shadow-none disabled:opacity-100",
          canSend
            ? "bg-blue-600 hover:bg-blue-700"
            : "bg-neutral-300 hover:bg-neutral-300"
        )}
      >
        <ArrowUp className="size-6" />
        <span className="sr-only">Send</span>
      </Button>
    </form>
  )
}
