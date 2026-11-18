import clsx from "clsx"
import type { LucideIcon } from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useRef, type ReactNode } from "react"
import { popIn, presence, usePrefersReducedMotion } from "@/design/motion"

/** Tuwon's mode badge look: white capitals on an orange pill. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="flex shrink-0 items-center rounded-pill bg-brand px-3 py-[5px] text-[11px] font-extrabold tracking-[0.6px] text-white uppercase">
      {children}
    </span>
  )
}

/** a small gray line in capitals above a heading ("3 OF 21") */
export function Overline({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={clsx("text-[12px] font-extrabold tracking-[0.8px] text-ink-secondary uppercase", className)}>
      {children}
    </p>
  )
}

/**
 * Tuwon's small square buttons (the phone's strip): 23px on a phone with a 45px tap target, 36px
 * from a tablet up.
 */
export function TinyButton({
  icon: Icon,
  label,
  onClick,
  big = false,
  tone = "default",
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  big?: boolean
  tone?: "default" | "exit"
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={clsx(
        "press relative flex items-center justify-center border border-line bg-white enabled:hover:bg-surface before:absolute before:content-['']",
        big
          ? "rounded-md p-[7px] before:-inset-[4px] [--press-depth:3px]"
          : "rounded-sm p-[3px] before:-inset-[11px] [--press-depth:2px]",
      )}
    >
      <Icon size={big ? 20 : 15} className={tone === "exit" ? "text-exit" : "text-ink-button"} />
    </button>
  )
}

/** A short message over the bottom of the screen that goes by itself after a few seconds. */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  const reduced = usePrefersReducedMotion()
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  useEffect(() => {
    const t = setTimeout(() => done.current(), 6000)
    return () => clearTimeout(t)
  }, [message])
  return (
    <motion.div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[104px] z-40 flex justify-center px-4 tablet:bottom-[164px]"
      {...presence(popIn, reduced)}
    >
      <div className="max-w-[440px] rounded-xl bg-ink-strong px-4 py-3 text-center text-[15px] leading-snug font-semibold text-white shadow-lg">
        {message}
      </div>
    </motion.div>
  )
}
