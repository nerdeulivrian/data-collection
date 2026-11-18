import { useEffect } from "react"

/** a tap's press shows at least this long: the Android app's 100 ms, as Android's own buttons */
export const TAP_PRESS_MS = 100
/** on a screen that scrolls, a browser holds a finger's press back about this long, to tell a tap
 *  from a scroll */
const HELD_BACK_MS = 100

/**
 * How much longer a 3D button stays sunk once a tap on it is complete, so that the press has shown
 * for TAP_PRESS_MS. A mouse's press shows from the moment it goes down. A finger's, on a screen
 * that scrolls, shows only after HELD_BACK_MS, or not at all when the tap is over sooner: then it
 * shows from the tap's end. 0 when the press has already shown that long.
 */
export function tapHoldMs(pointerType: string, downAt: number, clickAt: number): number {
  const shownFrom = pointerType === "mouse" ? downAt : Math.min(downAt + HELD_BACK_MS, clickAt)
  return Math.max(0, Math.round(shownFrom + TAP_PRESS_MS - clickAt))
}

/**
 * A quick tap on a 3D button shows its press (Ian, 2026-11-10: tapping an answer showed none). The
 * browser's own :active lasts only as long as the button is held: a trackpad tap is down and up
 * within a millisecond (measured on Ian's taps), too short to draw a frame, and for a finger on a
 * scrolling screen, where the answers are, a browser holds the press back to tell a tap from a
 * scroll. Once a tap is complete, the button stays sunk until the press has shown for
 * TAP_PRESS_MS, as in the Android app. A press that turns into a scroll is no tap and sinks
 * nothing. An attribute rather than a class, so a re-render of the button (an answer turning
 * orange) can't take it off.
 */
export function useTapSink() {
  useEffect(() => {
    let down: { button: Element; at: number; pointerType: string } | null = null
    let sunk: Element | null = null
    let timer = 0
    const rise = () => {
      clearTimeout(timer)
      sunk?.removeAttribute("data-tap-pressed")
      sunk = null
    }
    const pressOf = (target: EventTarget | null) =>
      target instanceof Element ? target.closest(".press") : null
    const onDown = (e: PointerEvent) => {
      const button = pressOf(e.target)
      down =
        button && !button.matches(":disabled")
          ? { button, at: e.timeStamp, pointerType: e.pointerType }
          : null
    }
    const onCancel = () => {
      down = null
    }
    const onClick = (e: MouseEvent) => {
      const d = down
      down = null
      // detail 0: a key pressed it (Enter and Space sink it their own way)
      if (!d || e.detail === 0 || pressOf(e.target) !== d.button) return
      const ms = tapHoldMs(d.pointerType, d.at, e.timeStamp)
      if (ms === 0) return
      rise()
      sunk = d.button
      sunk.setAttribute("data-tap-pressed", "")
      timer = window.setTimeout(rise, ms)
    }
    document.addEventListener("pointerdown", onDown, true)
    document.addEventListener("pointercancel", onCancel, true)
    document.addEventListener("click", onClick, true)
    return () => {
      rise()
      document.removeEventListener("pointerdown", onDown, true)
      document.removeEventListener("pointercancel", onCancel, true)
      document.removeEventListener("click", onClick, true)
    }
  }, [])
}
