import clsx from "clsx"
import { CircleX } from "lucide-react"
import { AnimatePresence, motion, useIsPresent } from "motion/react"
import type { ReactNode } from "react"
import type { Breakpoint } from "@/app/useBreakpoint"
import { Chip, TinyButton } from "@/components/Bits"
import { PressButton, type ButtonTone } from "@/components/PressButton"
import { ProgressBar } from "@/components/ProgressBar"
import { step, usePrefersReducedMotion } from "@/design/motion"

export type BarButton = {
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: ButtonTone
  /** longer words (YES, I AGREE): the button takes the rest of the row on a phone */
  grow?: boolean
}

type Props = {
  layout: Breakpoint
  /** the strip above the screen: the section's chip and the exit button; none at the start and the ends */
  top: { chip: string; onExit: () => void } | null
  /** how far along, 0 to 1 */
  progress: number
  /** null: the right button has the bottom row to itself */
  left: BarButton | null
  right: BarButton
  /** a new key slides the screen over, the way `direction` says (1 = forward) */
  screenKey: string
  direction: 1 | -1
  /** a dialog is open: nothing behind it can be reached */
  inert: boolean
  children: ReactNode
}

/**
 * The player's frame, for the questionnaire: one screen at a time, never a long page. On a phone a
 * 50px strip above (the section's chip, exit), the screen in the middle, and the progress bar over
 * an 80px row of buttons (BACK and NEXT, 130 × 44); from a tablet up the same in a 1000px column,
 * with the 140px band and its 150 × 50 buttons. A screen taller than the space it has scrolls on
 * its own, as the player's do; the screens are made to fit a small phone without that.
 */
export function Frame({
  layout,
  top,
  progress,
  left,
  right,
  screenKey,
  direction,
  inert,
  children,
}: Props) {
  const mobile = layout === "mobile"
  return (
    <div className="flex h-app w-full flex-col overflow-hidden bg-bg" inert={inert}>
      {top && (
        <div
          className={clsx(
            "mx-auto flex w-full shrink-0 items-center justify-between",
            mobile ? "h-strip px-5" : "h-[72px] max-w-[1000px] px-10",
          )}
        >
          <Chip>{top.chip}</Chip>
          <TinyButton icon={CircleX} label="Exit" tone="exit" big={!mobile} onClick={top.onExit} />
        </div>
      )}
      <main className="relative min-h-0 flex-1">
        <AnimatePresence initial={false} custom={direction}>
          <Stage key={screenKey} direction={direction} layout={layout}>
            {children}
          </Stage>
        </AnimatePresence>
      </main>
      <div className="w-full shrink-0">
        <ProgressBar fraction={progress} />
        {mobile ? <MobileBar left={left} right={right} /> : <WideBar left={left} right={right} />}
      </div>
    </div>
  )
}

/**
 * One screen. Leaving, it drifts out the way we are going while the next drifts in (design/motion
 * `step`), and can't be pressed or focused while it goes. With reduced motion it simply changes.
 */
function Stage({
  direction,
  layout,
  children,
}: {
  direction: 1 | -1
  layout: Breakpoint
  children: ReactNode
}) {
  const present = useIsPresent()
  const reduced = usePrefersReducedMotion()
  return (
    <motion.div
      className="absolute inset-0 overflow-y-auto"
      custom={direction}
      variants={step}
      initial={reduced ? false : "enter"}
      animate="shown"
      exit={reduced ? undefined : "gone"}
      inert={!present}
      aria-hidden={!present || undefined}
    >
      <div
        className={clsx(
          "flex min-h-full items-center justify-center",
          layout === "mobile" ? "px-4 py-5" : layout === "tablet" ? "px-[70px] py-6" : "px-10 py-6",
        )}
      >
        {children}
      </div>
    </motion.div>
  )
}

function BarPress({ button, size }: { button: BarButton; size: "md" | "sm" | "fill" | "mdGrow" | "smGrow" }) {
  return (
    <PressButton
      tone={button.tone ?? "brand"}
      size={size}
      disabled={button.disabled}
      onClick={button.onClick}
      data-bar={button.tone === "outline" ? "left" : "right"}
    >
      {button.label}
    </PressButton>
  )
}

function MobileBar({ left, right }: { left: BarButton | null; right: BarButton }) {
  return (
    <div
      className={clsx(
        "flex h-[80px] items-center gap-3 bg-white py-[18px]",
        left ? "justify-between px-5" : "px-4",
      )}
    >
      {left ? (
        <>
          <BarPress button={left} size="sm" />
          <BarPress button={right} size={right.grow ? "smGrow" : "sm"} />
        </>
      ) : (
        <BarPress button={right} size="fill" />
      )}
    </div>
  )
}

function WideBar({ left, right }: { left: BarButton | null; right: BarButton }) {
  return (
    <div className="bg-white">
      <div className="mx-auto flex h-[140px] w-full max-w-[1000px] items-center justify-between px-10">
        <div className="flex h-[50px] min-w-[150px] items-center">
          {left && <BarPress button={left} size="md" />}
        </div>
        <div className="flex h-[50px] min-w-[150px] items-center justify-end">
          <BarPress button={right} size={right.grow ? "mdGrow" : "md"} />
        </div>
      </div>
    </div>
  )
}
