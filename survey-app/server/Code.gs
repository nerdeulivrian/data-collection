/**
 * The questionnaire's backend: a Google Apps Script web app bound to the Google Sheet that keeps
 * the data, in two tabs.
 *
 *   consents   the consent records: names, signatures, addresses. Kept apart from the answers, as
 *              the consent form promises ("your name is not considered part of the data")
 *   responses  one row per submitted questionnaire, with the columns the analysis expects
 *
 * There are no access codes: anyone with the link can answer. Each questionnaire gets its own
 * response_id on the phone (R-…, or T-… for a test run), which ties its consent row to its
 * answers and makes sending the same questionnaire twice harmless.
 *
 * Setting it up is in README.md ("Set up the Google Sheet"): paste this file into the Sheet's
 * Extensions > Apps Script, put a password below, run setup once, then deploy it as a web app that
 * runs as you and that anyone can reach.
 */

/** The password for the researchers' page. Put one here before you deploy. */
const RESEARCHER_PASSWORD = ""

/**
 * The groups, from the year level the respondent picks: P is the pilot (third year), Y1 and Y2 the
 * first and second years. T is a test run (the app opened as …/?test): it is kept, but the
 * researchers' page leaves it out of the counts and the CSV files.
 */
const GROUPS = ["P", "Y1", "Y2", "T"]

const TIME_ZONE = "Asia/Manila"

const CONSENT_COLUMNS = [
  "response_id",
  "name",
  "signature",
  "address",
  "data_use_1",
  "data_use_2",
  "data_use_3",
  "agreed_at",
]
const PROFILE_TEXT = [
  "P1_sex",
  "P1_year",
  "P1_l1",
  "P1_l1_other",
  "P1_home",
  "P1_home_other",
  "P1_engfreq",
]
const LIKERT_COLUMNS = likertColumns_([
  ["P2", 8],
  ["P3", 21],
  ["P4", 10],
  ["P5", 10],
])
const RESPONSE_COLUMNS = ["response_id", "group", "P1_age"].concat(PROFILE_TEXT, LIKERT_COLUMNS, [
  "pilot_feedback",
  "started_at",
  "submitted_at",
  "duration_min",
])
/** columns that hold numbers, so the Sheet can average them; every other column stays plain text */
const NUMBER_COLUMNS = ["P1_age", "duration_min"].concat(LIKERT_COLUMNS)

/* ---------- the web app ---------- */

/** Opening the web app's address in a browser shows this: a quick way to see it is up. */
function doGet() {
  return json_({ ok: true, service: "questionnaire", time: stamp_(new Date()) })
}

/** Every call from the app is a POST with a JSON body: { action, ... }. */
function doPost(e) {
  let request
  try {
    request = JSON.parse((e && e.postData && e.postData.contents) || "")
  } catch (err) {
    return json_({ ok: false, error: "bad_request" })
  }
  try {
    switch (request && request.action) {
      case "consent":
        return json_(locked_(() => consent_(request)))
      case "submit":
        return json_(locked_(() => submit_(request)))
      case "summary":
        return json_(summary_(request))
      default:
        return json_({ ok: false, error: "bad_request" })
    }
  } catch (err) {
    return json_({ ok: false, error: "server", message: String((err && err.message) || err) })
  }
}

/**
 * Run once from the editor (pick setup beside Debug, then Run): makes the two tabs. Running it
 * again is safe: it never deletes anything. A tab made by an earlier version of this file gets
 * this version's columns.
 */
function setup() {
  const book = SpreadsheetApp.getActiveSpreadsheet()
  tab_(book, "consents", CONSENT_COLUMNS)
  tab_(book, "responses", RESPONSE_COLUMNS)
  Logger.log(
    password_()
      ? "Ready."
      : "Ready, but put a password in RESEARCHER_PASSWORD at the top of this file before you deploy.",
  )
}

/* ---------- the actions ---------- */

/** The signed consent form: one row per questionnaire in the consents tab (signing again replaces it). */
function consent_(request) {
  const id = id_(request.id)
  if (!id) return { ok: false, error: "bad_request" }
  const name = text_(request.name, 200)
  const signature = text_(request.signature, 200)
  if (!name || !signature) return { ok: false, error: "incomplete" }
  const use = Array.isArray(request.data_use) ? request.data_use : []
  const record = {
    response_id: id,
    name: name,
    signature: signature,
    address: text_(request.address, 300),
    data_use_1: use.indexOf(1) >= 0 ? "Yes" : "No",
    data_use_2: use.indexOf(2) >= 0 ? "Yes" : "No",
    data_use_3: use.indexOf(3) >= 0 ? "Yes" : "No",
    agreed_at: stamp_(new Date()),
  }
  const consents = sheet_("consents")
  const earlier = find_(consents, "response_id", id)
  if (earlier) setFields_(consents, earlier.row, record)
  else append_(consents, record)
  return { ok: true }
}

/**
 * A finished questionnaire: one row in the responses tab. Only after a signed consent form, and
 * only once: the same questionnaire sent again (a lost reply, a second tap) keeps the first row.
 * The app sends how long the respondent took by its own clock (elapsed_ms), so a phone set to the
 * wrong time cannot skew the duration; started_at is worked back from it.
 */
function submit_(request) {
  const id = id_(request.id)
  if (!id) return { ok: false, error: "bad_request" }
  const responses = sheet_("responses")
  const earlier = find_(responses, "response_id", id)
  if (earlier) return { ok: true, submitted_at: earlier.record.submitted_at }
  if (!find_(sheet_("consents"), "response_id", id)) return { ok: false, error: "no_consent" }
  const answers = request.answers || {}
  const now = new Date()
  const elapsed = Number(request.elapsed_ms)
  const timed = isFinite(elapsed) && elapsed > 0 && elapsed < 7 * 24 * 3600 * 1000
  const record = { response_id: id, group: group_(id, request.group), P1_age: age_(answers.P1_age) }
  PROFILE_TEXT.forEach((k) => {
    record[k] = text_(answers[k], 200)
  })
  LIKERT_COLUMNS.forEach((k) => {
    record[k] = likert_(answers[k])
  })
  record.pilot_feedback = text_(answers.pilot_feedback, 4000)
  record.started_at = timed ? stamp_(new Date(now.getTime() - elapsed)) : ""
  record.submitted_at = stamp_(now)
  record.duration_min = timed ? Math.round(elapsed / 6000) / 10 : ""
  append_(responses, record)
  return { ok: true, submitted_at: record.submitted_at }
}

/** Everything the researchers' page shows, behind the password. */
function summary_(request) {
  const expected = password_()
  if (!expected) return { ok: false, error: "no_password" }
  if (String(request.password || "") !== expected) return { ok: false, error: "password" }
  return {
    ok: true,
    now: stamp_(new Date()),
    responses: grid_(sheet_("responses")),
    consents: grid_(sheet_("consents")),
  }
}

/* ---------- the Sheet ---------- */

function tab_(book, name, columns) {
  const sheet = book.getSheetByName(name) || book.insertSheet(name)
  const header = header_(sheet)
  const same = header.length === columns.length && columns.every((c, i) => header[i] === c)
  if (!same) {
    if (sheet.getLastRow() <= 1) {
      // a new tab, or one with only an earlier version's header: write this version's
      const width = Math.max(header.length, columns.length)
      const row = columns.concat(new Array(width - columns.length).fill(""))
      sheet.getRange(1, 1, 1, width).setValues([row]).setFontWeight("bold")
      sheet.setFrozenRows(1)
    } else {
      // rows already there: keep every column, add the missing ones at the end
      const missing = columns.filter((c) => header.indexOf(c) < 0)
      if (missing.length) {
        sheet.getRange(1, header.length + 1, 1, missing.length).setValues([missing]).setFontWeight("bold")
      }
    }
  }
  header_(sheet).forEach((h, i) => {
    if (NUMBER_COLUMNS.indexOf(h) < 0) {
      sheet.getRange(1, i + 1, sheet.getMaxRows(), 1).setNumberFormat("@")
    }
  })
  return sheet
}

function sheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name)
  if (!sheet) throw new Error("The " + name + " tab is missing: run setup once.")
  return sheet
}

function header_(sheet) {
  const width = sheet.getLastColumn()
  return width ? sheet.getRange(1, 1, 1, width).getDisplayValues()[0] : []
}

/** every row under the header, as { row: its number in the Sheet, record: { column: its text } } */
function rows_(sheet) {
  const height = sheet.getLastRow()
  const width = sheet.getLastColumn()
  if (height < 2 || width < 1) return []
  const values = sheet.getRange(1, 1, height, width).getDisplayValues()
  const header = values[0]
  const out = []
  for (let i = 1; i < values.length; i++) {
    if (values[i].every((v) => v === "")) continue
    const record = {}
    header.forEach((h, j) => {
      if (h) record[h] = values[i][j]
    })
    out.push({ row: i + 1, record: record })
  }
  return out
}

/** a tab as it shows, header row first and empty rows left out: what the CSV files are made of */
function grid_(sheet) {
  const height = sheet.getLastRow()
  const width = sheet.getLastColumn()
  if (height < 1 || width < 1) return []
  return sheet
    .getRange(1, 1, height, width)
    .getDisplayValues()
    .filter((r, i) => i === 0 || r.some((v) => v !== ""))
}

function find_(sheet, column, value) {
  const hits = rows_(sheet).filter((r) => r.record[column] === value)
  return hits.length ? hits[0] : null
}

/** writes the given fields into one row, each under its column */
function setFields_(sheet, row, fields) {
  const header = header_(sheet)
  Object.keys(fields).forEach((k) => {
    const column = header.indexOf(k)
    if (column >= 0) sheet.getRange(row, column + 1).setValue(cell_(fields[k]))
  })
}

/** adds a row, each value under its column, whatever order the columns are in */
function append_(sheet, record) {
  sheet.appendRow(header_(sheet).map((h) => (h in record ? cell_(record[h]) : "")))
}

/* ---------- values ---------- */

/** A text that starts like a formula gets an apostrophe, so the Sheet keeps it as text. */
function cell_(value) {
  if (typeof value === "string" && /^[=+\-@]/.test(value)) return "'" + value
  return value
}

function text_(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function likert_(value) {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 ? value : ""
}

function age_(value) {
  const t = text_(value, 20)
  return /^\d{1,3}$/.test(t) ? Number(t) : t
}

/** the questionnaire's own id, made on the phone: R- and 6 to 12 letters or digits (T- for a test) */
function id_(value) {
  const id = String(value || "").trim().toUpperCase()
  return /^[RT]-[A-Z0-9]{6,12}$/.test(id) ? id : null
}

/** a test run is always T; anyone else is the group of the year level they picked, or blank */
function group_(id, group) {
  if (id.charAt(0) === "T") return "T"
  return GROUPS.indexOf(group) >= 0 && group !== "T" ? group : ""
}

function pad_(n) {
  return (n < 10 ? "0" : "") + n
}

function likertColumns_(parts) {
  const columns = []
  parts.forEach((p) => {
    for (let i = 1; i <= p[1]; i++) columns.push(p[0] + "_" + pad_(i))
  })
  return columns
}

function stamp_(date) {
  return Utilities.formatDate(date, TIME_ZONE, "yyyy-MM-dd HH:mm:ss")
}

function password_() {
  return (
    RESEARCHER_PASSWORD ||
    PropertiesService.getScriptProperties().getProperty("RESEARCHER_PASSWORD") ||
    ""
  )
}

/** one write at a time, so two phones sending at once can't trip over each other */
function locked_(work) {
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    return work()
  } finally {
    lock.releaseLock()
  }
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  )
}
