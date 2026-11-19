import rawFil from "./questionnaire.fil.json"
import raw from "./questionnaire.json"
import { LANGS, type Lang } from "./strings"

/*
 * The questionnaire and the order of the screens a respondent goes through. Its words are in two
 * files (Ian, 2026-11-19: the whole questionnaire in English or Filipino):
 *
 *   questionnaire.json      English, the validated instrument. GENERATED from the Google Form by
 *                           scripts/form_to_questionnaire.py: never edit it by hand.
 *   questionnaire.fil.json  Filipino. WRITTEN BY HAND, in the same shape: edit it there.
 *
 * English (`q`) is what the app works with: the answers saved, the groups and the keys all use its
 * words. Filipino is only ever shown. Both have the same screens, so the switch keeps the place.
 */

/** P = pilot (third year), Y1 and Y2 = first and second year, from the year level; T = test runs */
export type Group = "P" | "Y1" | "Y2" | "T"

export type ScaleStep = { value: number; label: string }
export type LikertItem = { n: number; id: string; text: string }
export type LikertPart = {
  id: string
  title: string
  directions: string
  stem: string
  scale: ScaleStep[]
  items: LikertItem[]
}
export type ProfileItem = {
  n: number
  id: string
  label: string
  type: "number" | "choice"
  options?: string[]
  /** the column for the "Other" text, when the item has an Other option */
  other?: string
}
export type ProfilePart = { id: string; title: string; directions: string; items: ProfileItem[] }

export type Questionnaire = {
  title: string
  description: string
  age_check: { question: string; options: string[]; stop_title: string; stop_message: string }
  consent: {
    title: string
    intro: string
    sections: { title: string; body: string }[]
    data_use: { prompt: string; options: string[] }
    fields: { name: string; signature: string; address: string }
    agree: { question: string; yes: string; no: string }
  }
  letter: { greeting: string; body: string }
  general_directions: { title: string; body: string }
  parts: [ProfilePart, ...LikertPart[]]
  pilot_only: { title: string; intro: string; question: string }
  closing_message: string
}

export const q = raw as unknown as Questionnaire
/** the questionnaire's words as shown in each language */
export const texts: Record<Lang, Questionnaire> = { en: q, fil: rawFil as unknown as Questionnaire }

/**
 * Part I as the respondents get it: the form's items without the age (Ian, 2026-11-19: not asked),
 * numbered again from 1. The Sheet has no column for it.
 */
const asked = (part: ProfilePart): ProfilePart => ({
  ...part,
  items: part.items.filter((i) => i.id !== "P1_age").map((item, i) => ({ ...item, n: i + 1 })),
})
const profiles: Record<Lang, ProfilePart> = { en: asked(q.parts[0]), fil: asked(texts.fil.parts[0]) }
export const profile = profiles.en
export const likertParts = q.parts.slice(1) as LikertPart[]
/** Part I and Parts II to V as shown in a language: the same items in the same places */
export const profileIn = (lang: Lang) => profiles[lang]
export const likertPartsIn = (lang: Lang) => texts[lang].parts.slice(1) as LikertPart[]

/** Part I's year level: first year, second year, and the pilot's third year (the form's words) */
const years = profile.items.find((i) => i.id === "P1_year")!.options!
export const PILOT_YEAR = years[2]

/** the pilot's question is for those who answer as the pilot's third years */
export const isPilot = (answers: Answers) => answers.P1_year === PILOT_YEAR

/** the respondent's group, from the year level they picked (blank if they skipped it) */
export function groupOf(answers: Answers, test: boolean): Group | "" {
  if (test) return "T"
  const i = years.indexOf(String(answers.P1_year ?? ""))
  return i < 0 ? "" : (["Y1", "Y2", "P"] as const)[i]
}

/**
 * "Part II. My Word Retrieval Difficulties" → { roman: "II", name: "My Word Retrieval Difficulties" },
 * and the same for the Filipino "Bahagi II. …"
 */
export function partName(title: string) {
  const m = title.match(/^(?:Part|Bahagi) ([IVX]+)\.\s*(.*)$/)
  return m ? { roman: m[1], name: m[2] } : { roman: "", name: title }
}

/** the answers so far, by column (P1_sex, P3_07, pilot_feedback …) */
export type Answers = Record<string, string | number>

export type ReadSection = "consent" | "letter" | "directions"

export type Screen =
  | { kind: "age" }
  | {
      kind: "read"
      section: ReadSection
      /** the heading; on the letter's first page, the greeting */
      title: string
      paragraphs: string[]
      /** page of the section (1-based) and how many there are */
      page: number
      pages: number
    }
  | { kind: "dataUse" }
  | { kind: "sign" }
  /** 0 is Part I */
  | { kind: "partIntro"; part: number }
  | { kind: "profile"; item: ProfileItem; ordinal: number; of: number }
  | { kind: "likert"; part: number; item: number }
  | { kind: "pilot" }
  | { kind: "review" }

export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/**
 * The most text a reading page holds, so that it fits on a small phone without scrolling; a longer
 * section goes on as many pages as it needs, split between paragraphs (never inside one).
 */
export const PAGE_CHARS = 800

/** which paragraphs (by their place) go on which page, from how long each is */
function pageGroups(sizes: number[], max = PAGE_CHARS): number[][] {
  const pages: number[][] = []
  let page: number[] = []
  let size = 0
  sizes.forEach((s, i) => {
    if (page.length && size + s > max) {
      pages.push(page)
      page = []
      size = 0
    }
    page.push(i)
    size += s
  })
  if (page.length) pages.push(page)
  return pages
}

export function paginate(paras: string[], max = PAGE_CHARS): string[][] {
  return pageGroups(paras.map((p) => p.length), max).map((page) => page.map((i) => paras[i]))
}

/**
 * A text's pages in one language. Each paragraph counts as the longer of its two versions, so both
 * languages break at the same places and have the same number of pages: the switch never moves a
 * respondent to another screen (Ian, 2026-11-19). The two files must have the same paragraphs
 * (survey.test.ts checks).
 */
function pagesIn(lang: Lang, pick: (text: Questionnaire) => string): string[][] {
  const versions = LANGS.map((l) => paragraphs(pick(texts[l])))
  const mine = paragraphs(pick(texts[lang]))
  const sizes = mine.map((_, i) => Math.max(...versions.map((v) => v[i]?.length ?? 0)))
  return pageGroups(sizes).map((page) => page.map((i) => mine[i]))
}

function readPages(section: ReadSection, pages: { title: string; paragraphs: string[] }[]): Screen[] {
  return pages.map((p, i) => ({ kind: "read", section, ...p, page: i + 1, pages: pages.length }))
}

/**
 * Every screen after the start, in order: the age check, the consent form (one section a page),
 * the data-use boxes, name and signature, the letter, the general directions, then each part (its
 * directions, then one item a page), the pilot's question (for the pilot's third years), and the
 * review before SUBMIT. The reading pages carry their words in `lang`; everything else is the same
 * screen in either language, and a Part I screen's `item` is always the English one (its options
 * are the answers saved).
 */
export function buildFlow(pilot: boolean, lang: Lang = "en"): Screen[] {
  const t = texts[lang]
  const screens: Screen[] = [{ kind: "age" }]
  const consentPages = [
    { title: t.consent.title, paragraphs: paragraphs(t.consent.intro) },
    ...t.consent.sections.flatMap((s, k) =>
      pagesIn(lang, (text) => text.consent.sections[k].body).map((ps) => ({ title: s.title, paragraphs: ps })),
    ),
  ]
  screens.push(...readPages("consent", consentPages))
  screens.push({ kind: "dataUse" }, { kind: "sign" })
  screens.push(
    ...readPages(
      "letter",
      pagesIn(lang, (text) => text.letter.body).map((ps, i) => ({
        title: i === 0 ? t.letter.greeting : "",
        paragraphs: ps,
      })),
    ),
  )
  screens.push(
    ...readPages("directions", [
      { title: t.general_directions.title, paragraphs: paragraphs(t.general_directions.body) },
    ]),
  )
  screens.push({ kind: "partIntro", part: 0 })
  profile.items.forEach((item, i) =>
    screens.push({ kind: "profile", item, ordinal: i + 1, of: profile.items.length }),
  )
  likertParts.forEach((part, p) => {
    screens.push({ kind: "partIntro", part: p + 1 })
    part.items.forEach((_, i) => screens.push({ kind: "likert", part: p + 1, item: i }))
  })
  if (pilot) screens.push({ kind: "pilot" })
  screens.push({ kind: "review" })
  return screens
}

/** the first screen after the consent form: BACK can't go from there into the signed form */
export function firstAfterConsent(flow: Screen[]) {
  return flow.findIndex((s) => s.kind === "read" && s.section === "letter")
}

/** a Likert screen's part and item: in English for what is saved, in `lang` for what is shown */
export function likertAt(screen: Extract<Screen, { kind: "likert" }>, lang: Lang = "en") {
  const part = likertPartsIn(lang)[screen.part - 1]
  return { part, item: part.items[screen.item] }
}

/** an item's short name in the review: II.3 is Part II, item 3 */
export function itemLabel(screen: Screen): string | null {
  if (screen.kind === "profile") return `I.${screen.item.n}`
  if (screen.kind === "likert") {
    const { part, item } = likertAt(screen)
    return `${partName(part.title).roman}.${item.n}`
  }
  return null
}

function answered(value: string | number | undefined) {
  return value !== undefined && String(value).trim() !== ""
}

/** The items with no answer, where they are in the flow. The pilot's question is optional. */
export function blanks(flow: Screen[], answers: Answers) {
  const out: { index: number; label: string }[] = []
  flow.forEach((screen, index) => {
    const id =
      screen.kind === "profile"
        ? screen.item.id
        : screen.kind === "likert"
          ? likertAt(screen).item.id
          : null
    if (id && !answered(answers[id])) out.push({ index, label: itemLabel(screen)! })
  })
  return out
}

/** how many items the respondent is asked */
export function askedCount(flow: Screen[]) {
  return flow.filter((s) => s.kind === "profile" || s.kind === "likert").length
}
