import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { useScramble } from "use-scramble"
import { TYPING_STATE_MS, TYPING_STATES } from "@/features/chat/constants"

export function TypingStatus() {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setStepIndex((previous) =>
        previous < TYPING_STATES.length - 1 ? previous + 1 : previous
      )
    }, TYPING_STATE_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const { ref } = useScramble({
    text: TYPING_STATES[stepIndex],
    speed: 0.9,
    tick: 1,
    step: 1,
    scramble: 3,
    seed: 2,
    chance: 0.95,
    range: [65, 90],
  })

  return (
    <motion.div
      key="typing-status"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex"
    >
      <motion.div
        initial={{ opacity: 0.7, filter: "blur(0px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-none py-1 pl-3 pr-1 text-[15px] leading-7 whitespace-pre-wrap text-foreground"
      >
        <span ref={ref} />
      </motion.div>
    </motion.div>
  )
}
