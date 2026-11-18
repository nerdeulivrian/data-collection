import clsx from "clsx"
import type { HTMLAttributes } from "react"

type Props = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  /** a line under the label (the code's "for example Y1-01") */
  help?: string
  error?: string | null
  autoFocus?: boolean
  maxLength?: number
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"]
  autoComplete?: string
  autoCapitalize?: string
  placeholder?: string
  /** a text box this many rows tall instead of one line */
  rows?: number
  /** the large centered field (the code, the age) */
  big?: boolean
  /** the label is there for screen readers only (the heading above already says it) */
  hideLabel?: boolean
}

/** A labelled text field: gray until it has the focus, then white with Tuwon's orange edge. */
export function TextField({
  id,
  label,
  value,
  onChange,
  help,
  error,
  autoFocus,
  maxLength,
  inputMode,
  autoComplete = "off",
  autoCapitalize,
  placeholder,
  rows,
  big = false,
  hideLabel = false,
}: Props) {
  const box = clsx(
    "w-full rounded-[12px] border-2 bg-surface px-4 text-ink-strong outline-none focus:bg-white focus-visible:outline-none",
    error ? "border-incorrect" : "border-line focus:border-brand",
  )
  const described = clsx(help && `${id}-help`, error && `${id}-error`) || undefined
  return (
    <div className="flex w-full flex-col gap-[6px]">
      <label
        htmlFor={id}
        className={clsx("text-[15px] leading-snug font-[700] text-ink-strong", hideLabel && "sr-only")}
      >
        {label}
      </label>
      {help && (
        <p id={`${id}-help`} className="-mt-[2px] text-[14px] leading-snug font-medium text-ink-secondary">
          {help}
        </p>
      )}
      {rows ? (
        <textarea
          id={id}
          rows={rows}
          value={value}
          maxLength={maxLength}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-describedby={described}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(box, "resize-none py-3 text-[16px] leading-[22px]")}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          maxLength={maxLength}
          autoFocus={autoFocus}
          inputMode={inputMode}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(
            box,
            big
              ? "h-[56px] text-center text-[22px] font-[700] tracking-[1px] placeholder:font-[500] placeholder:tracking-normal placeholder:text-ink-muted"
              : "h-[48px] text-[17px] placeholder:text-ink-muted",
          )}
        />
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[14px] leading-snug font-semibold text-incorrect-ink">
          {error}
        </p>
      )}
    </div>
  )
}
