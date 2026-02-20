import { useEffect, useMemo, useState } from "react"
import { ArrowUp, Plus, Smile } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CHAT_PROMPT_PLACEHOLDERS } from "@/features/chat/data/chat-prompts"
import { cn } from "@/lib/utils"

interface ChatComposerProps {
  draft: string
  disabled?: boolean
  hasSentMessage: boolean
  onDraftChange: (value: string) => void
  onSend: () => void
}

export function ChatComposer({
  draft,
  disabled = false,
  hasSentMessage,
  onDraftChange,
  onSend,
}: ChatComposerProps) {
  const canSend = draft.trim().length > 0 && !disabled
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const promptPlaceholders = useMemo(() => CHAT_PROMPT_PLACEHOLDERS, [])
  const isDraftEmpty = draft.trim().length === 0
  const shouldShowRotatorPlaceholder = hasSentMessage && isDraftEmpty
  const shouldRotatePlaceholders = shouldShowRotatorPlaceholder

  useEffect(() => {
    if (!shouldRotatePlaceholders || promptPlaceholders.length <= 1) {
      return
    }

    const intervalId = window.setInterval(() => {
      setPlaceholderIndex((previous) =>
        previous < promptPlaceholders.length - 1 ? previous + 1 : 0
      )
    }, 2800)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [promptPlaceholders, shouldRotatePlaceholders])

  const placeholderText = shouldShowRotatorPlaceholder
    ? promptPlaceholders[placeholderIndex] ?? "Ask anything"
    : "Ask anything"

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
          placeholder={shouldShowRotatorPlaceholder ? "" : placeholderText}
          className="h-12 rounded-full border-0 bg-neutral-200/80 pl-5 pr-12 text-[1.05rem] shadow-none focus-visible:ring-0"
        />
        {shouldShowRotatorPlaceholder ? (
          <div className="pointer-events-none absolute inset-y-0 left-5 right-12 flex items-center overflow-hidden text-[1.05rem] text-neutral-500 md:text-sm">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={placeholderText}
                initial={{ opacity: 0, rotateX: 70, y: 6, filter: "blur(2px)" }}
                animate={{ opacity: 1, rotateX: 0, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, rotateX: -70, y: -6, filter: "blur(2px)" }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="block truncate [transform-style:preserve-3d]"
              >
                {placeholderText}
              </motion.span>
            </AnimatePresence>
          </div>
        ) : null}
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
