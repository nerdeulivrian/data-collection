import raw from "./questionnaire.json"

/*
 * The questionnaire (all its words come from questionnaire.json, made from the Google Form by
 * scripts/form_to_questionnaire.py) and the order of the screens a respondent goes through.
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
/**
 * Part I as the respondents get it: the form's items without the age (Ian, 2026-11-19: not asked),
 * numbered again from 1. The Sheet keeps its `P1_age` column, which stays empty.
 */
export const profile: ProfilePart = {
  ...q.parts[0],
  items: q.parts[0].items.filter((i) => i.id !== "P1_age").map((item, i) => ({ ...item, n: i + 1 })),
}
export const likertParts = q.parts.slice(1) as LikertPart[]

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

/** "Part II. My Word Retrieval Difficulties" → { roman: "II", name: "My Word Retrieval Difficulties" } */
export function partName(title: string) {
  const m = title.match(/^Part ([IVX]+)\.\s*(.*)$/)
  return m ? { roman: m[1], name: m[2] } : { roman: "", name: title }
}

/** the answers so far, by column (P1_age, P3_07, pilot_feedback …) */
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

export function paginate(paras: string[], max = PAGE_CHARS): string[][] {
  const pages: string[][] = []
  let page: string[] = []
  let size = 0
  for (const p of paras) {
    if (page.length && size + p.length > max) {
      pages.push(page)
      page = []
      size = 0
    }
    page.push(p)
    size += p.length
  }
  if (page.length) pages.push(page)
  return pages
}

function readPages(section: ReadSection, pages: { title: string; paragraphs: string[] }[]): Screen[] {
  return pages.map((p, i) => ({ kind: "read", section, ...p, page: i + 1, pages: pages.length }))
}

/**
 * Every screen after the start, in order: the age check, the consent form (one section a page),
 * the data-use boxes, name and signature, the letter, the general directions, then each part (its
 * directions, then one item a page), the pilot's question (for the pilot's third years), and the
 * review before SUBMIT.
 */
export function buildFlow(pilot: boolean): Screen[] {
  const screens: Screen[] = [{ kind: "age" }]
  const consentPages = [
    { title: q.consent.title, paragraphs: paragraphs(q.consent.intro) },
    ...q.consent.sections.flatMap((s) =>
      paginate(paragraphs(s.body)).map((ps) => ({ title: s.title, paragraphs: ps })),
    ),
  ]
  screens.push(...readPages("consent", consentPages))
  screens.push({ kind: "dataUse" }, { kind: "sign" })
  screens.push(
    ...readPages(
      "letter",
      paginate(paragraphs(q.letter.body)).map((ps, i) => ({
        title: i === 0 ? q.letter.greeting : "",
        paragraphs: ps,
      })),
    ),
  )
  screens.push(
    ...readPages("directions", [
      { title: q.general_directions.title, paragraphs: paragraphs(q.general_directions.body) },
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

export function likertAt(screen: Extract<Screen, { kind: "likert" }>) {
  const part = likertParts[screen.part - 1]
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
