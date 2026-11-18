import { motion, useIsPresent } from "motion/react"
import { useEffect, type ReactNode } from "react"
import { useRestoreFocus } from "@/app/useRestoreFocus"
import { dialogBackdrop, dialogCard, presence, usePrefersReducedMotion } from "@/design/motion"

type Props = {
  /** the id of the card's title */
  labelledBy: string
  /** Escape and a tap on the backdrop */
  onDismiss: () => void
  children: ReactNode
}

/**
 * The quit dialog's frame, shared with the blanks dialog: a small single-size card over a dimmed
 * backdrop (PRODUCT_NOTES §3, Duolingo-style); the screen grays first, then the card fades in,
 * nothing more (Ian, 2026-10-20); on the way out (the player's AnimatePresence) both fade together
 * and the dialog unmounts once that has played. Escape and a tap on the backdrop dismiss it, and
 * focus goes back to the button that opened it when it closes (the card's own `autoFocus` button
 * takes it on the way in). The player marks everything behind it inert.
 */
export function DialogFrame({ labelledBy, onDismiss, children }: Props) {
  const closing = !useIsPresent()
  const reduced = usePrefersReducedMotion()
  useRestoreFocus()
  useEffect(() => {
    if (closing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        // the Esc held down that opened it doesn't close it again
        if (!e.repeat) onDismiss()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onDismiss, closing])
  return (
    <motion.div
      role="dialog"
      aria-modal
      aria-labelledby={labelledBy}
      // on the way out nothing in it can be pressed or focused
      inert={closing}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onDismiss}
      {...presence(dialogBackdrop, reduced)}
    >
      {/* the card waits for the gray, then fades in (dialogCard) */}
      <motion.div
        className="flex w-[320px] flex-col items-center gap-5 rounded-xl bg-white p-6 text-center"
        onClick={(e) => e.stopPropagation()}
        {...presence(dialogCard, reduced)}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
