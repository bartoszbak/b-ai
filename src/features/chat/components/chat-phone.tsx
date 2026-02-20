import { useEffect, useRef } from "react"
import { AnimatePresence, motion } from "motion/react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ChatBubble } from "@/features/chat/components/chat-bubble"
import { ChatComposer } from "@/features/chat/components/chat-composer"
import { ChatStarterPrompts } from "@/features/chat/components/chat-starter-prompts"
import { TypingStatus } from "@/features/chat/components/typing-status"
import type { ChatMessage } from "@/features/chat/types"

interface ChatPhoneProps {
  messages: ChatMessage[]
  draft: string
  isTyping: boolean
  showStatusIndicator: boolean
  activeStreamMessageId: string | null
  activeModel: string
  onDraftChange: (value: string) => void
  onSend: () => void
  onRedoAssistantMessage: (assistantMessageId: string) => void
  onUseStarterPrompt: (prompt: string) => void
}

export function ChatPhone({
  messages,
  draft,
  isTyping,
  showStatusIndicator,
  activeStreamMessageId,
  activeModel,
  onDraftChange,
  onSend,
  onRedoAssistantMessage,
  onUseStarterPrompt,
}: ChatPhoneProps) {
  const endRef = useRef<HTMLDivElement | null>(null)
  const canRedo = (index: number) => {
    for (let pointer = index - 1; pointer >= 0; pointer -= 1) {
      if (messages[pointer].role === "user") {
        return true
      }
    }
    return false
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: isTyping || showStatusIndicator ? "auto" : "smooth",
    })
  }, [messages, isTyping, showStatusIndicator, activeStreamMessageId])

  return (
    <motion.div
      layout
      className="phone-frame mx-auto flex h-full max-h-[740px] w-full max-w-[640px] flex-col overflow-hidden border-[1px]"
    >
      <div className="flex h-full min-h-0 flex-col bg-linear-to-b from-slate-50">
        <Separator />

        <ScrollArea className="min-h-0 flex-1 px-6 py-6 pt-0 pb-0">
          <div className="space-y-3 pb-3 pt-6">
            <AnimatePresence initial={false}>
              <ChatStarterPrompts
                model={activeModel}
                onPromptSelect={onUseStarterPrompt}
              />
              {messages.map((message, index) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  isStreaming={message.id === activeStreamMessageId}
                  isBusy={isTyping}
                  onRedo={
                    message.role === "assistant" && canRedo(index)
                      ? onRedoAssistantMessage
                      : undefined
                  }
                />
              ))}
              {showStatusIndicator ? <TypingStatus /> : null}
            </AnimatePresence>
            <div ref={endRef} />
          </div>
        </ScrollArea>

        <div className="bg-white/70 px-6 py-6">
          <ChatComposer
            draft={draft}
            disabled={isTyping}
            onDraftChange={onDraftChange}
            onSend={onSend}
          />
        </div>
      </div>
    </motion.div>
  )
}
