import { describe, expect, it } from "vitest"
import { newSession } from "./storage"
import {
  askedCount,
  blanks,
  buildFlow,
  firstAfterConsent,
  groupOf,
  isPilot,
  itemLabel,
  likertAt,
  likertParts,
  paginate,
  PAGE_CHARS,
  PILOT_YEAR,
  profile,
  q,
} from "./survey"

describe("the questionnaire", () => {
  it("has all 55 items: 6 profile, then 8, 21, 10 and 10 Likert", () => {
    expect(profile.items.map((i) => i.id)).toEqual([
      "P1_age",
      "P1_sex",
      "P1_year",
      "P1_l1",
      "P1_home",
      "P1_engfreq",
    ])
    expect(profile.items.map((i) => i.n)).toEqual([1, 2, 3, 4, 5, 6])
    expect(likertParts.map((p) => p.items.length)).toEqual([8, 21, 10, 10])
  })

  it("asks the year level in the form's words, the pilot's last", () => {
    expect(profile.items[2]).toMatchObject({
      type: "choice",
      options: ["First year", "Second year", "Third year (pilot test only)"],
    })
    expect(PILOT_YEAR).toBe("Third year (pilot test only)")
  })

  it("keeps every Likert scale from 5 to 1, each with its label", () => {
    for (const part of likertParts) {
      expect(part.scale.map((s) => s.value)).toEqual([5, 4, 3, 2, 1])
      expect(part.scale.every((s) => s.label.length > 0)).toBe(true)
    }
    expect(likertParts[3].scale[2].label).toBe("Neither Agree nor Disagree")
  })

  it("keeps the item order and numbers, and the Part III and IV stems", () => {
    for (const part of likertParts) {
      expect(part.items.map((i) => i.n)).toEqual(part.items.map((_, k) => k + 1))
    }
    expect(likertParts[1].stem).toBe("When I cannot remember an English word while I am speaking, . . .")
    expect(likertParts[2].stem).toBe("I have trouble remembering English words when . . .")
  })
})

describe("the flow", () => {
  const flow = buildFlow(false)

  it("goes age → consent → letter → directions → parts → review", () => {
    const kinds = flow.map((s) => s.kind)
    expect(kinds[0]).toBe("age")
    expect(kinds.indexOf("dataUse")).toBeGreaterThan(kinds.indexOf("read"))
    expect(kinds.indexOf("sign")).toBe(kinds.indexOf("dataUse") + 1)
    expect(flow[firstAfterConsent(flow)]).toMatchObject({ kind: "read", section: "letter", page: 1 })
    expect(kinds.at(-1)).toBe("review")
    expect(kinds).not.toContain("pilot")
  })

  it("asks one item per screen, in order", () => {
    expect(askedCount(flow)).toBe(6 + 49)
    const ids = flow.flatMap((s) =>
      s.kind === "profile" ? [s.item.id] : s.kind === "likert" ? [likertAt(s).item.id] : [],
    )
    expect(ids.slice(0, 6)).toEqual(profile.items.map((i) => i.id))
    expect(ids[6]).toBe("P2_01")
    expect(ids.at(-1)).toBe("P5_10")
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("shows each part's directions before its items", () => {
    const intros = flow.flatMap((s, i) => (s.kind === "partIntro" ? [[s.part, i]] : []))
    expect(intros.map(([p]) => p)).toEqual([0, 1, 2, 3, 4])
    for (const [, i] of intros) expect(["profile", "likert"]).toContain(flow[i + 1].kind)
  })

  it("adds the pilot's question, at the end, for the pilot's year level only", () => {
    expect(buildFlow(true).map((s) => s.kind).at(-2)).toBe("pilot")
    expect(buildFlow(true)).toHaveLength(flow.length + 1)
    expect(isPilot({ P1_year: PILOT_YEAR })).toBe(true)
    expect(isPilot({ P1_year: "Second year" })).toBe(false)
    expect(isPilot({})).toBe(false)
  })

  it("keeps every word of the consent form, the letter and the directions", () => {
    const text = (section: string) =>
      flow
        .filter((s) => s.kind === "read" && s.section === section)
        .flatMap((s) => (s.kind === "read" ? s.paragraphs : []))
        .join("\n\n")
    const whole = [q.consent.intro, ...q.consent.sections.map((s) => s.body)].join("\n\n")
    expect(text("consent").replace(/\s+/g, " ")).toBe(whole.replace(/\s+/g, " "))
    expect(text("letter").replace(/\s+/g, " ")).toBe(q.letter.body.replace(/\s+/g, " "))
    expect(text("directions").replace(/\s+/g, " ")).toBe(q.general_directions.body.replace(/\s+/g, " "))
  })

  it("splits long sections between paragraphs only", () => {
    expect(paginate(["a".repeat(500), "b".repeat(500), "c".repeat(100)])).toEqual([
      ["a".repeat(500)],
      ["b".repeat(500), "c".repeat(100)],
    ])
    expect(paginate(["x".repeat(PAGE_CHARS + 50)])).toHaveLength(1)
  })
})

describe("blanks", () => {
  const flow = buildFlow(true)

  it("lists every unanswered item, by part and number", () => {
    const all = blanks(flow, {})
    expect(all).toHaveLength(55)
    expect(all[0].label).toBe("I.1")
    expect(all.find((b) => b.label === "III.21")).toBeTruthy()
  })

  it("counts an answer of any kind, and never the optional pilot question", () => {
    const answers = { P1_age: "19", P2_01: 3, P1_sex: "  " }
    const left = blanks(flow, answers).map((b) => b.label)
    expect(left).not.toContain("I.1")
    expect(left).not.toContain("II.1")
    expect(left).toContain("I.2")
    expect(left).toHaveLength(53)
  })

  it("labels point at their screens", () => {
    for (const b of blanks(flow, {})) expect(itemLabel(flow[b.index])).toBe(b.label)
  })
})

describe("groups and ids", () => {
  it("takes the group from the year level, and a test run is always T", () => {
    expect(groupOf({ P1_year: "First year" }, false)).toBe("Y1")
    expect(groupOf({ P1_year: "Second year" }, false)).toBe("Y2")
    expect(groupOf({ P1_year: PILOT_YEAR }, false)).toBe("P")
    expect(groupOf({}, false)).toBe("")
    expect(groupOf({ P1_year: "First year" }, true)).toBe("T")
  })

  it("gives each questionnaire its own id, T- for a test run", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newSession(false).id))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(/^R-[A-HJ-NP-Z2-9]{8}$/)
    expect(newSession(true).id).toMatch(/^T-[A-HJ-NP-Z2-9]{8}$/)
  })
})
