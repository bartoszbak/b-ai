import { useEffect, useLayoutEffect, useRef } from "react"
import Lenis from "lenis"
import { AnimatePresence, motion } from "motion/react"

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
  showResponseIconsOnHover: boolean
  moveBubblesOnIncomingMessage: boolean
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
  showResponseIconsOnHover,
  moveBubblesOnIncomingMessage,
  onDraftChange,
  onSend,
  onRedoAssistantMessage,
  onUseStarterPrompt,
}: ChatPhoneProps) {
  const endRef = useRef<HTMLDivElement | null>(null)
  const scrollWrapperRef = useRef<HTMLDivElement | null>(null)
  const scrollContentRef = useRef<HTMLDivElement | null>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const hasSentMessage = messages.some((message) => message.role !== "assistant")
  const assistantMessageCount = messages.filter(
    (message) => message.role === "assistant"
  ).length
  const canRedo = (index: number) => {
    for (let pointer = index - 1; pointer >= 0; pointer -= 1) {
      if (messages[pointer].role === "user") {
        return true
      }
    }
    return false
  }

  useEffect(() => {
    const wrapper = scrollWrapperRef.current
    const content = scrollContentRef.current
    if (!wrapper || !content) {
      return
    }

    const lenis = new Lenis({
      wrapper,
      content,
      autoRaf: true,
      smoothWheel: true,
      syncTouch: true,
      lerp: 0.14,
    })

    lenisRef.current = lenis

    return () => {
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (lenisRef.current && endRef.current) {
        lenisRef.current.resize()
        lenisRef.current.scrollTo(endRef.current, {
          duration: 0.55,
          easing: (t) => 1 - Math.pow(1 - t, 3),
          force: true,
        })
        return
      }

      endRef.current?.scrollIntoView({
        behavior: "smooth",
      })
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [messages, isTyping, showStatusIndicator, activeStreamMessageId])

  useEffect(() => {
    if (lenisRef.current && endRef.current) {
      lenisRef.current.resize()
    }
  }, [])

  return (
    <motion.div
      className="phone-frame relative mx-auto flex h-full max-h-[740px] w-full max-w-[640px] flex-col overflow-hidden border-[1px]"
    >
      <div className="flex h-full min-h-0 flex-col bg-linear-to-b from-slate-50">
        <Separator />

        <div
          ref={scrollWrapperRef}
          className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-6 pt-0 pb-0"
        >
          <motion.div
            ref={scrollContentRef}
            layout={moveBubblesOnIncomingMessage}
            transition={{
              layout: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
            }}
            className="space-y-3 pb-3 pt-6"
          >
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
                  animateLayoutShift={moveBubblesOnIncomingMessage}
                  showActionsOnHover={showResponseIconsOnHover}
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
          </motion.div>
        </div>

        <div className="bg-white/70 px-6 py-6">
          <ChatComposer
            draft={draft}
            disabled={isTyping}
            hasSentMessage={hasSentMessage}
            assistantMessageCount={assistantMessageCount}
            onDraftChange={onDraftChange}
            onSend={onSend}
          />
        </div>
      </div>
    </motion.div>
  )
}
