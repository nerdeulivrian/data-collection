import clsx from "clsx"
import type { ButtonHTMLAttributes } from "react"

export type ButtonTone = "brand" | "correct" | "incorrect" | "outline" | "caution" | "skipped"

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone: ButtonTone
  /** md = 150×50 (desktop / tablet), sm = 130×44 (mobile), wide = full width × 50, fill = fills its
   *  parent; for longer words (YES, I AGREE): mdGrow = at least 150 wide, smGrow = the row's rest × 44 */
  size?: "md" | "sm" | "wide" | "fill" | "mdGrow" | "smGrow"
}

const toneClass: Record<ButtonTone, string> = {
  brand: "bg-brand text-white [--press-color:var(--color-brand-shadow)]",
  correct: "bg-correct text-white [--press-color:var(--color-correct-dark)]",
  incorrect: "bg-incorrect text-white [--press-color:var(--color-incorrect-dark)]",
  outline: "bg-white enabled:hover:bg-surface text-ink-button border border-line [--press-color:var(--color-line)]",
  // SURE? after a first SKIP tap: the white button, only its text light red (Ian, 2026-10-20)
  caution: "bg-white enabled:hover:bg-surface text-incorrect border border-line [--press-color:var(--color-line)]",
  // PROCEED after a confirmed SKIP: gray like the rest of that strip (Ian, 2026-10-20)
  skipped: "bg-skipped text-white [--press-color:var(--color-skipped-dark)]",
}

// the label: Duolingo's 15/18px, and 17/20px on the computer and tablet bar (Ian, 2026-10-20: "a bit"
// bigger there); phones keep 15
const sizeClass = {
  md: "w-[150px] h-[50px] text-[17px] leading-[20px]",
  sm: "w-[130px] h-[44px] text-[15px] leading-[18px]",
  wide: "w-full h-[50px] text-[15px] leading-[18px]",
  fill: "w-full h-full text-[15px] leading-[18px]",
  mdGrow: "min-w-[150px] px-6 h-[50px] text-[17px] leading-[20px]",
  smGrow: "flex-1 px-3 h-[44px] text-[15px] leading-[18px]",
}

/**
 * The 3D "press" button: hard bottom shadow, sinks by the shadow depth while pressed.
 * Disabled buttons turn gray but keep their shadow (they just do not press). The white one grays to
 * #f7f7f7 on hover like the options and the icon squares (Ian, 2026-10-20), only where hover exists.
 */
export function PressButton({ tone, size = "md", className, disabled, children, ...rest }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={clsx(
        // Duolingo's button label, read off their CONTINUE (Ian, 2026-10-20): weight 700, .8px tracking
        // (size per button size, below). Tuwon Sans at 700 has the same stems and width as their font at 700
        "press inline-flex shrink-0 items-center justify-center rounded-md font-[700] tracking-[0.8px] uppercase",
        disabled
          ? tone === "outline"
            ? "border border-line bg-white text-line [--press-color:var(--color-line)]"
            : "bg-line text-ink-button [--press-color:var(--color-line-shadow)]"
          : toneClass[tone],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
