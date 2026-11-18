import { useSyncExternalStore } from "react"

/** Tuwon's breakpoints: mobile < 755px, tablet 755–1024px, desktop > 1024px. */
export type Breakpoint = "mobile" | "tablet" | "desktop"

const TABLET_QUERY = "(min-width: 755px)"
const DESKTOP_QUERY = "(min-width: 1025px)"

function read(): Breakpoint {
  if (typeof window === "undefined") return "desktop"
  if (window.matchMedia(DESKTOP_QUERY).matches) return "desktop"
  if (window.matchMedia(TABLET_QUERY).matches) return "tablet"
  return "mobile"
}

function subscribe(onChange: () => void) {
  const queries = [window.matchMedia(TABLET_QUERY), window.matchMedia(DESKTOP_QUERY)]
  queries.forEach((q) => q.addEventListener("change", onChange))
  return () => queries.forEach((q) => q.removeEventListener("change", onChange))
}

export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, read, () => "desktop")
}
