import clsx from "clsx"
import { CircleX } from "lucide-react"
import { AnimatePresence, motion, useIsPresent } from "motion/react"
import type { ReactNode } from "react"
import { useStrings } from "@/app/language"
import type { Breakpoint } from "@/app/useBreakpoint"
import { Chip, Overline, TinyButton } from "@/components/Bits"
import { LanguageSwitch } from "@/components/LanguageSwitch"
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
  /** the strip above the screen: the section's chip and the exit button; none at the start and the
   * ends, where the strip has the language switch alone */
  top: { chip: string; onExit: () => void } | null
  /** how far along, 0 to 1 */
  progress: number
  /** "Page 3 of 14" or "3 of 10" above the progress bar, while the screens of one `group` (a section
   * of more than one page, a part's items) slide under it */
  pageCount: { group: string; text: string } | null
  /** an answer control that stays where it is while the screens of one `group` slide (the Likert
   * slider): it comes with the first of them and goes with the last. Those screens fill the
   * screen's height, and leave the control its place */
  dock: { group: string; node: ReactNode } | null
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
 * 50px strip above (the section's chip, the language switch, exit), the screen in the middle, and
 * the progress bar over an 80px row of buttons (BACK and NEXT, 130 × 44); from a tablet up the same
 * in a 1000px column, with the 140px band and its 150 × 50 buttons. A screen taller than the space
 * it has scrolls on its own, as the player's do; the screens are made to fit a small phone without
 * that. Two things stay put while the screens of a group slide: the count above the progress bar
 * ("Page 3 of 14", "3 of 21") and the dock (the Likert slider). The language switch changes the
 * words where they are: the screen does not slide.
 */
export function Frame({
  layout,
  top,
  progress,
  pageCount,
  dock,
  left,
  right,
  screenKey,
  direction,
  inert,
  children,
}: Props) {
  const mobile = layout === "mobile"
  const reduced = usePrefersReducedMotion()
  const t = useStrings()
  /** the chip and the exit button fade in and out with the questionnaire */
  const fade = {
    initial: reduced ? false : { opacity: 0 },
    animate: { opacity: 1 },
    exit: reduced ? undefined : { opacity: 0 },
    transition: { duration: 0.3, ease: "easeOut" },
  } as const
  return (
    <div className="flex h-app w-full flex-col overflow-hidden bg-bg" inert={inert}>
      {/* the strip keeps its height even when empty, so nothing below jumps when it appears */}
      <div
        className={clsx(
          "mx-auto w-full shrink-0",
          mobile ? "h-strip px-5" : "h-[72px] max-w-[1000px] px-10",
        )}
      >
        <div className="flex h-full items-center justify-between">
          <AnimatePresence initial={false}>
            {top && (
              <motion.div key="chip" className="flex min-w-0 items-center" {...fade}>
                <Chip>{top.chip}</Chip>
              </motion.div>
            )}
          </AnimatePresence>
          {/* the language switch is on every screen, the start and the ends too, and never moves:
              the exit button keeps its place beside it while it is away (Ian, 2026-11-19) */}
          <div className={clsx("ml-auto flex shrink-0 items-center", mobile ? "gap-3" : "gap-4")}>
            <LanguageSwitch big={!mobile} />
            <div className={mobile ? "h-[23px] w-[23px]" : "h-[36px] w-[36px]"}>
              <AnimatePresence initial={false}>
                {top && (
                  <motion.div key="exit" {...fade}>
                    <TinyButton icon={CircleX} label={t.exit} tone="exit" big={!mobile} onClick={top.onExit} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      <main className="relative min-h-0 flex-1">
        <AnimatePresence initial={false} custom={direction}>
          <Stage
            key={screenKey}
            direction={direction}
            layout={layout}
            roomBelow={pageCount !== null}
            fill={dock !== null}
          >
            {children}
          </Stage>
        </AnimatePresence>
        <AnimatePresence initial={false} custom={direction}>
          {dock && (
            <Dock key={dock.group} direction={direction} layout={layout} roomBelow={pageCount !== null}>
              {dock.node}
            </Dock>
          )}
        </AnimatePresence>
      </main>
      <div className="relative w-full shrink-0">
        {/* the page count stays put while the pages of a section slide, and fades after the last */}
        <AnimatePresence initial={false}>
          {pageCount && (
            <motion.div
              key={pageCount.group}
              className={clsx(
                "pointer-events-none absolute inset-x-0 bottom-full flex justify-center",
                mobile ? "pb-2" : "pb-3",
              )}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.08, duration: 0.32, ease: "easeOut" } }}
              exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.2, ease: "easeIn" } }}
            >
              <Overline>{pageCount.text}</Overline>
            </motion.div>
          )}
        </AnimatePresence>
        <ProgressBar fraction={progress} />
        {mobile ? <MobileBar left={left} right={right} /> : <WideBar left={left} right={right} />}
      </div>
    </div>
  )
}

/** the room around a screen; with a page count at the bottom, the screen keeps clear of it */
const around = (layout: Breakpoint, roomBelow: boolean, flushTop = false) =>
  clsx(
    layout === "mobile" ? "px-4 py-5" : layout === "tablet" ? "px-[70px] py-6" : "px-10 py-6",
    roomBelow && (layout === "mobile" ? "pb-10" : "pb-12"),
    // a Likert item and its slider: no room kept at the top (Ian, 2026-11-19)
    flushTop && "pt-0",
  )

/**
 * One screen. Leaving, it drifts out the way we are going while the next drifts in (design/motion
 * `step`), and can't be pressed or focused while it goes. With reduced motion it simply changes.
 */
function Stage({
  direction,
  layout,
  roomBelow,
  fill,
  children,
}: {
  direction: 1 | -1
  layout: Breakpoint
  roomBelow: boolean
  /** the screen takes the whole height and lays itself out in it (a Likert item, over the dock) */
  fill: boolean
  children: ReactNode
}) {
  const present = useIsPresent()
  const reduced = usePrefersReducedMotion()
  return (
    <motion.div
      data-stage
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
          "flex items-center justify-center",
          fill ? "h-full" : "min-h-full",
          around(layout, roomBelow, fill),
        )}
      >
        {children}
      </div>
    </motion.div>
  )
}

/**
 * The dock: over the screens, in the same room as a screen that fills the height, so what it holds
 * lines up with the place that screen leaves for it. It comes and goes as a screen does; between,
 * the screens slide under it. Only what it holds can be pressed.
 */
function Dock({
  direction,
  layout,
  roomBelow,
  children,
}: {
  direction: 1 | -1
  layout: Breakpoint
  roomBelow: boolean
  children: ReactNode
}) {
  const present = useIsPresent()
  const reduced = usePrefersReducedMotion()
  return (
    <motion.div
      className={clsx(
        "pointer-events-none absolute inset-0 flex items-center justify-center",
        around(layout, roomBelow, true),
      )}
      custom={direction}
      variants={step}
      initial={reduced ? false : "enter"}
      animate="shown"
      exit={reduced ? undefined : "gone"}
      inert={!present}
      aria-hidden={!present || undefined}
    >
      {children}
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

