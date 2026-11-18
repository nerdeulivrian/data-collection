import { motion } from "motion/react"
import { progressFill } from "@/design/motion"

/**
 * Tuwon's progress bar: 10px with a 1px top edge; the orange fill carries the two little
 * "reflection" pills and grows to each new width.
 */
export function ProgressBar({ fraction }: { fraction: number }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100
  return (
    <div
      role="progressbar"
      aria-label="Progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="h-[10px] w-full overflow-hidden border-t border-ink-muted bg-line"
    >
      <motion.div
        className="flex h-full items-start justify-end gap-[3px] rounded-r-pill bg-brand pt-[2px] pr-[4px]"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={progressFill}
      >
        {pct > 4 && (
          <>
            <span className="h-[2px] w-[5px] rounded-pill bg-brand-glow" />
            <span className="h-[2px] w-[15px] rounded-pill bg-brand-glow" />
          </>
        )}
      </motion.div>
    </div>
  )
}
