/**
 * The English and the Filipino questionnaire side by side, for whoever checks the Filipino (the
 * research adviser, a Filipino-language teacher): every text a respondent can see, in the order it
 * is shown, with a column for remarks. It writes filipino-review.html, which opens in a browser
 * and prints.
 *
 *   node scripts/review_sheet.mjs            (or pnpm review-sheet)
 */
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { createServer } from "vite"

const root = fileURLToPath(new URL("..", import.meta.url))
const server = await createServer({ root, server: { middlewareMode: true }, appType: "custom", logLevel: "error" })
const { texts, paragraphs } = await server.ssrLoadModule("/src/survey.ts")
const { strings } = await server.ssrLoadModule("/src/strings.ts")
await server.close()

const { en, fil } = texts
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")
let rows = 0
const row = (what, a, b) => `<tr><td class="n">${++rows}</td><td class="what">${esc(what)}</td><td>${esc(a)}</td><td lang="fil">${esc(b)}</td><td></td></tr>`
const section = (title, body) => `<h2>${esc(title)}</h2><table><thead><tr><th>#</th><th>Where</th><th>English (validated)</th><th>Filipino</th><th>Remarks</th></tr></thead><tbody>${body.join("")}</tbody></table>`
/** a text of several paragraphs, a row each */
const paras = (what, a, b) => {
  const [x, y] = [paragraphs(a), paragraphs(b)]
  return x.map((p, i) => row(x.length > 1 ? `${what}, paragraph ${i + 1}` : what, p, y[i] ?? ""))
}

const out = []

out.push(
  section("Start screen and age check", [
    row("Title (stays English)", en.title, fil.title),
    ...paras("About", en.description, fil.description),
    row("Age check", en.age_check.question, fil.age_check.question),
    ...en.age_check.options.map((o, i) => row("Answer", o, fil.age_check.options[i])),
    row("Under 18: title", en.age_check.stop_title, fil.age_check.stop_title),
    row("Under 18: message", en.age_check.stop_message, fil.age_check.stop_message),
  ]),
)

out.push(
  section("Consent form", [
    row("Title", en.consent.title, fil.consent.title),
    ...paras("Introduction", en.consent.intro, fil.consent.intro),
    ...en.consent.sections.flatMap((s, i) => [
      row("Heading", s.title, fil.consent.sections[i].title),
      ...paras(s.title, s.body, fil.consent.sections[i].body),
    ]),
    row("Data use", en.consent.data_use.prompt, fil.consent.data_use.prompt),
    ...en.consent.data_use.options.map((o, i) => row(`Box ${i + 1}`, o, fil.consent.data_use.options[i])),
    row("Field", en.consent.fields.name, fil.consent.fields.name),
    row("Field", en.consent.fields.signature, fil.consent.fields.signature),
    row("Field", en.consent.fields.address, fil.consent.fields.address),
    row("Question", en.consent.agree.question, fil.consent.agree.question),
    row("Button", en.consent.agree.yes, fil.consent.agree.yes),
    row("Link", en.consent.agree.no, fil.consent.agree.no),
  ]),
)

out.push(
  section("Letter and general directions", [
    row("Greeting", en.letter.greeting, fil.letter.greeting),
    ...paras("Letter", en.letter.body, fil.letter.body),
    row("Heading", en.general_directions.title, fil.general_directions.title),
    ...paras("General directions", en.general_directions.body, fil.general_directions.body),
  ]),
)

en.parts.forEach((part, p) => {
  const other = fil.parts[p]
  const body = [row("Title", part.title, other.title), row("Directions", part.directions, other.directions)]
  if (p === 0) {
    part.items.forEach((item, i) => {
      if (item.id === "P1_age") return
      body.push(row(item.id, item.label, other.items[i].label))
      ;(item.options ?? []).forEach((o, k) => body.push(row(`${item.id} answer`, o, other.items[i].options[k])))
      if (item.other) {
        body.push(row(`${item.id} answer`, strings.en.other, strings.fil.other))
        body.push(row(`${item.id} answer`, strings.en.specify, strings.fil.specify))
      }
      if (item.id === "P1_year") {
        body.push(row("Shown on the third-year card", strings.en.thirdYear, strings.fil.thirdYear))
        body.push(row("Card that cannot be picked", strings.en.fourthYear, strings.fil.fourthYear))
      }
    })
  } else {
    body.push(row("Stem (above every item)", part.stem, other.stem))
    part.scale.forEach((s, i) => body.push(row(`Scale ${s.value}`, s.label, other.scale[i].label)))
    part.items.forEach((item, i) => body.push(row(item.id, item.text, other.items[i].text)))
  }
  out.push(section(part.title, body))
})

out.push(
  section("Pilot question and closing", [
    row("Title", en.pilot_only.title, fil.pilot_only.title),
    row("Introduction", en.pilot_only.intro, fil.pilot_only.intro),
    row("Question", en.pilot_only.question, fil.pilot_only.question),
    row("Thank-you", en.closing_message, fil.closing_message),
  ]),
)

const show = (v) => (typeof v === "function" ? null : v)
const samples = {
  part: (s) => s.part("II"),
  pageOf: (s) => s.pageOf(3, 14),
  itemOf: (s) => s.itemOf(3, 21),
  date: (s) => s.date(new Date(2026, 10, 19)),
  answered: (s) => s.answered(52, 54),
  goToItem: (s) => s.goToItem("II.3"),
  blankCount: (s) => `${s.blankCount(1)} / ${s.blankCount(2)} / ${s.blankCount(4)}`,
}
out.push(
  section(
    "The app's own words (buttons, counts, dialogs, messages)",
    Object.keys(strings.en)
      .filter((k) => !["name", "short"].includes(k))
      .map((k) => row(k, samples[k]?.(strings.en) ?? show(strings.en[k]), samples[k]?.(strings.fil) ?? show(strings.fil[k]))),
  ),
)

const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>English and Filipino questionnaire, side by side</title>
<style>
  body { font: 14px/1.45 system-ui, sans-serif; color: #222; margin: 24px auto; max-width: 1100px; padding: 0 16px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 28px 0 8px; }
  p, li { max-width: 800px; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  th, td { border: 1px solid #bbb; padding: 6px 8px; vertical-align: top; text-align: left; overflow-wrap: anywhere; }
  th { background: #f1f1f1; font-size: 12px; }
  th:nth-child(1), td.n { width: 34px; color: #777; font-size: 12px; }
  th:nth-child(2), td.what { width: 110px; color: #555; font-size: 12px; }
  th:nth-child(5) { width: 20%; }
  tr { break-inside: avoid; }
  @media print { body { margin: 0; max-width: none; font-size: 11px; } h2 { break-after: avoid; } }
</style>
<h1>English and Filipino questionnaire, side by side</h1>
<p><em>${esc(en.title)}</em></p>
<p>Every text a respondent can see, in the order it is shown. The English column is the validated
instrument. The Filipino column is a translation that has not yet been validated: please mark
anything that is wrong, unclear or different in meaning in the Remarks column, by row number.
Names, the study title and the English examples inside the items stay in English on purpose.</p>
<p>Made from <code>src/questionnaire.json</code>, <code>src/questionnaire.fil.json</code> and
<code>src/strings.ts</code> on ${new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
(${rows} rows).</p>
${out.join("\n")}
</html>
`
const file = fileURLToPath(new URL("../filipino-review.html", import.meta.url))
writeFileSync(file, html)
console.log(`${rows} rows → ${file}`)
