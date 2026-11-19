import { createGoogle, loadCode, type FakeBook, type FakeSheet } from "./googleFakes.ts"

/**
 * A picture of the look setup gives the Google Sheet (Ian, 2026-11-19): `pnpm dev`, then
 * /dev-api/sheet-preview. It runs the real Code.gs on a pretend Sheet of its own, with a few
 * made-up rows, and draws what Code.gs asked for: colours, widths, frozen columns, the marks on
 * blank answers and on test runs. The real Sheet can differ a little (fonts, the exact grays).
 */

const esc = (s: unknown) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c)

const letters = (n: number) => {
  let out = ""
  for (; n > 0; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(65 + ((n - 1) % 26)) + out
  return out
}

/** made-up respondents: a pilot with remarks, one who skipped two items, a Filipino run, a test run */
function sample(source: string): FakeBook {
  const google = createGoogle({ password: "dev" })
  const app = loadCode(source, google.globals)
  app.setup()
  const part = (id: string, n: number, seed: number, skip: number[] = []) =>
    Object.fromEntries(
      Array.from({ length: n }, (_, i) => [`${id}_${String(i + 1).padStart(2, "0")}`, ((i * 7 + seed * 3) % 5) + 1]).filter(
        (_, i) => !skip.includes(i + 1),
      ),
    )
  const people = [
    {
      id: "R-K7Q2XM4P",
      name: "Maria Santos",
      address: "Obrero, Davao City",
      group: "P",
      language: "en",
      minutes: 11.4,
      profile: { P1_sex: "Female", P1_year: "Third year (pilot test only)", P1_l1: "Bisaya/Cebuano", P1_home: "Bisaya/Cebuano", P1_engfreq: "Sometimes" },
      feedback: "Part III item 10 was a little unclear. I was not sure if it means saying the word in Bisaya first.",
      skip: [] as number[],
    },
    {
      id: "R-M3TB8WQA",
      name: "Juan Dela Cruz",
      address: "Mintal, Davao City",
      group: "Y1",
      language: "en",
      minutes: 9.8,
      profile: { P1_sex: "Male", P1_year: "First year", P1_l1: "Other", P1_l1_other: "Mandaya", P1_home: "Bisaya/Cebuano", P1_engfreq: "Rarely" },
      feedback: "",
      skip: [4, 5],
    },
    {
      id: "R-P9HZ4CNE",
      name: "Ana Reyes",
      address: "Toril, Davao City",
      group: "Y2",
      language: "fil",
      minutes: 13.1,
      profile: { P1_sex: "Female", P1_year: "Second year", P1_l1: "Filipino/Tagalog", P1_home: "Other", P1_home_other: "Kalagan", P1_engfreq: "Often" },
      feedback: "",
      skip: [] as number[],
    },
    {
      id: "T-ETQD5AEX",
      name: "Test run",
      address: "",
      group: "Y1",
      language: "en",
      minutes: 1.2,
      profile: { P1_sex: "Prefer not to say", P1_year: "First year", P1_l1: "English", P1_home: "English", P1_engfreq: "Always" },
      feedback: "",
      skip: [] as number[],
    },
  ]
  people.forEach((p, i) => {
    app.post({ action: "consent", id: p.id, name: p.name, signature: p.name, address: p.address, data_use: [1 + (i % 3)], language: p.language })
    app.post({
      action: "submit",
      id: p.id,
      group: p.group,
      language: p.language,
      elapsed_ms: p.minutes * 60000,
      answers: {
        ...p.profile,
        ...part("P2", 8, i, p.skip),
        ...part("P3", 21, i + 1),
        ...part("P4", 10, i + 2, p.skip.slice(0, 1)),
        ...part("P5", 10, i + 3),
        pilot_feedback: p.feedback,
      },
    })
  })
  return google.book
}

const GUTTER = 46

function table(sheet: FakeSheet, rows: number): string {
  const width = sheet.getLastColumn()
  const widths = Array.from({ length: width }, (_, i) => sheet.columnWidths.get(i + 1) ?? 100)
  /** where a frozen column sticks: after the row numbers and the frozen columns before it */
  const left = (column: number) => GUTTER + widths.slice(0, column - 1).reduce((a, b) => a + b, 0)
  const sticky = (column: number) =>
    column <= sheet.frozenColumns ? `position:sticky;left:${left(column)}px;z-index:2;` : ""
  const edge = (column: number) => (column === sheet.frozenColumns ? "border-right:2px solid #c0c0c0;" : "")

  const head =
    `<tr><th class="corner"></th>` +
    widths.map((w, i) => `<th class="letter" style="width:${w}px;min-width:${w}px;max-width:${w}px;${sticky(i + 1)}${edge(i + 1)}">${letters(i + 1)}</th>`).join("") +
    `</tr>`
  const body = Array.from({ length: rows }, (_, r) => {
    const row = r + 1
    const height = sheet.rowHeights.get(row)
    const cells = widths.map((w, i) => {
      const look = sheet.look(row, i + 1)
      const style = [
        `width:${w}px;min-width:${w}px;max-width:${w}px`,
        `background:${look.background ?? "#ffffff"}`,
        look.fontColor ? `color:${look.fontColor}` : "",
        look.fontWeight === "bold" ? "font-weight:700" : "",
        look.italic ? "font-style:italic" : "",
        `text-align:${look.align ?? "left"}`,
        `vertical-align:${look.valign ?? "bottom"}`,
        look.wrap === "WRAP" ? "white-space:normal" : "white-space:nowrap;overflow:hidden",
        row === sheet.frozenRows ? "border-bottom:2px solid #c0c0c0" : "",
      ]
      return `<td style="${style.filter(Boolean).join(";")};${sticky(i + 1)}${edge(i + 1)}">${esc(sheet.read(row, i + 1))}</td>`
    })
    return `<tr${height ? ` style="height:${height}px"` : ""}><th class="number">${row}</th>${cells.join("")}</tr>`
  }).join("")
  return `<table>${head}${body}</table>`
}

function tab(sheet: FakeSheet): string {
  const answered = sheet.getLastRow()
  const warned = sheet.protections.some((p) => p.warningOnly && p.box.row === 1)
  const notes = [
    `${sheet.getLastColumn()} columns`,
    `row ${sheet.frozenRows} and the first ${sheet.frozenColumns} ${sheet.frozenColumns === 1 ? "column" : "columns"} stay in view`,
    warned ? "changing a column name asks first" : "",
  ]
  return (
    `<section data-tab="${esc(sheet.name)}">` +
    `<h2><span class="tabname" style="border-bottom-color:${esc(sheet.tabColor ?? "#ffffff")}">${esc(sheet.name)}</span>` +
    `<small>${notes.filter(Boolean).join(" · ")}</small></h2>` +
    `<div class="scroll">${table(sheet, answered + 4)}</div>` +
    `</section>`
  )
}

/** the page: both tabs as Code.gs styles them, with made-up rows */
export function sheetPreview(source: string): string {
  const book = sample(source)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>How the Google Sheet will look</title>
<style>
  body { margin: 0; padding: 24px; background: #f3f4f6; color: #3c3c3c; font: 14px/1.5 Arial, Helvetica, sans-serif; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  p { margin: 0 0 20px; max-width: 760px; color: #777777; }
  section { margin-bottom: 28px; }
  h2 { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px; margin: 0 0 8px; font-size: 15px; }
  h2 small { font-weight: 400; color: #777777; }
  .tabname { padding: 4px 12px; background: #ffffff; border-bottom: 3px solid; border-radius: 4px 4px 0 0; }
  .scroll { overflow-x: auto; background: #ffffff; border: 1px solid #d0d0d0; }
  table { border-collapse: separate; border-spacing: 0; table-layout: fixed; font: 13px Arial, Helvetica, sans-serif; color: #000000; }
  td, th { box-sizing: border-box; padding: 3px 4px; border-right: 1px solid #e2e2e2; border-bottom: 1px solid #e2e2e2; text-overflow: clip; }
  th { background: #f8f9fa; color: #5f6368; font-weight: 400; font-size: 11px; text-align: center; }
  th.corner, th.number { position: sticky; left: 0; z-index: 3; width: ${GUTTER}px; min-width: ${GUTTER}px; }
  ul { margin: 0; padding-left: 18px; color: #777777; }
  .key { display: inline-block; width: 12px; height: 12px; margin-right: 6px; border: 1px solid #d0d0d0; vertical-align: -1px; }
</style>
</head>
<body>
<h1>How the Google Sheet will look</h1>
<p>What <b>setup</b> in Code.gs asks Google Sheets for, drawn with made-up rows. The real Sheet can differ a little. Scroll each tab sideways.</p>
${book.sheets.map(tab).join("")}
<ul>
  <li><span class="key" style="background:#ffe9a8"></span>an answer left blank in a submitted row</li>
  <li><span class="key" style="background:#ffffff"></span><i style="color:#afafaf">gray italics</i>: a test run (its id starts with T-), which the researchers' page leaves out</li>
</ul>
</body>
</html>`
}
