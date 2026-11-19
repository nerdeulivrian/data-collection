import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { loadLang, saveLang } from "@/storage"
import { strings, type Lang, type Strings } from "@/strings"

type Language = { lang: Lang; setLang: (lang: Lang) => void }

/** English where nothing provides a language (the researchers' page) */
const LanguageContext = createContext<Language>({ lang: "en", setLang: () => {} })

/**
 * The questionnaire's language, English or Filipino (Ian, 2026-11-19): picked with the switch in
 * the strip and remembered on the phone. The page's own language and title follow it.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadLang)
  useEffect(() => {
    document.documentElement.lang = lang
    document.title = strings[lang].pageTitle
  }, [lang])
  const setLang = (next: Lang) => {
    saveLang(next)
    setLangState(next)
  }
  return <LanguageContext value={{ lang, setLang }}>{children}</LanguageContext>
}

export const useLanguage = () => useContext(LanguageContext)

/** the app's own words in the language picked */
export const useStrings = (): Strings => strings[useContext(LanguageContext).lang]
