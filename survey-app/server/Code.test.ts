import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { createGoogle, loadCode } from "./googleFakes.ts"

const source = readFileSync(new URL("./Code.gs", import.meta.url), "utf8")

function fresh(password: string | undefined = "secret") {
  const google = createGoogle({ password })
  const app = loadCode(source, google.globals)
  app.setup()
  return { app, book: google.book }
}

const likert = (part: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${part}_${String(i + 1).padStart(2, "0")}`)

/** the handover's columns, in its order, with the code replaced by the questionnaire's own id */
const RESPONSE_COLUMNS = [
  "response_id",
  "group",
  "P1_age",
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
    expect(at("P3_01")).toBeUndefined()
    expect(at("P1_age")).toBeUndefined()
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
    P1_age: "19",
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
      P1_age: 19,
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
      answers: { pilot_feedback: "=HYPERLINK(1)", P1_l1_other: "-Mandaya", P1_age: "+19" },
    })
    app.post({ action: "consent", id: "R-BBBB3333", name: "=1+1", signature: "@me" })
    expect(book.formulas).toEqual([])
    const [row] = book.tab("responses").records()
    expect(row.pilot_feedback).toBe("=HYPERLINK(1)")
    expect(row.P1_l1_other).toBe("-Mandaya")
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
