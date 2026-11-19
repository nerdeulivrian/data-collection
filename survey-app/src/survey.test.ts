import { describe, expect, it } from "vitest"
import { newSession } from "./storage"
import { strings } from "./strings"
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
  likertPartsIn,
  paginate,
  PAGE_CHARS,
  paragraphs,
  partName,
  PILOT_YEAR,
  profile,
  profileIn,
  q,
  texts,
  type Screen,
} from "./survey"

describe("the questionnaire", () => {
  it("has all 54 items: 5 profile (the form's, without the age), then 8, 21, 10 and 10 Likert", () => {
    expect(profile.items.map((i) => i.id)).toEqual([
      "P1_sex",
      "P1_year",
      "P1_l1",
      "P1_home",
      "P1_engfreq",
    ])
    expect(profile.items.map((i) => i.n)).toEqual([1, 2, 3, 4, 5])
    expect(likertParts.map((p) => p.items.length)).toEqual([8, 21, 10, 10])
  })

  it("asks the year level in the form's words, the pilot's last", () => {
    expect(profile.items[1]).toMatchObject({
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
    expect(askedCount(flow)).toBe(5 + 49)
    const ids = flow.flatMap((s) =>
      s.kind === "profile" ? [s.item.id] : s.kind === "likert" ? [likertAt(s).item.id] : [],
    )
    expect(ids.slice(0, 5)).toEqual(profile.items.map((i) => i.id))
    expect(ids[5]).toBe("P2_01")
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
    expect(all).toHaveLength(54)
    expect(all[0].label).toBe("I.1")
    expect(all.find((b) => b.label === "III.21")).toBeTruthy()
  })

  it("counts an answer of any kind, and never the optional pilot question", () => {
    const answers = { P1_year: "First year", P2_01: 3, P1_sex: "  " }
    const left = blanks(flow, answers).map((b) => b.label)
    expect(left).not.toContain("I.2")
    expect(left).not.toContain("II.1")
    expect(left).toContain("I.1")
    expect(left).toHaveLength(52)
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

/*
 * English is the validated instrument and what the app works with; Filipino (questionnaire.fil.json,
 * written by hand) is only shown. These keep the two in step, so that the switch changes the words
 * and nothing else (Ian, 2026-11-19).
 */
describe("the two languages", () => {
  const en = texts.en
  const fil = texts.fil

  it("have the same items, in the same order, with the same answers to pick from", () => {
    expect(fil.parts.map((p) => p.id)).toEqual(en.parts.map((p) => p.id))
    fil.parts[0].items.forEach((item, i) => {
      const same = en.parts[0].items[i]
      expect([item.id, item.n, item.type, item.other]).toEqual([same.id, same.n, same.type, same.other])
      expect(item.options?.length).toBe(same.options?.length)
    })
    expect(profileIn("fil").items.map((i) => [i.id, i.n])).toEqual(profile.items.map((i) => [i.id, i.n]))
    likertPartsIn("fil").forEach((part, p) => {
      expect(part.items.map((i) => [i.id, i.n])).toEqual(likertParts[p].items.map((i) => [i.id, i.n]))
      expect(part.scale.map((s) => s.value)).toEqual([5, 4, 3, 2, 1])
      expect(part.scale.every((s) => s.label.length > 0)).toBe(true)
    })
    expect(fil.age_check.options).toHaveLength(en.age_check.options.length)
    expect(fil.consent.data_use.options).toHaveLength(en.consent.data_use.options.length)
  })

  it("have every text in Filipino, and the study's title as it is", () => {
    expect(fil.title).toBe(en.title)
    const same: string[] = []
    const compare = (a: unknown, b: unknown, path: string) => {
      if (typeof a === "string") {
        // ids, types and the Other columns are the same on purpose: only the words are compared
        if (a === b && !/\.(id|type|other)$/.test(path)) same.push(path)
      } else if (a && typeof a === "object") {
        expect(Object.keys(b as object)).toEqual(Object.keys(a))
        for (const [k, v] of Object.entries(a)) compare(v, (b as Record<string, unknown>)[k], `${path}.${k}`)
      } else expect(b).toBe(a)
    }
    compare(en, fil, "q")
    // what stays as it is: the title, and the names of the two languages that are options of Part I
    expect(same).toEqual([
      "q.title",
      "q.parts.0.items.3.options.0",
      "q.parts.0.items.3.options.1",
      "q.parts.0.items.4.options.0",
      "q.parts.0.items.4.options.1",
    ])
  })

  it("keep the English examples inside the items in English", () => {
    likertParts.forEach((part, p) =>
      part.items.forEach((item, i) => {
        const shown = likertPartsIn("fil")[p].items[i].text
        for (const example of item.text.match(/“[^”]+”/g) ?? []) expect(shown).toContain(example)
      }),
    )
    const text = (id: string) => likertPartsIn("fil").flatMap((p) => p.items).find((i) => i.id === id)!.text
    expect(text("P3_08")).toContain("kettle")
    expect(text("P3_09")).toMatch(/pomelo.*kettle/)
    expect(text("P3_10")).toContain("balloon")
    expect(text("P3_15")).toContain("utensils")
  })

  it("use the same five words for the frequency scale and for how often English is spoken", () => {
    const words = likertPartsIn("fil")[0].scale.map((s) => s.label)
    expect(profileIn("fil").items.find((i) => i.id === "P1_engfreq")!.options).toEqual(words)
    for (const part of likertPartsIn("fil").slice(0, 3)) expect(part.scale.map((s) => s.label)).toEqual(words)
  })

  it("speak to the respondent as kayo, never ka or mo", () => {
    const all: string[] = []
    const collect = (v: unknown) => {
      if (typeof v === "string") all.push(v)
      else if (typeof v === "function") all.push(String(v))
      else if (v && typeof v === "object") Object.values(v).forEach(collect)
    }
    collect({ ...fil, title: "" })
    collect(strings.fil)
    for (const text of all) expect(text).not.toMatch(/(^|[^\p{L}-])(ka|mo|iyo|iyong|po)([^\p{L}-]|$)/iu)
  })

  it("count in Filipino with the linker a number needs: 4 na aytem, 2 aytem", () => {
    const f = strings.fil
    expect(f.answered(52, 54)).toBe("Nasagot ninyo ang 52 sa 54 na aytem.")
    expect([1, 2, 4, 6, 9, 10, 14, 20, 23].map((n) => f.blankCount(n))).toEqual([
      "1 aytem",
      "2 aytem",
      "4 na aytem",
      "6 na aytem",
      "9 na aytem",
      "10 aytem",
      "14 na aytem",
      "20 aytem",
      "23 aytem",
    ])
    expect(f.date(new Date(2026, 10, 19))).toBe("Nobyembre 19, 2026")
    expect(strings.en.blankCount(1)).toBe("1 item")
    expect(strings.en.blankCount(2)).toBe("2 items")
  })

  it("name the parts the same way", () => {
    fil.parts.forEach((part, p) => {
      const name = partName(part.title)
      expect(name.roman).toBe(partName(en.parts[p].title).roman)
      expect(name.roman).not.toBe("")
      expect(name.name.length).toBeGreaterThan(0)
    })
  })

  it("have the words the directions are shown without", () => {
    for (const lang of ["en", "fil"] as const) {
      const { directionsLead, directionsTail } = strings[lang]
      for (const part of texts[lang].parts) expect(part.directions.startsWith(directionsLead)).toBe(true)
      for (const part of likertPartsIn(lang).slice(0, 3)) expect(part.directions.endsWith(directionsTail)).toBe(true)
    }
  })

  it("have the same paragraphs in every text that is read", () => {
    const count = (text: string) => paragraphs(text).length
    const lines = (text: string) => text.split("\n").length
    expect(count(fil.description)).toBe(count(en.description))
    expect(count(fil.consent.intro)).toBe(count(en.consent.intro))
    expect(fil.consent.sections).toHaveLength(en.consent.sections.length)
    fil.consent.sections.forEach((s, i) => {
      expect(count(s.body)).toBe(count(en.consent.sections[i].body))
      expect(lines(s.body)).toBe(lines(en.consent.sections[i].body))
    })
    expect(count(fil.letter.body)).toBe(count(en.letter.body))
    expect(lines(fil.letter.body)).toBe(lines(en.letter.body))
    expect(count(fil.general_directions.body)).toBe(count(en.general_directions.body))
  })

  it("go through the same screens, so the switch keeps the respondent's place", () => {
    const shape = (s: Screen) =>
      s.kind === "read"
        ? [s.kind, s.section, s.page, s.pages, s.paragraphs.length, s.title === ""]
        : s.kind === "profile"
          ? [s.kind, s.item.id, s.ordinal, s.of]
          : s.kind === "likert"
            ? [s.kind, s.part, s.item]
            : s.kind === "partIntro"
              ? [s.kind, s.part]
              : [s.kind]
    for (const pilot of [false, true]) {
      const english = buildFlow(pilot, "en")
      const filipino = buildFlow(pilot, "fil")
      expect(filipino.map(shape)).toEqual(english.map(shape))
      expect(blanks(filipino, {})).toEqual(blanks(english, {}))
    }
    expect(buildFlow(false)).toEqual(buildFlow(false, "en"))
  })

  it("keep every word of the Filipino consent form, letter and directions, and no page too long", () => {
    const flow = buildFlow(false, "fil")
    const text = (section: string) =>
      flow
        .filter((s) => s.kind === "read" && s.section === section)
        .flatMap((s) => (s.kind === "read" ? s.paragraphs : []))
        .join("\n\n")
    const whole = [fil.consent.intro, ...fil.consent.sections.map((s) => s.body)].join("\n\n")
    expect(text("consent").replace(/\s+/g, " ")).toBe(whole.replace(/\s+/g, " "))
    expect(text("letter").replace(/\s+/g, " ")).toBe(fil.letter.body.replace(/\s+/g, " "))
    expect(text("directions").replace(/\s+/g, " ")).toBe(fil.general_directions.body.replace(/\s+/g, " "))
    // a page of more than one paragraph holds PAGE_CHARS at most, in either language
    for (const lang of ["en", "fil"] as const) {
      for (const s of buildFlow(false, lang)) {
        if (s.kind !== "read" || s.section === "directions" || s.paragraphs.length < 2) continue
        expect(s.paragraphs.join("").length).toBeLessThanOrEqual(PAGE_CHARS)
      }
    }
  })

  it("show the Likert items of a screen in the language asked, with the same id", () => {
    for (const s of buildFlow(false)) {
      if (s.kind !== "likert") continue
      expect(likertAt(s, "fil").item.id).toBe(likertAt(s).item.id)
      expect(likertAt(s, "fil").item.text).not.toBe(likertAt(s).item.text)
    }
  })
})
