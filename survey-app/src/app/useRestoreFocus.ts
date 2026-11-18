import { useEffect, useState } from "react"

/**
 * Remember what had focus when this component was first rendered and give it back on unmount.
 * For overlays (exit dialog, full-screen slide) that pull focus in with `autoFocus`, so closing
 * them does not drop keyboard users at the top of the page. Captured during the first render,
 * because `autoFocus` has already moved focus by the time effects run.
 */
export function useRestoreFocus() {
  const [previous] = useState(() => document.activeElement)
  useEffect(
    () => () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    },
    [previous],
  )
}
