import { useEffect, useRef, useState } from "react"
import { motion } from "motion/react"

import { streamChatRequest } from "@/features/chat/api/send-chat"
import { TYPING_MIN_DURATION_MS } from "@/features/chat/constants"
import { starterMessages } from "@/features/chat/data/starter-messages"
import { ChatPhone } from "@/features/chat/components/chat-phone"
import type { ChatMessage, ChatMessageMeta, ChatSettings } from "@/features/chat/types"
import { createAssistantReply } from "@/features/chat/utils/create-assistant-reply"
import { SettingsPanel } from "@/features/settings/components/settings-panel"

const initialSettings: ChatSettings = {
  model: "openai/gpt-4.1-nano",
  temperature: 0.6,
  autoReply: true,
  useOpenRouter: true,
  showProcessingIndicator: true,
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

function App() {
  const [settings, setSettings] = useState<ChatSettings>(initialSettings)
  const [messages, setMessages] = useState(starterMessages)
  const [draft, setDraft] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [showStatusIndicator, setShowStatusIndicator] = useState(false)
  const [activeStreamMessageId, setActiveStreamMessageId] = useState<string | null>(
    null
  )
  const [lastError, setLastError] = useState<string | null>(null)
  const [usageStats, setUsageStats] = useState<UsageStats>(initialUsageStats)
  const timeoutIds = useRef<number[]>([])

  useEffect(() => {
    return () => {
      timeoutIds.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
      timeoutIds.current = []
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

    try {
      let assistantText = ""
      let promptTokens = estimateTokens(promptText)
      let completionTokens = 0
      let source: ChatMessageMeta["source"] = "mock"

      if (currentSettings.useOpenRouter) {
        source = "live"
        const pendingChunks: string[] = []
        let canRenderChunks = false
        setActiveStreamMessageId(assistantMessageId)

        const appendChunk = (chunk: string) => {
          assistantText += chunk
          upsertAssistantMessage(assistantMessageId, (previous) => ({
            id: assistantMessageId,
            role: "assistant",
            text: assistantText,
            createdAt: previous?.createdAt ?? responseCreatedAt,
            meta: {
              ...baseMeta,
              ...(previous?.meta ?? {}),
            },
          }))
        }

        const streamPromise = streamChatRequest(
          conversation,
          currentSettings,
          (chunk) => {
            if (canRenderChunks) {
              appendChunk(chunk)
              return
            }
            pendingChunks.push(chunk)
          }
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
        pendingChunks.forEach(appendChunk)

        const streamResult = await streamPromise
        if (!streamResult.ok) {
          throw streamResult.error
        }

        const response = streamResult.response
        assistantText = response.text

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
    const nextMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmedMessage,
      createdAt: Date.now(),
    }
    const conversation = [...messages, nextMessage]

    setMessages(conversation)
    setDraft("")

    if (!currentSettings.autoReply) {
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
    (message) => message.role === "assistant"
  ).length
  const stats = {
    sentCount,
    receivedCount,
    ...usageStats,
  }

  return (
    <main className="h-dvh w-screen overflow-hidden">
      <div className="grid h-full w-full grid-cols-1 md:grid-cols-4">
        <motion.aside
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="h-full min-h-0 p-3 md:col-span-1 md:p-4"
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

        <motion.section
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
          className="flex h-full min-h-0 items-center justify-center p-3 md:col-span-3 md:p-4"
        >
          <ChatPhone
            messages={messages}
            draft={draft}
            isTyping={isTyping}
            showStatusIndicator={showStatusIndicator}
            activeStreamMessageId={activeStreamMessageId}
            activeModel={settings.model}
            onDraftChange={setDraft}
            onSend={sendMessage}
            onRedoAssistantMessage={redoAssistantMessage}
            onUseStarterPrompt={sendStarterPrompt}
          />
        </motion.section>
      </div>
    </main>
  )
}

export default App
