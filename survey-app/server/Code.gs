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

/**
 * The questionnaire can be read in English or Filipino. The answers are saved the same way in
 * either (1 to 5, and Part I in the form's English words); the last column of each tab, language,
 * says which it was: en or fil. It is last so that setup can add it to tabs that already have rows.
 */
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
/** The age is not asked (Ian, 2026-11-19), so there is no P1_age column: Part I starts at the sex. */
const RESPONSE_COLUMNS = ["response_id", "group"].concat(PROFILE_TEXT, LIKERT_COLUMNS, [
  "pilot_feedback",
  "started_at",
  "submitted_at",
  "duration_min",
  "language",
])
/** columns that hold numbers, so the Sheet can average them; every other column stays plain text */
const NUMBER_COLUMNS = ["duration_min"].concat(LIKERT_COLUMNS)

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
 * Run once from the editor (pick setup beside Debug, then Run): makes the two tabs and gives them
 * their look. Running it again is safe: it never deletes anything, and gives the same look. A tab
 * made by an earlier version of this file gets this version's columns.
 *
 * The tabs come first and the look second, so a problem with a colour can never stop the tabs
 * from being ready for answers: the log then says what stopped.
 */
function setup() {
  const book = SpreadsheetApp.getActiveSpreadsheet()
  const consents = tab_(book, "consents", CONSENT_COLUMNS)
  const responses = tab_(book, "responses", RESPONSE_COLUMNS)
  const notes = []
  try {
    style_(consents, TAB_COLOURS.consents)
    style_(responses, TAB_COLOURS.responses)
  } catch (err) {
    notes.push(
      "The two tabs are ready and can be used. Only their colours and widths are not finished: " +
        String((err && err.message) || err),
    )
  }
  if (!password_()) {
    notes.push("Put a password in RESEARCHER_PASSWORD at the top of this file before you deploy.")
  }
  Logger.log(notes.length ? "Ready, but: " + notes.join(" ") : "Ready.")
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
    language: language_(request.language),
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
 * wrong time cannot skew the duration; started_at is worked back from it. language is the one on
 * screen at SUBMIT: a respondent who switched part-way shows only as the last one.
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
  const record = { response_id: id, group: group_(id, request.group) }
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
  record.language = language_(request.language)
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

/* ---------- how the tabs look ---------- */

/**
 * The look of the two tabs (Ian, 2026-11-19: "formatted and styled properly"). Nothing here
 * changes what a cell holds or shows, because the CSV files are made of what shows (grid_): so
 * no number or date formats, no checkboxes, no merged cells and no second header row. Only
 * colours, widths, alignment, frozen panes and a warning on the header.
 *
 *   the header     one colour per part of the questionnaire, so the 49 answer columns can be told
 *                  apart; in consents, red over the columns that hold names
 *   frozen         the header row, and the columns that say whose row it is (response_id, group)
 *   the rows       every other row lightly shaded, to read across
 *   amber          an answer left blank in a submitted row
 *   gray italics   a test run (its id starts with T-)
 */
const TAB_COLOURS = { consents: "#ff4b4b", responses: "#ff9600" }
const HEADER_INK = "#3c3c3c"
const TINTS = {
  plain: "#e5e5e5",
  names: "#ffd7d8",
  profile: "#ffebcf",
  P2: "#d6ecff",
  P3: "#e4ffcf",
  P4: "#ece1ff",
  P5: "#ffd9ec",
  feedback: "#fff3bf",
}
const ROW_SHADES = ["#ffffff", "#f7f7f7"]
const BLANK_ANSWER = "#ffe9a8"
const TEST_INK = "#afafaf"
/** what Google shows when someone starts to change the header row */
const HEADER_NOTE =
  "The column names. The questionnaire finds each column by its name, so a changed name loses that column's answers."

/** a column's look, from its name: its header's colour, its width in pixels, and how its cells sit */
function look_(name) {
  const part = /^P([2-5])_\d\d$/.exec(name)
  if (part) return { tint: TINTS["P" + part[1]], width: 54, centre: true }
  switch (name) {
    case "response_id":
      return { tint: TINTS.plain, width: 120, id: true }
    case "group":
      return { tint: TINTS.plain, width: 64, centre: true, id: true }
    case "name":
    case "signature":
      return { tint: TINTS.names, width: 200 }
    case "address":
      return { tint: TINTS.names, width: 260 }
    case "data_use_1":
    case "data_use_2":
    case "data_use_3":
      return { tint: TINTS.profile, width: 96, centre: true }
    case "P1_year":
      return { tint: TINTS.profile, width: 200 }
    case "pilot_feedback":
      return { tint: TINTS.feedback, width: 360, wrap: true }
    case "started_at":
    case "submitted_at":
    case "agreed_at":
      return { tint: TINTS.plain, width: 150 }
    case "duration_min":
      return { tint: TINTS.plain, width: 110, centre: true }
    case "language":
      return { tint: TINTS.plain, width: 84, centre: true }
  }
  // the rest of Part I, and any column an earlier version of this file left
  return { tint: /^P1_/.test(name) ? TINTS.profile : TINTS.plain, width: 130 }
}

function style_(sheet, tabColour) {
  const header = header_(sheet)
  const width = header.length
  if (!width) return
  const height = sheet.getMaxRows()
  const looks = header.map(look_)
  const top = sheet.getRange(1, 1, 1, width)

  sheet.setTabColor(tabColour)
  sheet.setFrozenRows(1)
  // the columns that say whose row it is stay in view while the others scroll by
  let frozen = 0
  while (frozen < width && looks[frozen].id) frozen++
  sheet.setFrozenColumns(frozen)

  // every cell: at the top of its row, and a long text cut at its cell's edge
  sheet
    .getRange(1, 1, height, width)
    .setVerticalAlignment("top")
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
  // widths and centring, a run of like columns at a time
  runs_(looks.map((l) => [l.width, !!l.centre, !!l.wrap].join())).forEach((run) => {
    const look = looks[run.start]
    sheet.setColumnWidths(run.start + 1, run.length, look.width)
    const cells = sheet.getRange(1, run.start + 1, height, run.length)
    cells.setHorizontalAlignment(look.centre ? "center" : "left")
    if (look.wrap) cells.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
  })

  // the header
  sheet.setRowHeight(1, 34)
  top
    .setBackgrounds([looks.map((l) => l.tint)])
    .setFontColor(HEADER_INK)
    .setFontWeight("bold")
    .setVerticalAlignment("middle")
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)

  // the rows under it, shaded in turn. An earlier run's shading goes first: Sheets refuses two
  sheet.getBandings().forEach((b) => b.remove())
  const rules = []
  if (height > 1) {
    sheet
      .getRange(2, 1, height - 1, width)
      .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false)
      .setFirstRowColor(ROW_SHADES[0])
      .setSecondRowColor(ROW_SHADES[1])

    // what depends on a row's own cells. The formulas are written for row 2 and Sheets moves them
    // along: $A2 stays in column A, K2 goes with the cell
    const id = header.indexOf("response_id")
    if (id >= 0) {
      const whose = "$" + letters_(id + 1) + "2"
      const answers = runs_(header.map((h) => (LIKERT_COLUMNS.indexOf(h) >= 0 ? "answer" : ""))).filter(
        (run) => run.key === "answer",
      )
      if (answers.length) {
        rules.push(
          SpreadsheetApp.newConditionalFormatRule()
            .whenFormulaSatisfied("=AND(" + whose + '<>"",ISBLANK(' + letters_(answers[0].start + 1) + "2))")
            .setBackground(BLANK_ANSWER)
            .setRanges(answers.map((run) => sheet.getRange(2, run.start + 1, height - 1, run.length)))
            .build(),
        )
      }
      rules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .whenFormulaSatisfied("=LEFT(" + whose + ',2)="T-"')
          .setFontColor(TEST_INK)
          .setItalic(true)
          .setRanges([sheet.getRange(2, 1, height - 1, width)])
          .build(),
      )
    }
  }
  // the whole list at once, so a second run replaces the rules instead of adding to them
  sheet.setConditionalFormatRules(rules)

  // a warning (not a lock) on the header row, since a changed name loses that column's answers
  sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach((p) => {
    if (p.getDescription() === HEADER_NOTE) p.remove()
  })
  sheet.getRange(1, 1, 1, sheet.getMaxColumns()).protect().setDescription(HEADER_NOTE).setWarningOnly(true)
}

/** the runs of equal neighbours in a list: [{ key, start (from 0), length }] */
function runs_(keys) {
  const out = []
  keys.forEach((key, i) => {
    const last = out[out.length - 1]
    if (last && last.key === key) last.length++
    else out.push({ key: key, start: i, length: 1 })
  })
  return out
}

/** a column's letters, from its number: 1 is A, 27 is AA */
function letters_(n) {
  let out = ""
  while (n > 0) {
    out = String.fromCharCode(65 + ((n - 1) % 26)) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
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

/** the language the questionnaire was read in: en (English) or fil (Filipino), or blank if the app didn't say */
function language_(value) {
  return value === "en" || value === "fil" ? value : ""
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
