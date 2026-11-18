/** Tuwon's option looks (tuwon-player components/questions/optionStyles.ts): picked is orange. */
export const optionStyle = {
  unselected: {
    box: "border-line bg-white enabled:hover:bg-surface [--press-color:var(--color-line)]",
    badge: "border-line bg-transparent text-ink-button",
    text: "text-ink-soft",
  },
  selected: {
    box: "border-brand bg-brand-tint [--press-color:var(--color-brand)]",
    badge: "border-brand bg-brand text-white",
    text: "text-brand",
  },
}

export const look = (picked: boolean) => (picked ? optionStyle.selected : optionStyle.unselected)
