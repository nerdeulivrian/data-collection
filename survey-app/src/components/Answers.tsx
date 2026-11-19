import clsx from "clsx"
import { Check } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState, type KeyboardEvent, type PointerEvent } from "react"
import { popIn, presence, usePrefersReducedMotion } from "@/design/motion"
import { look } from "./optionStyles"
import { TextField } from "./TextField"

/** the extra option on Part I items 5 and 6, as the form has it */
export const OTHER = "Other"

/**
 * One answer from a few, as Tuwon's multiple-choice cards: one column on a phone, two columns from
 * 560px up, short answers alone in the middle of their card. Picked is orange. With `other`, an
 * "Other" card opens a text field under the cards.
 */
export function ChoiceCards({
  label,
  options,
  value,
  onChoose,
  compact,
  other,
  shownOnly = [],
  shownAs = {},
  stacked = false,
}: {
  label: string
  options: string[]
  value: string | null
  onChoose: (option: string) => void
  compact: boolean
  other?: { value: string; onChange: (text: string) => void }
  /** cards after the options that are shown but can't be picked ("Fourth year": not in the study) */
  shownOnly?: string[]
  /** other words on a card than the option's own; the answer saved is still the option */
  shownAs?: Record<string, string>
  /** one card under another at every width, in a narrower column from a tablet up */
  stacked?: boolean
}) {
  const all = other ? [...options, OTHER] : options
  return (
    <div className="flex w-full flex-col gap-4">
      <div
        role="radiogroup"
        aria-label={label}
        // the answers of a question, for the keys (App.tsx)
        data-answers
        className={clsx(
          "w-full",
          stacked
            ? "mx-auto flex max-w-[400px] flex-col gap-3"
            : compact
              ? "flex flex-col gap-3 min-[560px]:grid min-[560px]:grid-cols-2 min-[560px]:gap-x-4"
              : "grid grid-cols-2 gap-x-4 gap-y-3",
        )}
      >
        {all.map((option) => {
          const s = look(value === option)
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={value === option}
              onClick={() => onChoose(option)}
              className={clsx(
                "press flex w-full items-center justify-center border text-center [--press-depth:4px]",
                compact ? "min-h-[48px] rounded-[7px] p-[10px]" : "min-h-[64px] rounded-[8px] p-4",
                s.box,
              )}
            >
              <span className={clsx("font-normal", compact ? "text-[16px]" : "text-[18px]", s.text)}>
                {shownAs[option] ?? option}
              </span>
            </button>
          )
        })}
        {shownOnly.map((option) => (
          <button
            key={option}
            type="button"
            disabled
            className={clsx(
              "flex w-full items-center justify-center border border-line bg-surface text-center",
              compact ? "min-h-[48px] rounded-[7px] p-[10px]" : "min-h-[64px] rounded-[8px] p-4",
            )}
          >
            <span className={clsx("font-normal text-ink-muted", compact ? "text-[16px]" : "text-[18px]")}>{option}</span>
          </button>
        ))}
      </div>
      {other && value === OTHER && (
        <TextField
          id="other"
          label="Please specify"
          value={other.value}
          onChange={other.onChange}
          autoFocus
          maxLength={100}
        />
      )}
    </div>
  )
}

/**
 * Tick one or more (the consent form's data-use boxes): long sentences, so each card has a square
 * on the left that fills orange with a tick.
 */
export function CheckCards({
  label,
  options,
  values,
  onToggle,
  compact,
}: {
  label: string
  options: string[]
  /** the ticked options, numbered from 1 */
  values: number[]
  onToggle: (n: number) => void
  compact: boolean
}) {
  return (
    <div role="group" aria-label={label} className={clsx("flex w-full flex-col", compact ? "gap-3" : "gap-4")}>
      {options.map((option, i) => {
        const n = i + 1
        const ticked = values.includes(n)
        const s = look(ticked)
        return (
          <button
            key={n}
            type="button"
            role="checkbox"
            aria-checked={ticked}
            onClick={() => onToggle(n)}
            className={clsx(
              "press flex w-full items-start border text-left [--press-depth:4px]",
              compact ? "gap-3 rounded-[7px] p-3" : "gap-4 rounded-[8px] p-4",
              s.box,
            )}
          >
            <span
              className={clsx(
                "flex shrink-0 items-center justify-center border",
                compact ? "mt-[1px] h-5 w-5 rounded-[4px]" : "mt-[2px] h-6 w-6 rounded-[5px]",
                s.badge,
              )}
            >
              {ticked && <Check size={compact ? 14 : 16} strokeWidth={3} aria-hidden />}
            </span>
            <span
              className={clsx(
                "min-w-0 flex-1 font-normal",
                compact ? "text-[14px] leading-[20px]" : "text-[16px] leading-[24px]",
                ticked ? "text-brand-ink" : "text-ink",
              )}
            >
              {option}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** the slider's height, the same whatever the labels: three lines of label over the stops */
export const likertSliderHeight = (compact: boolean) => (compact ? "h-[92px]" : "h-[116px]")

/**
 * The five answers of a Likert item as a slider with a stop for each, from 5 to 1, left to right,
 * each with its number and its label ("5 Always"), as the validated instrument has them. Nothing is
 * picked until the respondent picks: there is no knob until a stop is tapped (or 1–5 pressed).
 * From then the knob can be slid along, and it settles on the nearest stop: one answer only. The
 * track has no fill, which would make one end look like more than the other. To a screen reader
 * these are five radio buttons, and the arrow keys move from one to the next.
 */
export function LikertSlider({
  label,
  scale,
  value,
  onChoose,
  compact,
  itemKey,
}: {
  label: string
  scale: { value: number; label: string }[]
  value: number | null
  onChoose: (value: number) => void
  compact: boolean
  /** the item being answered: a new item gets a new knob (the last answer's doesn't slide over) */
  itemKey: string
}) {
  const reduced = usePrefersReducedMotion()
  /** while the knob is held: where it is, as a fraction of the slider's width */
  const [held, setHeld] = useState<number | null>(null)
  const n = scale.length
  const index = scale.findIndex((s) => s.value === value)
  const choose = (i: number) => {
    if (i !== index) onChoose(scale[i].value)
  }
  const stopsOf = (slider: HTMLElement) => [...slider.querySelectorAll<HTMLElement>('[role="radio"]')]
  /** the knob follows the finger between the end stops, and the nearest stop is the answer */
  const follow = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const edge = 0.5 / n
    const at = Math.min(1 - edge, Math.max(edge, (e.clientX - box.left) / box.width))
    const to = Math.min(n - 1, Math.max(0, Math.round(at * n - 0.5)))
    setHeld(at)
    choose(to)
    // with the focus on a stop (a press puts it there), it follows the knob, so the keys go on
    // from the answer. Never brought in from elsewhere: that would draw the keyboard's focus ring
    const stops = stopsOf(e.currentTarget)
    if (stops.includes(document.activeElement as HTMLElement)) stops[to]?.focus({ preventScroll: true })
  }
  const letGo = () => setHeld(null)
  /** the arrow keys move the knob a stop: from where it is, or from the stop in focus if there is none yet */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const move =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
    if (!move) return
    const stops = stopsOf(e.currentTarget)
    const from = index >= 0 ? index : stops.indexOf(e.target as HTMLElement)
    if (from < 0) return
    e.preventDefault()
    const to = Math.min(n - 1, Math.max(0, from + move))
    choose(to)
    stops[to].focus()
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      // the answers of a question, for the keys (App.tsx)
      data-answers
      className={clsx(
        "relative grid w-full cursor-pointer touch-none grid-cols-5 select-none",
        likertSliderHeight(compact),
      )}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        follow(e)
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) follow(e)
      }}
      onPointerUp={letGo}
      onPointerCancel={letGo}
      onLostPointerCapture={letGo}
      onKeyDown={onKeyDown}
    >
      {/* the track, from the first stop to the last */}
      <span
        aria-hidden
        className={clsx(
          "pointer-events-none absolute rounded-pill bg-line",
          compact ? "bottom-[21px] h-[6px]" : "bottom-[25px] h-[8px]",
        )}
        style={{ left: `${50 / n}%`, right: `${50 / n}%` }}
      />
      {scale.map((step, i) => {
        const picked = i === index
        return (
          <button
            key={step.value}
            type="button"
            role="radio"
            aria-checked={picked}
            aria-label={`${step.value} ${step.label}`}
            tabIndex={i === Math.max(index, 0) ? 0 : -1}
            onClick={() => choose(i)}
            className="group relative flex min-w-0 cursor-pointer flex-col items-center justify-end"
          >
            <span
              className={clsx(
                "text-center font-[700] text-balance",
                compact ? "mb-[3px] px-[1px] text-[11px] leading-[13px]" : "mb-1 px-1 text-[14px] leading-[17px]",
                picked ? "text-brand" : "text-ink-soft",
              )}
            >
              {/* a label of two words stands on two lines at every width ("Strongly / Agree") */}
              {step.label.split(" ").length === 2 ? (
                <>
                  {step.label.split(" ")[0]}
                  <br />
                  {step.label.split(" ")[1]}
                </>
              ) : (
                step.label
              )}
            </span>
            <span className={clsx("flex shrink-0 items-center justify-center", compact ? "h-[48px]" : "h-[58px]")}>
              <span
                className={clsx(
                  "flex items-center justify-center rounded-full border-2 border-line bg-white font-[800] text-ink-soft shadow-[0_3px_0_0_var(--color-line)] group-hover:bg-surface",
                  compact ? "h-[30px] w-[30px] text-[15px]" : "h-[36px] w-[36px] text-[18px]",
                )}
              >
                {step.value}
              </span>
            </span>
          </button>
        )
      })}
      {/* the knob: on the picked stop, or under the finger while it is held */}
      <AnimatePresence initial={false}>
        {index >= 0 && (
          <span
            key={itemKey}
            aria-hidden
            className={clsx(
              "pointer-events-none absolute -translate-x-1/2",
              compact ? "bottom-[4px]" : "bottom-[5px]",
              held === null && !reduced && "transition-[left] duration-150 ease-out",
            )}
            style={{ left: `${(held ?? (index + 0.5) / n) * 100}%` }}
          >
            <motion.span className="block" {...presence(popIn, reduced)}>
              <span
                className={clsx(
                  "press flex items-center justify-center rounded-full bg-brand font-[800] text-white [--press-color:var(--color-brand-shadow)]",
                  compact ? "h-10 w-10 text-[19px] [--press-depth:4px]" : "h-12 w-12 text-[23px] [--press-depth:5px]",
                  held !== null && "is-pressed",
                )}
              >
                {scale[index].value}
              </span>
            </motion.span>
          </span>
        )}
      </AnimatePresence>
    </div>
  )
}
