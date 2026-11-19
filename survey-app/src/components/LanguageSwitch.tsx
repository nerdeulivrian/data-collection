import clsx from "clsx"
import { useLanguage } from "@/app/language"
import { LANGS, strings } from "@/strings"

/**
 * The language switch in the strip, beside the exit button (Ian, 2026-11-19): EN | FIL, the one in
 * use filled orange. As tall as the exit button, each half with a 44px tap target on a phone. To a
 * screen reader these are two toggle buttons named "English" and "Filipino".
 */
export function LanguageSwitch({ big = false }: { big?: boolean }) {
  const { lang, setLang } = useLanguage()
  return (
    <div
      role="group"
      aria-label={strings[lang].language}
      data-language-switch
      className={clsx(
        "flex shrink-0 border border-line bg-white",
        big ? "h-[36px] rounded-md" : "h-[23px] rounded-sm",
      )}
    >
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-label={strings[l].name}
          title={strings[l].name}
          aria-pressed={l === lang}
          onClick={() => setLang(l)}
          className={clsx(
            "relative flex h-full items-center justify-center font-extrabold tracking-[0.8px] uppercase before:absolute before:inset-x-0 before:content-['']",
            // the corners follow the frame's, inside its 1px edge
            big
              ? "w-[52px] text-[13px] before:-inset-y-[5px] first:rounded-l-[9px] last:rounded-r-[9px]"
              : "w-[44px] text-[11px] before:-inset-y-[12px] first:rounded-l-[4px] last:rounded-r-[4px]",
            l === lang ? "bg-brand text-white" : "text-ink-secondary hover:bg-surface",
          )}
        >
          {strings[l].short}
        </button>
      ))}
    </div>
  )
}
