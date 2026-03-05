import { useEffect, useRef, useState } from "react"
import { MoreHorizontal, RotateCcw, Copy, GitBranch } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/features/chat/types"

interface ChatBubbleProps {
  message: ChatMessage
  isStreaming?: boolean
  isBusy?: boolean
  showActionsOnHover?: boolean
  onRedo?: (assistantMessageId: string) => void
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4))
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp))
}

export function ChatBubble({
  message,
  isStreaming = false,
  isBusy = false,
  showActionsOnHover = false,
  onRedo,
}: ChatBubbleProps) {
  const isUser = message.role === "user"
  const isOther = message.role === "other"
  const hasText = message.text.trim().length > 0
  const [showMeta, setShowMeta] = useState(false)
  const metaRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!showMeta) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }

      if (!metaRef.current?.contains(target)) {
        setShowMeta(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [showMeta])

  if (isUser || isOther) {
    return (
      <motion.div
        initial={{
          opacity: 0.35,
          scale: isOther ? 0.94 : 0.9,
          x: isOther ? -8 : 8,
          y: 88,
          filter: "blur(6px)",
        }}
        animate={{ opacity: 1, scale: 1, x: 0, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{
          duration: 0.44,
          ease: [0.16, 1, 0.3, 1],
        }}
        className={cn("flex", isOther ? "justify-start" : "justify-end")}
        style={{ originX: isOther ? 0 : 1, originY: 1 }}
      >
        <div
          className={cn(
            "max-w-[80%] px-3 py-2 text-sm whitespace-pre-wrap",
            isOther
              ? "rounded-2xl rounded-bl-sm bg-slate-200 text-slate-900"
              : "rounded-2xl rounded-br-sm bg-[#0D4FFB] text-white"
          )}
        >
          {message.text}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="group flex"
    >
      <div className="relative w-full max-w-none">
        <motion.div
          key={hasText ? "assistant-visible" : "assistant-pending"}
          initial={
            hasText
              ? { opacity: 0, filter: "blur(6px)" }
              : { opacity: 0.7, filter: "blur(0px)" }
          }
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.32, ease: "easeOut" }}
          className={cn(
            "w-full max-w-none py-1 pl-3 pr-1 text-[15px] leading-7 whitespace-pre-wrap text-foreground"
          )}
        >
          {!hasText && isStreaming ? (
            <span className="text-muted-foreground/70">...</span>
          ) : (
            message.text
          )}
          {isStreaming ? (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground/60 align-[-2px]" />
          ) : null}
        </motion.div>

        <TooltipProvider>
          <div
            className={cn(
              "mt-0.5 flex items-center gap-1 pl-2 text-muted-foreground transition-opacity",
              showActionsOnHover && !showMeta
                ? "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                : "opacity-100"
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Copy message"
                  disabled={!hasText}
                  onClick={async () => {
                    if (!hasText) {
                      return
                    }

                    try {
                      await navigator.clipboard.writeText(message.text)
                    } catch {
                      return
                    }
                  }}
                  className="size-8"
                >
                  <Copy className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Branch to new chat"
                  className="size-8"
                >
                  <GitBranch className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Branch out</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Redo response"
                  disabled={isBusy || !onRedo}
                  onClick={() => onRedo?.(message.id)}
                  className="size-8"
                >
                  <RotateCcw className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Regenerate</TooltipContent>
            </Tooltip>

            <div ref={metaRef} className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowMeta((previous) => !previous)}
                    className="size-8"
                    aria-label="Show message details"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>More</TooltipContent>
              </Tooltip>
              <AnimatePresence>
                {showMeta ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-9 left-1/2 z-20 w-64 -translate-x-1/2 rounded-xl border border-slate-200 bg-white/96 p-3 text-xs text-muted-foreground shadow-lg backdrop-blur"
                  >
                    <p className="text-[11px] text-foreground">
                      {message.meta?.source === "mock"
                        ? "Mock response"
                        : "Live response"}
                    </p>
                    <div className="mt-2 space-y-1">
                      <p>
                        Time:{" "}
                        <span className="font-medium text-foreground">
                          {formatTimestamp(message.createdAt)}
                        </span>
                      </p>
                      <p>
                        Model:{" "}
                        <span className="font-medium text-foreground">
                          {message.meta?.model ?? "-"}
                        </span>
                      </p>
                      <p>
                        Temperature:{" "}
                        <span className="font-medium text-foreground">
                          {message.meta?.temperature?.toFixed(1) ?? "-"}
                        </span>
                      </p>
                      <p>
                        Tokens:{" "}
                        <span className="font-medium text-foreground">
                          {(message.meta?.totalTokens ?? estimateTokens(message.text)).toLocaleString()}
                        </span>
                      </p>
                      <p>
                        Prompt / Completion:{" "}
                        <span className="font-medium text-foreground">
                          {message.meta?.promptTokens?.toLocaleString() ?? "-"} /{" "}
                          {message.meta?.completionTokens?.toLocaleString() ??
                            estimateTokens(message.text).toLocaleString()}
                        </span>
                      </p>
                      <p>
                        Length:{" "}
                        <span className="font-medium text-foreground">
                          {message.text.length} chars,{" "}
                          {message.text.trim().split(/\s+/).filter(Boolean).length} words
                        </span>
                      </p>
                      <p>
                        Latency:{" "}
                        <span className="font-medium text-foreground">
                          {message.meta?.durationMs
                            ? `${Math.round(message.meta.durationMs)}ms`
                            : "-"}
                        </span>
                      </p>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </TooltipProvider>
      </div>
    </motion.div>
  )
}
