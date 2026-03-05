import { useEffect, useRef, useState } from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { Button } from "@/components/ui/button"
import { streamChatRequest } from "@/features/chat/api/send-chat"
import { TYPING_MIN_DURATION_MS } from "@/features/chat/constants"
import { starterMessages } from "@/features/chat/data/starter-messages"
import { ChatPhone } from "@/features/chat/components/chat-phone"
import type { ChatMessage, ChatMessageMeta, ChatSettings } from "@/features/chat/types"
import { createAssistantReply } from "@/features/chat/utils/create-assistant-reply"
import { SettingsPanel } from "@/features/settings/components/settings-panel"
import { cn } from "@/lib/utils"

const initialSettings: ChatSettings = {
  model: "openai/gpt-4.1-nano",
  temperature: 0.6,
  autoReply: true,
  useOpenRouter: true,
  showProcessingIndicator: true,
  showResponseIconsOnHover: false,
  moveBubblesOnIncomingMessage: false,
  sendAsOtherPerson: false,
  conciseMode: false,
  persona: "Helpful AI",
}

interface UsageStats {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  avgResponseMs: number
  lastResponseMs: number | null
  responses: number
  errorCount: number
}

const initialUsageStats: UsageStats = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  avgResponseMs: 0,
  lastResponseMs: null,
  responses: 0,
  errorCount: 0,
}

interface BuildAssistantReplyParams {
  conversation: ChatMessage[]
  promptText: string
  currentSettings: ChatSettings
  assistantMessageId: string
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4))
}

function isDesktopViewport() {
  if (typeof window === "undefined") {
    return true
  }

  return window.matchMedia("(min-width: 768px)").matches
}

function App() {
  const [settings, setSettings] = useState<ChatSettings>(initialSettings)
  const [messages, setMessages] = useState(starterMessages)
  const [draft, setDraft] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [showStatusIndicator, setShowStatusIndicator] = useState(false)
  const [activeStreamMessageId, setActiveStreamMessageId] = useState<string | null>(
    null
  )
  const [isDesktopLayout, setIsDesktopLayout] = useState(isDesktopViewport)
  const [showSettingsPanel, setShowSettingsPanel] = useState(isDesktopViewport)
  const [lastError, setLastError] = useState<string | null>(null)
  const [usageStats, setUsageStats] = useState<UsageStats>(initialUsageStats)
  const timeoutIds = useRef<number[]>([])

  useEffect(() => {
    return () => {
      timeoutIds.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
      timeoutIds.current = []
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const mediaQuery = window.matchMedia("(min-width: 768px)")
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktopLayout(event.matches)
      if (!event.matches) {
        setShowSettingsPanel(false)
      }
    }

    setIsDesktopLayout(mediaQuery.matches)
    mediaQuery.addEventListener("change", handleChange)
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  const upsertAssistantMessage = (
    assistantMessageId: string,
    updater: (previous?: ChatMessage) => ChatMessage
  ) => {
    setMessages((previousMessages) => {
      const existingIndex = previousMessages.findIndex(
        (message) => message.id === assistantMessageId
      )

      if (existingIndex === -1) {
        return [...previousMessages, updater(undefined)]
      }

      const nextMessages = [...previousMessages]
      nextMessages[existingIndex] = updater(previousMessages[existingIndex])
      return nextMessages
    })
  }

  const wait = (durationMs: number) =>
    new Promise<void>((resolve) => {
      const timeoutId = window.setTimeout(resolve, durationMs)
      timeoutIds.current.push(timeoutId)
    })

  const buildAssistantReply = async ({
    conversation,
    promptText,
    currentSettings,
    assistantMessageId,
  }: BuildAssistantReplyParams) => {
    const shouldShowIndicator = currentSettings.showProcessingIndicator
    setIsTyping(true)
    setShowStatusIndicator(shouldShowIndicator)
    setLastError(null)

    const requestStartedAt = performance.now()
    const responseCreatedAt = Date.now()
    const baseMeta: ChatMessageMeta = {
      model: currentSettings.model,
      temperature: currentSettings.temperature,
    }
    let stopLivePlayback: (() => void) | null = null

    try {
      let assistantText = ""
      let promptTokens = estimateTokens(promptText)
      let completionTokens = 0
      let source: ChatMessageMeta["source"] = "mock"

      if (currentSettings.useOpenRouter) {
        source = "live"
        let canRenderChunks = false
        let streamFinished = false
        let renderedText = ""
        let streamedText = ""
        let queuedText = ""
        let flushTimeoutId: number | null = null
        let resolveQueueDrained: (() => void) | null = null
        const queueDrained = new Promise<void>((resolve) => {
          resolveQueueDrained = resolve
        })

        const finishQueueDrain = () => {
          if (!resolveQueueDrained) {
            return
          }
          resolveQueueDrained()
          resolveQueueDrained = null
        }

        const appendRenderedText = (text: string) => {
          renderedText += text
          assistantText = renderedText
          upsertAssistantMessage(assistantMessageId, (previous) => ({
            id: assistantMessageId,
            role: "assistant",
            text: renderedText,
            createdAt: previous?.createdAt ?? responseCreatedAt,
            meta: {
              ...baseMeta,
              ...(previous?.meta ?? {}),
            },
          }))
        }

        const maybeFinishQueue = () => {
          if (streamFinished && queuedText.length === 0 && flushTimeoutId === null) {
            finishQueueDrain()
          }
        }

        const flushQueuedText = () => {
          if (!canRenderChunks || flushTimeoutId !== null) {
            return
          }

          const step = () => {
            flushTimeoutId = null

            if (!canRenderChunks) {
              return
            }

            if (!queuedText.length) {
              maybeFinishQueue()
              return
            }

            const nextSlice = queuedText.slice(0, 20)
            queuedText = queuedText.slice(nextSlice.length)
            appendRenderedText(nextSlice)
            flushTimeoutId = window.setTimeout(step, 18)
          }

          step()
        }

        const enqueueChunk = (chunk: string) => {
          streamedText += chunk
          queuedText += chunk
          flushQueuedText()
        }

        stopLivePlayback = () => {
          canRenderChunks = false
          streamFinished = true
          queuedText = ""
          if (flushTimeoutId !== null) {
            window.clearTimeout(flushTimeoutId)
            flushTimeoutId = null
          }
          finishQueueDrain()
        }

        setActiveStreamMessageId(assistantMessageId)

        const streamPromise = streamChatRequest(
          conversation,
          currentSettings,
          (chunk) => enqueueChunk(chunk)
        ).then(
          (response) => ({ ok: true as const, response }),
          (error) => ({ ok: false as const, error })
        )

        if (shouldShowIndicator) {
          await wait(TYPING_MIN_DURATION_MS)
        }

        setShowStatusIndicator(false)
        upsertAssistantMessage(assistantMessageId, () => ({
          id: assistantMessageId,
          role: "assistant",
          text: "",
          createdAt: responseCreatedAt,
          meta: {
            ...baseMeta,
          },
        }))

        canRenderChunks = true
        flushQueuedText()

        const streamResult = await streamPromise
        if (!streamResult.ok) {
          throw streamResult.error
        }

        const response = streamResult.response
        if (typeof response.text === "string" && response.text !== streamedText) {
          if (response.text.startsWith(renderedText)) {
            queuedText += response.text.slice(renderedText.length)
          } else {
            renderedText = ""
            queuedText = response.text
          }
          streamedText = response.text
          flushQueuedText()
        }
        streamFinished = true
        maybeFinishQueue()
        await queueDrained
        assistantText = streamedText

        if (response.usage) {
          promptTokens = response.usage.promptTokens
          completionTokens = response.usage.completionTokens
        } else {
          completionTokens = estimateTokens(assistantText)
        }
      } else {
        if (shouldShowIndicator) {
          await wait(TYPING_MIN_DURATION_MS)
        }
        setShowStatusIndicator(false)
        assistantText = createAssistantReply(promptText, currentSettings)
        completionTokens = estimateTokens(assistantText)
      }

      const totalTokens = promptTokens + completionTokens
      const durationMs = performance.now() - requestStartedAt

      upsertAssistantMessage(assistantMessageId, () => ({
        id: assistantMessageId,
        role: "assistant",
        text: assistantText,
        createdAt: responseCreatedAt,
        meta: {
          ...baseMeta,
          source,
          durationMs,
          promptTokens,
          completionTokens,
          totalTokens,
        },
      }))

      setUsageStats((previous) => {
        const responses = previous.responses + 1
        const avgResponseMs =
          (previous.avgResponseMs * previous.responses + durationMs) / responses
        return {
          ...previous,
          promptTokens: previous.promptTokens + promptTokens,
          completionTokens: previous.completionTokens + completionTokens,
          totalTokens: previous.totalTokens + totalTokens,
          lastResponseMs: durationMs,
          avgResponseMs,
          responses,
        }
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "OpenRouter request failed."
      const fallbackText = `Live API failed. Using mock reply instead.\n${createAssistantReply(
        promptText,
        currentSettings
      )}`
      const durationMs = performance.now() - requestStartedAt
      const promptTokens = estimateTokens(promptText)
      const completionTokens = estimateTokens(fallbackText)

      setLastError(message)
      setUsageStats((previous) => ({
        ...previous,
        errorCount: previous.errorCount + 1,
      }))
      stopLivePlayback?.()

      upsertAssistantMessage(assistantMessageId, () => ({
        id: assistantMessageId,
        role: "assistant",
        text: fallbackText,
        createdAt: responseCreatedAt,
        meta: {
          ...baseMeta,
          source: "mock",
          durationMs,
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
      }))
    } finally {
      stopLivePlayback?.()
      setIsTyping(false)
      setShowStatusIndicator(false)
      setActiveStreamMessageId(null)
    }
  }

  const submitUserPrompt = async (promptText: string) => {
    if (isTyping) {
      return
    }

    const trimmedMessage = promptText.trim()
    if (!trimmedMessage) {
      return
    }

    const currentSettings = { ...settings }
    const sendAsOtherPerson = currentSettings.sendAsOtherPerson
    const nextMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: sendAsOtherPerson ? "other" : "user",
      text: trimmedMessage,
      createdAt: Date.now(),
    }
    const conversation = [...messages, nextMessage]

    setMessages(conversation)
    setDraft("")

    if (!currentSettings.autoReply || sendAsOtherPerson) {
      setLastError(null)
      return
    }

    await buildAssistantReply({
      conversation,
      promptText: trimmedMessage,
      currentSettings,
      assistantMessageId: crypto.randomUUID(),
    })
  }

  const sendMessage = async () => {
    await submitUserPrompt(draft)
  }

  const sendStarterPrompt = (prompt: string) => {
    const nextDraft = prompt.endsWith(" ") ? prompt : `${prompt} `
    setDraft(nextDraft)
  }

  const previewStatusIndicator = async () => {
    if (isTyping) {
      return
    }

    setIsTyping(true)
    setShowStatusIndicator(true)
    setLastError(null)

    try {
      await wait(TYPING_MIN_DURATION_MS)
    } finally {
      setShowStatusIndicator(false)
      setIsTyping(false)
    }
  }

  const redoAssistantMessage = async (assistantMessageId: string) => {
    if (isTyping) {
      return
    }

    const assistantIndex = messages.findIndex(
      (message) => message.id === assistantMessageId && message.role === "assistant"
    )
    if (assistantIndex < 0) {
      return
    }

    const conversation = messages.slice(0, assistantIndex)
    const latestUserMessage = [...conversation]
      .reverse()
      .find((message) => message.role === "user")

    if (!latestUserMessage) {
      return
    }

    await buildAssistantReply({
      conversation,
      promptText: latestUserMessage.text,
      currentSettings: { ...settings },
      assistantMessageId,
    })
  }

  const sentCount = messages.filter((message) => message.role === "user").length
  const receivedCount = messages.filter(
    (message) => message.role === "assistant" || message.role === "other"
  ).length
  const stats = {
    sentCount,
    receivedCount,
    ...usageStats,
  }

  return (
    <main className="relative h-dvh w-screen overflow-hidden">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setShowSettingsPanel((previous) => !previous)}
        className="absolute bottom-8 left-8 z-40 size-10 rounded-full bg-white/92 shadow-sm backdrop-blur transition-transform duration-300 ease-out"
        aria-label={showSettingsPanel ? "Hide chat settings" : "Show chat settings"}
      >
        {showSettingsPanel ? (
          <PanelLeftClose className="size-4" />
        ) : (
          <PanelLeftOpen className="size-4" />
        )}
      </Button>

      <AnimatePresence>
        {!isDesktopLayout && showSettingsPanel ? (
          <>
            <motion.button
              type="button"
              aria-label="Close chat settings"
              onClick={() => setShowSettingsPanel(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute inset-0 z-20 bg-slate-950/18 backdrop-blur-[1px]"
            />
            <motion.aside
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute inset-3 z-30 min-h-0"
            >
              <SettingsPanel
                settings={settings}
                messageCount={messages.length}
                stats={stats}
                isBusy={isTyping}
                lastError={lastError}
                onSettingsChange={(changes) =>
                  setSettings((previous) => ({ ...previous, ...changes }))
                }
                onPlayStatusIndicator={previewStatusIndicator}
              />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <motion.div className="relative h-full w-full">
        <motion.aside
          initial={false}
          animate={
            isDesktopLayout
              ? {
                  x: showSettingsPanel ? 0 : -32,
                  opacity: showSettingsPanel ? 1 : 0,
                }
              : {
                  x: -32,
                  opacity: 0,
                }
          }
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "absolute inset-y-0 left-0 z-10 hidden w-[360px] min-h-0 md:block",
            showSettingsPanel && isDesktopLayout
              ? "pointer-events-auto"
              : "pointer-events-none"
          )}
        >
          <div className="h-full min-h-0 p-3 pr-0 md:p-4 md:pr-0">
            <SettingsPanel
              settings={settings}
              messageCount={messages.length}
              stats={stats}
              isBusy={isTyping}
              lastError={lastError}
              onSettingsChange={(changes) =>
                setSettings((previous) => ({ ...previous, ...changes }))
              }
              onPlayStatusIndicator={previewStatusIndicator}
            />
          </div>
        </motion.aside>

        <motion.section
          initial={{ opacity: 0, x: 16 }}
          animate={{
            opacity: 1,
            x: 0,
            marginLeft: isDesktopLayout && showSettingsPanel ? 360 : 0,
          }}
          transition={{
            duration: 0.24,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="flex h-full min-h-0 items-center justify-center p-3 md:p-4"
        >
          <ChatPhone
            messages={messages}
            draft={draft}
            isTyping={isTyping}
            showStatusIndicator={showStatusIndicator}
            activeStreamMessageId={activeStreamMessageId}
            activeModel={settings.model}
            showResponseIconsOnHover={settings.showResponseIconsOnHover}
            moveBubblesOnIncomingMessage={settings.moveBubblesOnIncomingMessage}
            onDraftChange={setDraft}
            onSend={sendMessage}
            onRedoAssistantMessage={redoAssistantMessage}
            onUseStarterPrompt={sendStarterPrompt}
          />
        </motion.section>
      </motion.div>
    </main>
  )
}

export default App
