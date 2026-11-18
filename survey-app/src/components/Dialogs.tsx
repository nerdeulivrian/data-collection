import clsx from "clsx"
import { DialogFrame } from "./DialogFrame"
import { PressButton } from "./PressButton"
import { optionStyle } from "./optionStyles"

/**
 * Tuwon's quit dialog, with the words given: the orange button stays (it has the focus, and Escape
 * and a tap on the backdrop do the same), the red word below it leaves.
 */
export function ConfirmDialog({
  title,
  body,
  stay,
  leave,
  onStay,
  onLeave,
}: {
  title: string
  body: string
  stay: string
  leave: string
  onStay: () => void
  onLeave: () => void
}) {
  return (
    <DialogFrame labelledBy="confirm-title" onDismiss={onStay}>
      <div className="flex flex-col gap-1">
        <h2 id="confirm-title" className="text-[20px] font-black text-ink-strong">
          {title}
        </h2>
        <p className="text-[16px] leading-snug font-semibold text-ink">{body}</p>
      </div>
      <PressButton tone="brand" size="wide" autoFocus onClick={onStay}>
        {stay}
      </PressButton>
      <button
        type="button"
        onClick={onLeave}
        className="-my-3 flex min-h-[44px] items-center px-4 text-[15px] font-[700] tracking-[0.8px] text-incorrect-ink uppercase"
      >
        {leave}
      </button>
    </DialogFrame>
  )
}

/** past this many, the last place says how many more */
const MAX_TILES = 15

/**
 * Tuwon's blanks dialog (an assessment's SUBMIT with questions left blank), for the questionnaire:
 * it names the items left blank (II.3 is Part II, item 3), a tile goes to that item, GO BACK to
 * the first one, and SUBMIT ANYWAY hands the answers in as they are (skipping is allowed: the
 * consent form promises it).
 */
export function BlanksDialog({
  blanks,
  onGoTo,
  onSubmit,
  onStay,
}: {
  blanks: { index: number; label: string }[]
  onGoTo: (index: number) => void
  onSubmit: () => void
  onStay: () => void
}) {
  const n = blanks.length
  const shown = n > MAX_TILES ? blanks.slice(0, MAX_TILES - 1) : blanks
  const more = n - shown.length
  return (
    <DialogFrame labelledBy="blanks-title" onDismiss={onStay}>
      <div className="flex flex-col gap-1">
        <h2 id="blanks-title" className="text-[20px] font-extrabold text-ink-strong">
          <span className="text-incorrect">
            {n} {n === 1 ? "item" : "items"}
          </span>{" "}
          left blank
        </h2>
        <p className="text-[16px] leading-snug font-semibold text-ink">Submit anyway?</p>
      </div>
      <ul aria-label="Items left blank" className="flex flex-wrap justify-center gap-x-2 gap-y-3">
        {shown.map((b) => (
          <li key={b.index}>
            <button
              type="button"
              aria-label={`Go to item ${b.label}`}
              onClick={() => onGoTo(b.index)}
              className={clsx(
                "press flex h-[44px] min-w-[44px] items-center justify-center rounded-[8px] border px-2 text-[15px] font-[700] text-incorrect [--press-depth:4px]",
                optionStyle.unselected.box,
              )}
            >
              {b.label}
            </button>
          </li>
        ))}
        {more > 0 && (
          <li className="flex h-[44px] min-w-[44px] items-center justify-center text-[15px] font-[700] text-incorrect">
            +{more}
          </li>
        )}
      </ul>
      <div className="flex w-full flex-col gap-4">
        <PressButton tone="brand" size="wide" autoFocus onClick={() => onGoTo(blanks[0].index)}>
          Go back
        </PressButton>
        <PressButton tone="caution" size="wide" onClick={onSubmit}>
          Submit anyway
        </PressButton>
      </div>
    </DialogFrame>
  )
}
