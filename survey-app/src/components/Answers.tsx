import clsx from "clsx"
import { Check } from "lucide-react"
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
}: {
  label: string
  options: string[]
  value: string | null
  onChoose: (option: string) => void
  compact: boolean
  other?: { value: string; onChange: (text: string) => void }
}) {
  const all = other ? [...options, OTHER] : options
  return (
    <div className="flex w-full flex-col gap-4">
      <div
        role="radiogroup"
        aria-label={label}
        className={clsx(
          "w-full",
          compact
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
                {option}
              </span>
            </button>
          )
        })}
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

/**
 * The five answers of a Likert item, from 5 to 1, left to right, each with its number and its
 * label ("5 Always"), as the validated instrument has them. Nothing is picked until the respondent
 * picks; one answer only.
 */
export function LikertScale({
  label,
  scale,
  value,
  onChoose,
  compact,
}: {
  label: string
  scale: { value: number; label: string }[]
  value: number | null
  onChoose: (value: number) => void
  compact: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={clsx("grid w-full grid-cols-5", compact ? "gap-[5px]" : "gap-3")}
    >
      {scale.map((step) => {
        const picked = value === step.value
        const s = look(picked)
        return (
          <button
            key={step.value}
            type="button"
            role="radio"
            aria-checked={picked}
            aria-label={`${step.value} ${step.label}`}
            onClick={() => onChoose(step.value)}
            className={clsx(
              "press flex min-w-0 flex-col items-center border [--press-depth:4px]",
              compact
                ? "h-[96px] gap-[7px] rounded-[8px] px-[2px] pt-[15px]"
                : "h-[124px] gap-[10px] rounded-[10px] px-2 pt-[22px]",
              s.box,
            )}
          >
            <span
              className={clsx(
                "leading-none font-[800]",
                compact ? "text-[26px]" : "text-[34px]",
                picked ? "text-brand" : "text-ink",
              )}
            >
              {step.value}
            </span>
            <span
              className={clsx(
                "text-center font-[700]",
                compact ? "text-[11px] leading-[13px]" : "text-[14px] leading-[17px]",
                picked ? "text-brand" : "text-ink-soft",
              )}
            >
              {step.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
