import { useSyncExternalStore } from "react"
import type { BezierDefinition, Transition, Variants } from "motion/react"

/*
 * Tuwon's animations (tuwon-player src/design/motion.ts), the ones the questionnaire uses, with the
 * same durations and curves.
 */

const TW_EASE_OUT: BezierDefinition = [0, 0, 0.2, 1]
/** rises fast, goes a little past the end and settles */
const OVERSHOOT: BezierDefinition = [0.18, 1.7, 0.35, 1]

const REDUCE = "(prefers-reduced-motion: reduce)"

function watchReduce(onChange: () => void) {
  const query = window.matchMedia(REDUCE)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/** Whether the phone or computer asks for less motion, followed live. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    watchReduce,
    () => window.matchMedia(REDUCE).matches,
    () => false,
  )
}

/** Props for something that animates in as it mounts and, inside AnimatePresence, out before it unmounts. */
export function presence(variants: Variants, reduced = false) {
  return {
    variants,
    initial: reduced ? false : "hidden",
    animate: "shown",
    exit: reduced ? undefined : "gone",
  } as const
}

/** a toast or a button springing in, a hair past full size */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  shown: { opacity: 1, scale: 1, transition: { duration: 0.18, ease: OVERSHOOT } },
  gone: { opacity: 0, scale: 0.94, transition: { duration: 0.16, ease: "easeIn" } },
}

/** a dialog: the backdrop grays the screen, then the card fades in; closing, both fade together */
const DIALOG_GRAY_S = 0.2

export const dialogBackdrop: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: DIALOG_GRAY_S, ease: "easeOut" } },
  gone: { opacity: 0, transition: { duration: 0.2, ease: "easeIn" } },
}

export const dialogCard: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { delay: DIALOG_GRAY_S, duration: 0.2, ease: "easeOut" } },
}

/** the progress bar filling */
export const progressFill: Transition = { duration: 0.3, ease: TW_EASE_OUT }

/** how long a step change takes, the old screen's drift out included */
export const STEP_MS = 420

const STEP_OUT_EASE: BezierDefinition = [0.3, 0, 0.6, 1]

/**
 * Step to step, as in the player: the old screen drifts 48px out the way we are going (1 =
 * forward, to the left) while the new one drifts in from the other side after a beat. Both stay
 * mostly transparent while they move, so they are never solid at the same time. `custom` is the
 * direction.
 */
export const step: Variants = {
  enter: (direction: 1 | -1) => ({ opacity: 0, x: 48 * direction }),
  shown: {
    opacity: 1,
    x: 0,
    transition: {
      opacity: { delay: 0.08, duration: 0.32, ease: [0.6, 0, 0.85, 0.45] },
      x: { delay: 0.08, duration: 0.32, ease: [0.33, 0, 0.2, 1] },
    },
  },
  gone: (direction: 1 | -1) => ({
    opacity: [1, 0.35, 0],
    x: -48 * direction,
    transition: {
      opacity: { duration: 0.28, times: [0, 0.3, 1], ease: [STEP_OUT_EASE, STEP_OUT_EASE] },
      x: { duration: 0.28, ease: STEP_OUT_EASE },
    },
  }),
}
