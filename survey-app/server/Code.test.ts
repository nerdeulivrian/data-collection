import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import { createGoogle, FakeSheet, loadCode } from "./googleFakes.ts"

const source = readFileSync(new URL("./Code.gs", import.meta.url), "utf8")

function fresh(password: string | undefined = "secret") {
  const google = createGoogle({ password })
  const app = loadCode(source, google.globals)
  app.setup()
  return { app, book: google.book, logs: google.logs }
}

const likert = (part: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${part}_${String(i + 1).padStart(2, "0")}`)

/**
 * the handover's columns, in its order, with the code replaced by the questionnaire's own id, and
 * without the age, which is not asked (Ian, 2026-11-19)
 */
const RESPONSE_COLUMNS = [
  "response_id",
  "group",
  "P1_sex",
  "P1_year",
  "P1_l1",
  "P1_l1_other",
  "P1_home",
  "P1_home_other",
  "P1_engfreq",
  ...likert("P2", 8),
  ...likert("P3", 21),
  ...likert("P4", 10),
  ...likert("P5", 10),
  "pilot_feedback",
  "started_at",
  "submitted_at",
  "duration_min",
  "language",
]
const CONSENT_COLUMNS = [
  "response_id",
  "name",
  "signature",
  "address",
  "data_use_1",
  "data_use_2",
  "data_use_3",
  "agreed_at",
  "language",
]

type App = ReturnType<typeof fresh>["app"]

function consent(app: App, id: string, language?: unknown) {
  return app.post({
    action: "consent",
    id,
    name: "Juan Dela Cruz",
    signature: "Juan Dela Cruz",
    address: "Obrero, Davao City",
    data_use: [1, 3],
    language,
  })
}

describe("setup", () => {
  it("makes the two tabs, and running it again changes nothing", () => {
    const { app, book } = fresh()
    expect(book.sheets.map((s) => s.name)).toEqual(["consents", "responses"])
    consent(app, "R-AAAA2222")
    app.setup()
    expect(book.sheets.map((s) => s.name)).toEqual(["consents", "responses"])
    expect(book.tab("consents").records()).toHaveLength(1)
  })

  it("gives the tabs exactly their columns", () => {
    const { book } = fresh()
    expect(book.tab("responses").rows[0]).toEqual(RESPONSE_COLUMNS)
    expect(book.tab("consents").rows[0]).toEqual(CONSENT_COLUMNS)
  })

  it("keeps text columns as plain text and the answer columns as numbers", () => {
    const { book } = fresh()
    const formats = book.tab("responses").formats
    const at = (name: string) => formats.get(RESPONSE_COLUMNS.indexOf(name) + 1)
    expect(at("response_id")).toBe("@")
    expect(at("started_at")).toBe("@")
    expect(at("P1_sex")).toBe("@")
    expect(at("P3_01")).toBeUndefined()
    expect(at("duration_min")).toBeUndefined()
  })

  it("has 63 columns of answers and 9 of consent, and no column for the age", () => {
    const { book } = fresh()
    expect(book.tab("responses").rows[0]).toHaveLength(63)
    expect(book.tab("consents").rows[0]).toHaveLength(9)
    expect(book.tab("responses").rows[0]).not.toContain("P1_age")
  })

  it("updates a tab an earlier version made, keeping any rows", () => {
    const google = createGoogle({ password: "secret" })
    const old = google.book.insertSheet("consents")
    old.getRange(1, 1, 1, 8).setValues([["access_code", ...CONSENT_COLUMNS.slice(1, 8)]])
    const answered = google.book.insertSheet("responses")
    answered.getRange(1, 1, 2, 2).setValues([
      ["code", "group"],
      ["P-01", "P"],
    ])
    loadCode(source, google.globals).setup()
    expect(google.book.tab("consents").rows[0]).toEqual(CONSENT_COLUMNS)
    const header = google.book.tab("responses").rows[0]
    expect(header.slice(0, 3)).toEqual(["code", "group", "response_id"])
    expect(header).toHaveLength(RESPONSE_COLUMNS.length + 1)
    expect(google.book.tab("responses").rows[1].slice(0, 2)).toEqual(["P-01", "P"])
  })

  it("adds the language column at the end of tabs that already have rows, and keeps the rows", () => {
    // the Sheet as it was before the questionnaire had two languages
    const google = createGoogle({ password: "secret" })
    const before = { consents: CONSENT_COLUMNS.slice(0, -1), responses: RESPONSE_COLUMNS.slice(0, -1) }
    for (const [name, columns] of Object.entries(before)) {
      const row = columns.map((c) => (c === "response_id" ? "T-AAAA2222" : c === "name" ? "Juan" : ""))
      google.book.insertSheet(name).getRange(1, 1, 2, columns.length).setValues([columns, row])
    }
    const app = loadCode(source, google.globals)
    app.setup()
    expect(google.book.tab("consents").rows[0]).toEqual(CONSENT_COLUMNS)
    expect(google.book.tab("responses").rows[0]).toEqual(RESPONSE_COLUMNS)
    expect(google.book.tab("consents").records()[0]).toMatchObject({ response_id: "T-AAAA2222", name: "Juan" })
    expect(google.book.tab("responses").records()).toHaveLength(1)
    // and a questionnaire answered after that says its language
    consent(app, "R-BBBB3333", "fil")
    app.post({ action: "submit", id: "R-BBBB3333", group: "Y1", answers: { P2_01: 4 }, language: "fil" })
    expect(google.book.tab("consents").records()[1]).toMatchObject({ response_id: "R-BBBB3333", language: "fil" })
    expect(google.book.tab("responses").records()[1]).toMatchObject({ P2_01: 4, language: "fil" })
  })
})

describe("the look of the tabs", () => {
  const column = (sheet: FakeSheet, name: string) => sheet.rows[0].indexOf(name) + 1
  /** everything about a tab's look that setup asks for, to compare two runs */
  const lookOf = (sheet: FakeSheet) => ({
    tab: sheet.tabColor,
    frozen: [sheet.frozenRows, sheet.frozenColumns],
    widths: [...sheet.columnWidths],
    heights: [...sheet.rowHeights],
    bandings: sheet.bandings.map((b) => [b.box, b.first, b.second]),
    rules: sheet.rules,
    protections: sheet.protections.map((p) => [p.box, p.description, p.warningOnly]),
    cells: [1, 2, 3].map((row) => sheet.rows[0].map((_, i) => sheet.look(row, i + 1))),
  })

  it("says Ready, with nothing left undone", () => {
    expect(fresh().logs).toEqual(["Ready."])
    expect(fresh("").logs[0]).toMatch(/^Ready, but: Put a password/)
  })

  it("freezes the header and the columns that say whose row it is", () => {
    const { book } = fresh()
    expect([book.tab("responses").frozenRows, book.tab("responses").frozenColumns]).toEqual([1, 2])
    expect([book.tab("consents").frozenRows, book.tab("consents").frozenColumns]).toEqual([1, 1])
  })

  it("gives each part of the questionnaire its own header colour", () => {
    const { book } = fresh()
    const sheet = book.tab("responses")
    const tint = (name: string) => sheet.look(1, column(sheet, name)).background
    const parts = ["P1_sex", "P2_01", "P3_01", "P4_01", "P5_01"].map(tint)
    expect(new Set(parts).size).toBe(5)
    // one colour through a part, and another where the next begins
    expect(tint("P2_08")).toBe(tint("P2_01"))
    expect(tint("P3_21")).toBe(tint("P3_01"))
    expect(tint("P1_engfreq")).toBe(tint("P1_sex"))
    expect(tint("pilot_feedback")).not.toBe(tint("P5_10"))
    expect(sheet.look(1, column(sheet, "P3_07"))).toMatchObject({ fontWeight: "bold", valign: "middle" })
    // the columns that hold names stand out in the consents tab
    const consents = book.tab("consents")
    const names = ["name", "signature", "address"].map((n) => consents.look(1, column(consents, n)).background)
    expect(new Set(names).size).toBe(1)
    expect(names[0]).not.toBe(consents.look(1, column(consents, "response_id")).background)
    expect([consents.tabColor, sheet.tabColor]).toEqual(["#ff4b4b", "#ff9600"])
  })

  it("makes the answer columns narrow and centred, and the pilot's remarks wide and wrapped", () => {
    const { book } = fresh()
    const sheet = book.tab("responses")
    const answers = sheet.rows[0].filter((h) => /^P[2-5]_\d\d$/.test(String(h)))
    expect(answers).toHaveLength(49)
    for (const name of answers) {
      expect(sheet.columnWidths.get(column(sheet, String(name)))).toBe(54)
      expect(sheet.look(500, column(sheet, String(name)))).toMatchObject({ align: "center", wrap: "CLIP" })
    }
    expect(sheet.columnWidths.get(column(sheet, "pilot_feedback"))).toBe(360)
    expect(sheet.look(500, column(sheet, "pilot_feedback"))).toMatchObject({ align: "left", wrap: "WRAP", valign: "top" })
    // every column has a width, in both tabs
    for (const tab of [sheet, book.tab("consents")]) {
      expect([...tab.columnWidths.keys()].sort((a, b) => a - b)).toEqual(tab.rows[0].map((_, i) => i + 1))
    }
  })

  it("shades every other row, down to the last row of the tab", () => {
    const { book } = fresh()
    const sheet = book.tab("responses")
    expect(sheet.bandings).toHaveLength(1)
    expect(sheet.bandings[0].box).toEqual({ row: 2, column: 1, numRows: sheet.getMaxRows() - 1, numColumns: 63 })
    const shade = (row: number) => sheet.look(row, column(sheet, "P1_sex")).background
    expect(shade(2)).toBe(shade(4))
    expect(shade(3)).toBe(shade(999))
    expect(shade(2)).not.toBe(shade(3))
  })

  it("marks an answer left blank in a submitted row, and nothing in an empty row", () => {
    const { app, book } = fresh()
    consent(app, "R-AAAA2222")
    app.post({ action: "submit", id: "R-AAAA2222", group: "Y1", answers: { P2_01: 4, P5_10: 2 } })
    const sheet = book.tab("responses")
    const at = (row: number, name: string) => sheet.look(row, column(sheet, name)).background
    // the first and the last answer column are given: the rule reaches both ends, and no further
    expect(at(2, "P2_02")).toBe("#ffe9a8")
    expect(at(2, "P5_09")).toBe("#ffe9a8")
    expect(at(2, "P2_01")).not.toBe("#ffe9a8")
    expect(at(2, "P5_10")).not.toBe("#ffe9a8")
    expect(at(2, "P1_l1_other")).not.toBe("#ffe9a8")
    expect(at(2, "pilot_feedback")).not.toBe("#ffe9a8")
    expect(at(3, "P2_02")).not.toBe("#ffe9a8")
  })

  it("shows a test run in gray italics, in both tabs, and a real one as it is", () => {
    const { app, book } = fresh()
    for (const id of ["T-AAAA2222", "R-BBBB3333"]) {
      consent(app, id)
      app.post({ action: "submit", id, group: "Y1", answers: { P2_01: 4 } })
    }
    for (const tab of [book.tab("consents"), book.tab("responses")]) {
      const last = tab.rows[0].length
      expect(tab.look(2, 1)).toMatchObject({ fontColor: "#afafaf", italic: true })
      expect(tab.look(2, last)).toMatchObject({ fontColor: "#afafaf", italic: true })
      expect(tab.look(3, 1).italic).toBeUndefined()
      expect(tab.look(3, last).fontColor).toBeUndefined()
    }
  })

  it("puts a warning, not a lock, on the header row", () => {
    const { book } = fresh()
    for (const tab of [book.tab("consents"), book.tab("responses")]) {
      expect(tab.protections).toHaveLength(1)
      expect(tab.protections[0]).toMatchObject({ warningOnly: true, box: { row: 1, numRows: 1, column: 1 } })
      expect(tab.protections[0].description).toMatch(/column names/)
    }
  })

  it("gives the same look when setup runs again, and to rows added in between", () => {
    const { app, book, logs } = fresh()
    const before = { consents: lookOf(book.tab("consents")), responses: lookOf(book.tab("responses")) }
    consent(app, "R-AAAA2222")
    app.post({ action: "submit", id: "R-AAAA2222", group: "Y1", answers: { P2_01: 4 } })
    const grids = app.post({ action: "summary", password: "secret" })
    app.setup()
    app.setup()
    expect(logs).toEqual(["Ready.", "Ready.", "Ready."])
    for (const name of ["consents", "responses"] as const) {
      const now = lookOf(book.tab(name))
      // the cells of rows 2 and 3 look different once a row is answered (its blank answers are marked)
      expect({ ...now, cells: 0 }).toEqual({ ...before[name], cells: 0 })
    }
    // and the look changes no value: the page and the CSV files get what they got before
    const after = app.post({ action: "summary", password: "secret" })
    expect([after.responses, after.consents]).toEqual([grids.responses, grids.consents])
    expect(book.tab("responses").rows[0]).toEqual(RESPONSE_COLUMNS)
    expect(book.tab("consents").rows[0]).toEqual(CONSENT_COLUMNS)
  })

  it("styles a tab an earlier version made, whatever order its columns are in", () => {
    const google = createGoogle({ password: "secret" })
    google.book.insertSheet("responses").getRange(1, 1, 2, 3).setValues([
      ["code", "P2_01", "response_id"],
      ["P-01", "", "R-AAAA2222"],
    ])
    loadCode(source, google.globals).setup()
    expect(google.logs).toEqual(["Ready."])
    const sheet = google.book.tab("responses")
    // no column that says whose row it is comes first, so none is frozen
    expect(sheet.frozenColumns).toBe(0)
    // the rules find response_id where it is (column C), and the answer columns where they are
    expect(sheet.look(2, 2).background).toBe("#ffe9a8")
    expect(sheet.look(2, column(sheet, "P5_10")).background).toBe("#ffe9a8")
    expect(sheet.look(2, 1).background).not.toBe("#ffe9a8")
  })

  it("has the tabs ready for answers even if a colour fails", () => {
    const broken = vi.spyOn(FakeSheet.prototype, "setTabColor").mockImplementation(() => {
      throw new Error("no colours today")
    })
    try {
      const { app, book, logs } = fresh()
      expect(logs[0]).toMatch(/^Ready, but: The two tabs are ready and can be used\..*no colours today$/)
      expect(book.tab("responses").rows[0]).toEqual(RESPONSE_COLUMNS)
      expect(consent(app, "R-AAAA2222")).toEqual({ ok: true })
      expect(app.post({ action: "submit", id: "R-AAAA2222", answers: { P2_01: 4 } })).toMatchObject({ ok: true })
    } finally {
      broken.mockRestore()
    }
  })
})

describe("requests", () => {
  it("answers a bad request without crashing", () => {
    const { app } = fresh()
    expect(app.post("not json")).toEqual({ ok: false, error: "bad_request" })
    expect(app.post({ action: "nope" })).toEqual({ ok: false, error: "bad_request" })
    expect(app.post({ action: "check", code: "P-01" })).toEqual({ ok: false, error: "bad_request" })
    expect(app.get()).toMatchObject({ ok: true })
  })

  it("needs a well-formed id", () => {
    const { app, book } = fresh()
    for (const id of ["", "P-01", "R-", "R-AB", "X-ABCDEFGH", "R-ABC DEFG", "R-=1+1AAAA"]) {
      expect(consent(app, id)).toEqual({ ok: false, error: "bad_request" })
      expect(app.post({ action: "submit", id, answers: {} })).toEqual({ ok: false, error: "bad_request" })
    }
    expect(book.tab("consents").records()).toHaveLength(0)
    expect(consent(app, " r-abcd2345 ")).toEqual({ ok: true })
    expect(book.tab("consents").records()[0].response_id).toBe("R-ABCD2345")
  })
})

describe("consent", () => {
  it("keeps the signed form in the consents tab", () => {
    const { app, book } = fresh()
    expect(consent(app, "R-K7Q2XM4P")).toEqual({ ok: true })
    const [row] = book.tab("consents").records()
    expect(row).toMatchObject({
      response_id: "R-K7Q2XM4P",
      name: "Juan Dela Cruz",
      signature: "Juan Dela Cruz",
      address: "Obrero, Davao City",
      data_use_1: "Yes",
      data_use_2: "No",
      data_use_3: "Yes",
    })
    expect(String(row.agreed_at)).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/)
  })

  it("needs a name and a signature", () => {
    const { app, book } = fresh()
    const r = app.post({ action: "consent", id: "R-AAAA2222", name: " ", signature: "x" })
    expect(r).toEqual({ ok: false, error: "incomplete" })
    expect(book.tab("consents").records()).toHaveLength(0)
  })

  it("replaces the record when the same questionnaire signs again", () => {
    const { app, book } = fresh()
    consent(app, "R-AAAA2222")
    app.post({ action: "consent", id: "R-AAAA2222", name: "Ana", signature: "Ana", data_use: [2] })
    const rows = book.tab("consents").records()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: "Ana", data_use_1: "No", data_use_2: "Yes", address: "" })
  })

  it("never keeps the answers and the names in the same tab", () => {
    const { app, book } = fresh()
    consent(app, "R-AAAA2222")
    app.post({ action: "submit", id: "R-AAAA2222", group: "P", answers: { P2_01: 4 }, elapsed_ms: 60000 })
    const responseText = JSON.stringify(book.tab("responses").rows)
    expect(responseText).not.toContain("Juan")
    expect(responseText).not.toContain("Obrero")
  })
})

describe("submit", () => {
  const answers = {
    P1_sex: "Female",
    P1_year: "First year",
    P1_l1: "Bisaya/Cebuano",
    P1_l1_other: "",
    P1_home: "Other",
    P1_home_other: "Mandaya",
    P1_engfreq: "Sometimes",
    P2_01: 5,
    P2_08: 1,
    P3_21: 3,
    P5_10: 2,
  }

  it("adds one row with every column", () => {
    const { app, book } = fresh()
    consent(app, "R-K7Q2XM4P")
    const r = app.post({ action: "submit", id: "R-K7Q2XM4P", group: "Y1", answers, elapsed_ms: 12.34 * 60000 })
    expect(r).toMatchObject({ ok: true })
    const [row] = book.tab("responses").records()
    expect(Object.keys(row)).toEqual(RESPONSE_COLUMNS)
    expect(row).toMatchObject({
      response_id: "R-K7Q2XM4P",
      group: "Y1",
      P1_sex: "Female",
      P1_year: "First year",
      P1_home: "Other",
      P1_home_other: "Mandaya",
      P2_01: 5,
      P2_02: "",
      P2_08: 1,
      P3_21: 3,
      P5_10: 2,
      pilot_feedback: "",
      duration_min: 12.3,
    })
    expect(String(row.started_at)).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/)
    expect(row.submitted_at).toBe(r.submitted_at)
  })

  it("keeps no age, even from a phone that still sends one", () => {
    const { app, book } = fresh()
    consent(app, "R-K7Q2XM4P")
    app.post({ action: "submit", id: "R-K7Q2XM4P", group: "Y1", answers: { ...answers, P1_age: "19" } })
    const [row] = book.tab("responses").records()
    expect(Object.keys(row)).toEqual(RESPONSE_COLUMNS)
    expect(Object.values(row)).not.toContain(19)
    expect(Object.values(row)).not.toContain("19")
  })

  it("keeps the first row when the same questionnaire is sent again", () => {
    const { app, book } = fresh()
    consent(app, "R-K7Q2XM4P")
    const first = app.post({ action: "submit", id: "R-K7Q2XM4P", group: "Y1", answers })
    const again = app.post({ action: "submit", id: "R-K7Q2XM4P", group: "Y2", answers: { P2_01: 1 } })
    expect(again).toEqual({ ok: true, submitted_at: first.submitted_at })
    const rows = book.tab("responses").records()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ group: "Y1", P2_01: 5 })
  })

  it("needs a signed consent form first", () => {
    const { app, book } = fresh()
    expect(app.post({ action: "submit", id: "R-K7Q2XM4P", group: "Y1", answers })).toEqual({
      ok: false,
      error: "no_consent",
    })
    expect(book.tab("responses").records()).toHaveLength(0)
  })

  it("keeps only answers from 1 to 5", () => {
    const { app, book } = fresh()
    consent(app, "R-AAAA2222")
    app.post({
      action: "submit",
      id: "R-AAAA2222",
      answers: { P2_01: 6, P2_02: "5", P2_03: 0, P2_04: 2.5, P2_05: null, P2_06: 3 },
    })
    const [row] = book.tab("responses").records()
    expect([row.P2_01, row.P2_02, row.P2_03, row.P2_04, row.P2_05, row.P2_06]).toEqual([
      "",
      "",
      "",
      "",
      "",
      3,
    ])
  })

  it("stores text that looks like a formula as text", () => {
    const { app, book } = fresh()
    consent(app, "R-AAAA2222")
    app.post({
      action: "submit",
      id: "R-AAAA2222",
      answers: { pilot_feedback: "=HYPERLINK(1)", P1_l1_other: "-Mandaya", P1_home_other: "+Tagakaulo" },
    })
    app.post({ action: "consent", id: "R-BBBB3333", name: "=1+1", signature: "@me" })
    expect(book.formulas).toEqual([])
    const [row] = book.tab("responses").records()
    expect(row.pilot_feedback).toBe("=HYPERLINK(1)")
    expect(row.P1_l1_other).toBe("-Mandaya")
    expect(row.P1_home_other).toBe("+Tagakaulo")
  })

  it("keeps the language the questionnaire was in, en or fil and nothing else", () => {
    const { app, book } = fresh()
    const send = (id: string, language: unknown) => {
      consent(app, id, language)
      app.post({ action: "submit", id, group: "Y1", answers, language })
    }
    send("R-AAAA2222", "en")
    send("R-BBBB3333", "fil")
    send("R-CCCC4444", "=1+1")
    send("R-DDDD5555", undefined)
    send("R-EEEE6666", "FIL")
    expect(book.tab("responses").records().map((r) => r.language)).toEqual(["en", "fil", "", "", ""])
    expect(book.tab("consents").records().map((r) => r.language)).toEqual(["en", "fil", "", "", ""])
    // the answers are the same whichever language they were given in
    const [english, filipino] = book.tab("responses").records()
    for (const k of ["P1_sex", "P1_year", "P1_home", "P1_engfreq", "P2_01", "P5_10", "group"]) {
      expect(filipino[k]).toEqual(english[k])
    }
  })

  it("leaves the times blank when the app sent no usable duration", () => {
    const { app, book } = fresh()
    consent(app, "R-AAAA2222")
    app.post({ action: "submit", id: "R-AAAA2222", answers: {}, elapsed_ms: -5 })
    const [row] = book.tab("responses").records()
    expect(row.started_at).toBe("")
    expect(row.duration_min).toBe("")
    expect(String(row.submitted_at)).toMatch(/^\d{4}-/)
  })

  it("files a test run as T, and nothing else as T", () => {
    const { app, book } = fresh()
    const send = (id: string, group: unknown) => {
      consent(app, id)
      app.post({ action: "submit", id, group, answers })
    }
    send("T-AAAA2222", "Y1")
    send("R-BBBB3333", "T")
    send("R-CCCC4444", "Y3")
    send("R-DDDD5555", "P")
    expect(book.tab("responses").records().map((r) => r.group)).toEqual(["T", "", "", "P"])
  })
})

describe("summary", () => {
  it("needs the password", () => {
    const { app } = fresh()
    expect(app.post({ action: "summary", password: "wrong" })).toEqual({
      ok: false,
      error: "password",
    })
    expect(app.post({ action: "summary" })).toEqual({ ok: false, error: "password" })
  })

  it("refuses everyone until a password is set", () => {
    const { app } = fresh("")
    expect(app.post({ action: "summary", password: "" })).toEqual({
      ok: false,
      error: "no_password",
    })
  })

  it("returns the two tabs as grids for the page and the CSV files", () => {
    const { app } = fresh()
    consent(app, "R-AAAA2222")
    app.post({ action: "submit", id: "R-AAAA2222", group: "P", answers: { P2_01: 4 }, elapsed_ms: 600000 })
    const r = app.post({ action: "summary", password: "secret" }) as {
      ok: boolean
      responses: string[][]
      consents: string[][]
    }
    expect(r.ok).toBe(true)
    expect(Object.keys(r)).toEqual(["ok", "now", "responses", "consents"])
    expect(r.responses[0]).toEqual(RESPONSE_COLUMNS)
    expect(r.responses[1][RESPONSE_COLUMNS.indexOf("P2_01")]).toBe("4")
    expect(r.responses[1][RESPONSE_COLUMNS.indexOf("duration_min")]).toBe("10")
    expect(r.consents).toHaveLength(2)
  })
})
