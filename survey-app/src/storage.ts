import type { Lang } from "./strings"
import type { Answers } from "./survey"

/**
 * Progress kept on the phone as the respondent goes, so a dropped connection or a closed tab loses
 * nothing: one questionnaire at a time. Nothing here is sent anywhere; it is forgotten once the
 * answers are submitted. The name, signature and address are kept only until the consent form is
 * sent.
 */
export type Session = {
  v: 2
  /** this questionnaire's own id (R-…, T-… for a test run): ties its consent to its answers */
  id: string
  /** opened as …/?test: kept apart from the real answers */
  test: boolean
  /** left with EXIT after the consent form: the start screen offers to continue */
  paused: boolean
  /** the screen the respondent is on (survey.ts buildFlow) */
  at: number
  age: string | null
  dataUse: number[]
  name: string
  signature: string
  address: string
  consented: boolean
  answers: Answers
  /** when the letter first showed, by this phone's clock; the duration is measured from here */
  startedAt: number | null
}

const KEY = "wrd-survey:session"

/** letters and digits that can't be mistaken for one another */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/** R- and eight random characters (T- for a test run): about a trillion possible ids */
export function newId(test: boolean): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return (test ? "T-" : "R-") + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")
}

export function newSession(test: boolean): Session {
  return {
    v: 2,
    id: newId(test),
    test,
    paused: false,
    at: 0,
    age: null,
    dataUse: [],
    name: "",
    signature: "",
    address: "",
    consented: false,
    answers: {},
    startedAt: null,
  }
}

/** the questionnaire left on this phone, if any */
export function loadSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null")
    return s && s.v === 2 && typeof s.id === "string" ? (s as Session) : null
  } catch {
    return null
  }
}

export function saveSession(s: Session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // private browsing with storage off: the questionnaire still works, it just can't resume
  }
}

/** submitted, declined, started over, or left before the consent form: nothing of it stays */
export function forgetSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing kept */
  }
}

/** its own key, so the language stays when a questionnaire is submitted or forgotten (Ian, 2026-11-19) */
const LANG_KEY = "wrd-survey:lang"

/** the language picked on this phone: English, the validated instrument's language, until Filipino is picked */
export function loadLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === "fil" ? "fil" : "en"
  } catch {
    return "en"
  }
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    /* not kept: the switch still works until the page is closed */
  }
}
