/**
 * The whole questionnaire, end to end, in a real browser against the real Code.gs (on the pretend
 * Sheet of `pnpm dev`): it starts the dev server, answers as a pilot respondent on a small phone
 * (360 × 640) and as a first year on a laptop, takes a break and comes back, declines, checks that
 * no question screen needs scrolling, that the Likert slider stays in its place and starts every
 * item with nothing picked, that the rows land in the right tabs, and that the researchers' page
 * counts them and exports them. Then the same questionnaire in Filipino (a second year on a
 * phone): every screen in Filipino, the switch in the middle of a part and back, the language
 * remembered, and a row saved exactly as an English one is. Screenshots go to e2e-out/.
 *
 *   node scripts/e2e.mjs            (or pnpm e2e)
 */
import { mkdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { createServer } from "vite"

const root = fileURLToPath(new URL("..", import.meta.url))
const out = fileURLToPath(new URL("../e2e-out/", import.meta.url))
mkdirSync(out, { recursive: true })

const server = await createServer({ root, server: { port: 5199, strictPort: true }, logLevel: "error" })
await server.listen()
const base = "http://localhost:5199"
const browser = await chromium.launch()
const problems = []
const fail = (msg) => {
  problems.push(msg)
  console.log("  ✗", msg)
}

/** after a step change, wait for the old screen to have drifted out */
const settle = (page) => page.waitForTimeout(520)

async function overflow(page) {
  return page.evaluate(() => {
    const stages = [...document.querySelectorAll("main > [data-stage]")].filter((d) => d.getAttribute("aria-hidden") !== "true")
    const s = stages.at(-1)
    if (!s) return 0
    // a Likert item's words scroll in a box of their own, above the slider
    const words = s.querySelector("[data-scroll]")
    return Math.max(s.scrollHeight - s.clientHeight, words ? words.scrollHeight - words.clientHeight : 0)
  })
}

/** the middle of a stop of the Likert slider */
async function stopAt(page, value) {
  const box = await page.locator(`[role="radiogroup"] button[aria-label^="${value} "] span.rounded-full`).last().boundingBox()
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function clickNext(page) {
  await page.locator('[data-bar="right"]').click()
  await settle(page)
}

/** the words the walk finds its way by, in each language */
const WORDS = {
  en: { yes: "Yes", end: "reached the end", other: "Other" },
  fil: { yes: "Oo", end: "Narating na ninyo ang dulo", other: "Iba pa" },
}

/** the language switch in the strip: its two buttons are named "English" and "Filipino" */
async function switchTo(page, name) {
  await page.getByRole("button", { name, exact: true }).click()
  await page.waitForTimeout(120)
}

/**
 * Walks the questionnaire from the start screen to the review. `pick(itemId)` says what to
 * answer (null = leave it blank). With `lang: "fil"` it switches to Filipino on the start screen
 * and goes by the Filipino words. `onScreen` runs on every screen before it is answered, and
 * `afterPick` after a Likert answer is picked.
 */
async function walk(page, { pick, shots, lang = "en", onScreen, afterPick }) {
  const W = WORDS[lang]
  const scrolled = []
  /** where the Likert slider's top is, on every item: one place only */
  const sliderAt = new Set()
  let likertItems = 0
  await page.goto(base + "/")
  if (lang === "fil") await switchTo(page, "Filipino")
  await onScreen?.("start")
  await shots?.("01-start")
  await clickNext(page)
  let guard = 0
  let shotKinds = new Set()
  for (;;) {
    if (++guard > 120) throw new Error("the questionnaire never ended")
    const chip = (await page.locator("[data-chip]").first().textContent().catch(() => "")) ?? ""
    const heading = (await page.locator("main h1").last().textContent().catch(() => "")) ?? ""
    const over = await overflow(page)
    const snap = async (kind) => {
      if (shots && !shotKinds.has(kind)) {
        shotKinds.add(kind)
        await shots(`${String(shotKinds.size + 1).padStart(2, "0")}-${kind}`)
      }
    }
    await onScreen?.(`${chip} "${heading.slice(0, 40)}"`)
    if (await page.getByRole("radio", { name: W.yes, exact: true }).count()) {
      await snap("age")
      await page.getByRole("radio", { name: W.yes, exact: true }).click()
      await clickNext(page)
      continue
    }
    if (await page.getByRole("checkbox").count()) {
      await snap("data-use")
      if (over > 0) scrolled.push(["data use", over])
      await page.getByRole("checkbox").first().click()
      await page.getByRole("checkbox").nth(2).click()
      await clickNext(page)
      continue
    }
    if (await page.locator("#name").count()) {
      await page.locator("#name").fill("Maria Santos")
      await page.locator("#signature").fill("Maria Santos")
      await page.locator("#address").fill("Obrero, Davao City")
      await snap("sign")
      if (over > 0) scrolled.push(["sign", over])
      await clickNext(page)
      continue
    }
    if (await page.locator("#pilot").count()) {
      await page.locator("#pilot").fill("Part III item 10 was a little unclear.")
      await snap("pilot")
      await clickNext(page)
      continue
    }
    if (heading.includes(W.end)) {
      await snap("review")
      if (sliderAt.size > 1) fail(`the Likert slider moved from item to item: its top was at ${[...sliderAt].join(", ")}px`)
      return { scrolled }
    }
    const likert = page.locator('[role="radiogroup"] button[aria-label^="5 "]')
    if (await likert.count()) {
      if (over > 0) scrolled.push([`${chip} "${heading.slice(0, 40)}"`, over])
      // the slider stays from the item before, but nothing is picked on a new item
      const before = await page.locator('[role="radio"][aria-checked="true"]').count()
      if (before || (await page.locator('[role="radiogroup"] .press').count())) fail(`${chip} "${heading.slice(0, 40)}" shows an answer before any is picked`)
      sliderAt.add(Math.round((await page.locator('[role="radiogroup"]').last().boundingBox()).y))
      const id = await page.evaluate(() => document.querySelector("main h1")?.textContent)
      const value = pick(`${chip}|${id}`)
      if (value) {
        if (++likertItems % 6 === 0) {
          // now and then by sliding the knob: down on another stop, along, and let go near the answer
          const from = await stopAt(page, value === "3" ? 5 : 3)
          const to = await stopAt(page, value)
          await page.mouse.move(from.x, from.y)
          await page.mouse.down()
          await page.mouse.move(to.x + 6, to.y + 14, { steps: 6 })
          await page.mouse.up()
        } else await page.locator(`[role="radiogroup"] button[aria-label^="${value} "]`).last().click()
        const got = await page.locator('[role="radio"][aria-checked="true"]').getAttribute("aria-label")
        if (!got?.startsWith(`${value} `)) fail(`${chip} "${heading.slice(0, 40)}": picked ${value}, the slider says ${got}`)
        await afterPick?.({ chip, heading, value, n: likertItems })
      }
      await snap(`likert-${chip.replace(/\s+/g, "")}`)
      await clickNext(page)
      continue
    }
    if (await page.locator("#P1_age").count()) fail("the age is asked in Part I")
    const radios = page.locator('main [role="radiogroup"] [role="radio"]')
    if (await radios.count()) {
      if (over > 0) scrolled.push([`profile "${heading}"`, over])
      const v = pick(heading)
      if (v) {
        await page.getByRole("radio", { name: v, exact: true }).last().click()
        if (v === W.other) await page.locator("#other").fill("Mandaya")
      }
      await snap(v === W.other ? "profile-other" : "profile-choice")
      await clickNext(page)
      continue
    }
    // a page to read: the consent form, the letter, the directions, a part's directions
    if (over > 0) scrolled.push([`${chip} "${heading.slice(0, 40)}"`, over])
    await snap(`read-${chip.replace(/\s+/g, "")}`)
    await clickNext(page)
  }
}

async function context(size) {
  const phone = size.width < 755
  const ctx = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 2,
    isMobile: phone,
    hasTouch: phone,
    acceptDownloads: true,
  })
  const page = await ctx.newPage()
  page.on("console", (m) => m.type() === "error" && fail(`console error: ${m.text()}`))
  page.on("pageerror", (e) => fail(`page error: ${e.message}`))
  return { ctx, page }
}

const sheets = async () => (await fetch(base + "/dev-api/sheets")).json()
const records = (rows) => rows.slice(1).map((r) => Object.fromEntries(rows[0].map((h, i) => [h, r[i]])))

try {
  await fetch(base + "/dev-api/reset", { method: "POST" })

  /* ---------- a pilot respondent on a small phone, answering everything ---------- */
  console.log("pilot respondent, 360 × 640 phone")
  {
    const { ctx, page } = await context({ width: 360, height: 640 })
    let n = 0
    const shots = (name) => page.screenshot({ path: `${out}phone-${name}.png` })
    const answersByScreen = {
      Sex: "Female",
      "Year level": "Third year", // the card's words; the answer saved is "Third year (pilot test only)"
      "First language, the language you learned first at home": "Other",
      "Language you use most often at home": "Bisaya/Cebuano",
      "How often do you speak English outside your classes?": "Sometimes",
    }
    const pick = (key) => answersByScreen[key] ?? String(((n++ % 5) + 1))
    const t0 = Date.now()
    const { scrolled } = await walk(page, { pick, shots })
    console.log(`  walked to the review in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
    if (scrolled.length) console.log("  screens that scroll at 360 × 640:", scrolled)
    const notReading = scrolled.filter(([what]) => !/Informed consent|Letter|Directions/.test(what) || /"/.test(what) === false)
    for (const [what, px] of scrolled) {
      if (/^Part|profile|age|data use|sign/.test(what)) fail(`${what} scrolls by ${px}px on a 360 × 640 phone`)
    }
    void notReading
    const reviewText = await page.locator("main").last().textContent()
    if (!reviewText.includes("You answered 54 of 54 items")) fail(`review says: ${reviewText}`)
    await page.locator('[data-bar="right"]').click()
    await page.getByText("Thank you for answering the questionnaire.").waitFor()
    await settle(page)
    await page.screenshot({ path: `${out}phone-99-done.png` })
    const book = await sheets()
    const [row] = records(book.responses)
    const consent = records(book.consents)[0]
    if (!/^R-[A-HJ-NP-Z2-9]{8}$/.test(row?.response_id)) fail(`response_id is ${row?.response_id}`)
    if (consent?.response_id !== row?.response_id) fail("the consent and the answers don't share a response_id")
    const expect = {
      group: "P",
      P1_age: "",
      P1_sex: "Female",
      P1_year: "Third year (pilot test only)",
      P1_l1: "Other",
      P1_l1_other: "Mandaya",
      P1_home: "Bisaya/Cebuano",
      P1_home_other: "",
      P1_engfreq: "Sometimes",
      pilot_feedback: "Part III item 10 was a little unclear.",
    }
    for (const [k, v] of Object.entries(expect)) if (row?.[k] !== v) fail(`responses.${k} is ${JSON.stringify(row?.[k])}, expected ${JSON.stringify(v)}`)
    const likert = Object.keys(row).filter((k) => /^P[2-5]_/.test(k))
    if (likert.length !== 49 || likert.some((k) => ![1, 2, 3, 4, 5].includes(row[k]))) fail("not all 49 Likert answers were saved as 1–5")
    if (!(row.duration_min > 0)) fail(`duration_min is ${row.duration_min}`)
    if (row.language !== "en" || consent?.language !== "en") fail(`the language saved is ${row.language} (answers) and ${consent?.language} (consent), expected en`)
    if (consent?.name !== "Maria Santos" || consent.data_use_1 !== "Yes" || consent.data_use_2 !== "No" || consent.data_use_3 !== "Yes") fail(`consent row: ${JSON.stringify(consent)}`)
    if (JSON.stringify(book.responses).includes("Maria")) fail("the name reached the responses tab")
    console.log(`  saved: ${likert.length} Likert answers, duration ${row.duration_min} min, consent kept apart`)

    // DONE goes back to a clean start: nothing is left waiting on the phone
    await page.locator('[data-bar="right"]').click()
    await settle(page)
    if ((await page.locator('[data-bar="right"]').textContent()) !== "Start") fail("the start after DONE doesn't read START")
    if (await page.getByText("unfinished questionnaire").count()) fail("a submitted questionnaire still waits on the phone")

    // the under-18 stop
    await page.locator('[data-bar="right"]').click()
    await settle(page)
    await page.getByRole("radio", { name: "No", exact: true }).click()
    await page.locator('[data-bar="right"]').click()
    await page.getByText("You need your parent or guardian’s consent before answering.").waitFor()
    await settle(page)
    await page.screenshot({ path: `${out}phone-98-under-18.png` })
    console.log("  the under-18 stop: as asked")
    const after = await sheets()
    if (records(after.consents).length !== 1) fail("the under-18 stop saved something")
    await ctx.close()
  }

  /* ---------- a first year on a laptop: declines nothing, skips two, resumes after a reload ---------- */
  console.log("first-year respondent, 1280 × 800 laptop")
  {
    const { ctx, page } = await context({ width: 1280, height: 800 })
    let n = 0
    const skip = new Set(["Sex"])
    const pick = (key) => {
      if (skip.has(key)) return null
      if (key === "Year level") return "First year"
      if (key.startsWith("First language") || key.startsWith("Language you use")) return "Filipino/Tagalog"
      if (key.startsWith("How often do you speak")) return "Rarely"
      n++
      return n === 7 ? null : String((n % 5) + 1)
    }
    const shots = (name) => page.screenshot({ path: `${out}laptop-${name}.png` })
    await walk(page, { pick, shots })
    const reviewText = await page.locator("main").last().textContent()
    if (!reviewText.includes("You answered 52 of 54 items")) fail(`review says: ${reviewText}`)

    // a reload keeps everything
    await page.reload()
    await settle(page)
    if (!(await page.getByText("reached the end").count())) fail("a reload lost the place")

    // SUBMIT names the blanks; a tile goes there, the item reads REVIEW, and back to SUBMIT
    await page.locator('[data-bar="right"]').click()
    await page.getByText("2 items left blank").waitFor()
    // the card fades in once the screen has grayed
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${out}laptop-97-blanks.png` })
    await page.getByRole("dialog").getByRole("button", { name: "Go to item I.1" }).click()
    await settle(page)
    await page.getByRole("radio", { name: "Male", exact: true }).click()
    if ((await page.locator('[data-bar="right"]').textContent()) !== "Review") fail("NEXT doesn't read REVIEW after a jump")
    await page.locator('[data-bar="right"]').click()
    await settle(page)
    await page.locator('[data-bar="right"]').click()
    await page.getByText("1 item left blank").waitFor()
    await page.getByRole("button", { name: "Submit anyway" }).click()
    await page.getByText("Thank you for answering the questionnaire.").waitFor()
    const book = await sheets()
    const row = records(book.responses).find((r) => r.group === "Y1")
    if (row?.P1_sex !== "Male" || row.P1_year !== "First year" || row.pilot_feedback !== "") fail(`first-year row: ${JSON.stringify(row)}`)
    const blanksLeft = Object.entries(row).filter(([k, v]) => /^P[2-5]_/.test(k) && v === "").map(([k]) => k)
    if (blanksLeft.length !== 1) fail(`expected one blank Likert answer, got ${blanksLeft}`)
    console.log(`  submitted with ${blanksLeft} left blank, as allowed`)
    await ctx.close()
  }

  /* ---------- a second year on a small phone, in Filipino from the start screen to SUBMIT ---------- */
  console.log("second-year respondent in Filipino, 360 × 640 phone")
  {
    const { ctx, page } = await context({ width: 360, height: 640 })
    let n = 0
    const shots = (name) => page.screenshot({ path: `${out}fil-${name}.png` })
    // the cards' Filipino words; the answers saved are the form's English ones
    const answersByScreen = {
      Kasarian: "Lalaki",
      "Taon sa kolehiyo": "Ikalawang taon",
      "Unang wika, ang wikang una ninyong natutuhan sa tahanan": "Iba pa",
      "Wikang pinakamadalas ninyong gamitin sa tahanan": "Ingles",
      "Gaano kayo kadalas magsalita ng Ingles sa labas ng inyong mga klase?": "Hindi Kailanman",
    }
    const pick = (key) => answersByScreen[key] ?? String(((n++ % 5) + 1))
    // the app's and the form's English words: none may show while the questionnaire is in Filipino.
    // (What stays English has none of them: the study's title, the names, the examples inside items.)
    const english = /\b(next|back|review|submit|start|continue|exit|progress|page \d|part [ivx]+|\d+ of \d+|always|often|sometimes|rarely|never|agree|disagree|yes|directions|please|other|female|male|year|items?|blank|answers?|november)\b/i
    const onScreen = async (where) => {
      const seen = await page.evaluate(() => {
        const labels = [...document.querySelectorAll("[aria-label], [title]")].map((e) => e.getAttribute("aria-label") ?? e.getAttribute("title"))
        return { text: [document.querySelector("#root").innerText, ...labels].join("\n"), lang: document.documentElement.lang }
      })
      const hit = seen.text.match(english)
      if (hit) fail(`English on a Filipino screen (${where}): "${hit[0]}"`)
      if (seen.lang !== "fil") fail(`the page's language is ${seen.lang} on ${where}`)
    }
    /** what must stay as it is when the language changes: the screen, the answers, the slider and its knob */
    const state = () =>
      page.evaluate(() => {
        const group = [...document.querySelectorAll('[role="radiogroup"]')].at(-1)
        const knob = group.querySelector(".press")?.getBoundingClientRect()
        const stages = document.querySelectorAll("main > [data-stage]")
        const session = JSON.parse(localStorage.getItem("wrd-survey:session"))
        return {
          stages: stages.length,
          mark: stages[0]?.dataset.mark ?? "",
          sliderTop: Math.round(group.getBoundingClientRect().top),
          knobLeft: knob ? Math.round(knob.left) : null,
          checked: group.querySelector('[role="radio"][aria-checked="true"]')?.getAttribute("aria-label") ?? "",
          heading: document.querySelector("main h1")?.textContent ?? "",
          chip: document.querySelector("[data-chip]")?.textContent ?? "",
          next: document.querySelector('[data-bar="right"]').textContent,
          shown: document.querySelector("#root").innerText,
          at: session.at,
          answers: JSON.stringify(session.answers),
        }
      })
    let partThree = 0
    const afterPick = async ({ chip, value }) => {
      if (chip !== "Bahagi III" || ++partThree !== 3) return
      // the switch in the middle of a part: the words change where they are, nothing else does
      // (once the knob has popped in: it is measured where it rests)
      await page.waitForTimeout(400)
      const before = problems.length
      await page.evaluate(() => (document.querySelector("main > [data-stage]").dataset.mark = "same"))
      const fil = await state()
      await page.screenshot({ path: `${out}fil-50-switch-filipino.png` })
      await switchTo(page, "English")
      const en = await state()
      await page.screenshot({ path: `${out}fil-51-switch-english.png` })
      if (en.stages !== 1 || en.mark !== "same") fail("switching the language slid to a new screen")
      if (en.at !== fil.at || en.answers !== fil.answers) fail("switching the language changed the place or the answers")
      if (en.sliderTop !== fil.sliderTop || en.knobLeft !== fil.knobLeft || en.knobLeft === null) fail(`switching the language moved the slider: top ${fil.sliderTop} → ${en.sliderTop}, knob ${fil.knobLeft} → ${en.knobLeft}`)
      if (!fil.checked.startsWith(`${value} `) || !en.checked.startsWith(`${value} `)) fail(`switching the language changed the answer: ${fil.checked} → ${en.checked}`)
      if (en.chip !== "Part III" || en.next !== "Next" || !/\b3 OF 21\b/.test(en.shown) || en.heading === fil.heading) fail(`after switching to English the screen reads: ${en.chip} / ${en.heading} / ${en.next}`)
      if (!/\b3 SA 21\b/.test(fil.shown)) fail("the Filipino count doesn't read 3 SA 21")
      if (!/^\d (Always|Often|Sometimes|Rarely|Never)$/.test(en.checked)) fail(`the English slider says ${en.checked}`)
      // a reload remembers the language, the place and the answer; so does going back to Filipino
      await page.reload()
      await settle(page)
      const reloaded = await state()
      if (reloaded.next !== "Next" || reloaded.at !== fil.at || reloaded.checked !== en.checked) fail("a reload after switching to English lost the language, the place or the answer")
      await switchTo(page, "Filipino")
      await page.reload()
      await settle(page)
      const back = await state()
      if (back.next !== "Susunod" || back.chip !== "Bahagi III" || back.heading !== fil.heading || back.checked !== fil.checked || back.at !== fil.at) fail("back in Filipino and reloaded, the screen isn't the one it was")
      if (back.sliderTop !== fil.sliderTop || back.knobLeft !== fil.knobLeft) fail("back in Filipino, the slider isn't where it was")
      if (problems.length === before) console.log("  switched to English and back in the middle of Part III: same screen, answer and slider; remembered after a reload")
    }
    const { scrolled } = await walk(page, { pick, shots, lang: "fil", onScreen, afterPick })
    if (partThree < 3) fail("the walk never switched the language in Part III")
    if (scrolled.length) console.log("  screens that scroll at 360 × 640 in Filipino:", scrolled)
    for (const [what, px] of scrolled) {
      if (/^Bahagi|profile|age|data use|sign/.test(what)) fail(`${what} scrolls by ${px}px on a 360 × 640 phone in Filipino`)
    }
    const reviewText = await page.locator("main").last().textContent()
    if (!reviewText.includes("Nasagot ninyo ang 54 sa 54 na aytem")) fail(`the Filipino review says: ${reviewText}`)
    await page.locator('[data-bar="right"]').click()
    await page.getByText("Salamat sa pagsagot sa talatanungan.").waitFor()
    await settle(page)
    await onScreen("the thank-you")
    await page.screenshot({ path: `${out}fil-99-done.png` })
    const book = await sheets()
    const rows = records(book.responses)
    const row = rows.find((r) => r.group === "Y2")
    const consent = records(book.consents).find((c) => c.response_id === row?.response_id)
    // exactly what an English run saves, and the language
    const expect = {
      P1_age: "",
      P1_sex: "Male",
      P1_year: "Second year",
      P1_l1: "Other",
      P1_l1_other: "Mandaya",
      P1_home: "English",
      P1_home_other: "",
      P1_engfreq: "Never",
      pilot_feedback: "",
      language: "fil",
    }
    for (const [k, v] of Object.entries(expect)) if (row?.[k] !== v) fail(`Filipino run: responses.${k} is ${JSON.stringify(row?.[k])}, expected ${JSON.stringify(v)}`)
    const likert = Object.keys(row ?? {}).filter((k) => /^P[2-5]_/.test(k))
    if (likert.length !== 49 || likert.some((k) => ![1, 2, 3, 4, 5].includes(row[k]))) fail("Filipino run: not all 49 Likert answers were saved as 1–5")
    if (Object.keys(row ?? {}).join() !== Object.keys(rows[0]).join()) fail("the Filipino row doesn't have the columns of an English row")
    if (consent?.language !== "fil" || consent.name !== "Maria Santos" || consent.data_use_1 !== "Yes" || consent.data_use_2 !== "No" || consent.data_use_3 !== "Yes") fail(`Filipino run: consent row: ${JSON.stringify(consent)}`)
    console.log(`  saved as an English run is: Part I in the form's English words, ${likert.length} Likert answers 1–5, language fil`)

    // TAPOS goes back to the start, still in Filipino: the language outlives the questionnaire
    await page.locator('[data-bar="right"]').click()
    await settle(page)
    if ((await page.locator('[data-bar="right"]').textContent()) !== "Magsimula") fail("the start after TAPOS doesn't read MAGSIMULA")
    await onScreen("the start, after submitting")

    // the exit dialog and the under-18 stop, in Filipino
    await clickNext(page)
    await page.getByRole("button", { name: "Lumabas" }).click()
    await page.getByText("Aalis na ngayon?").waitFor()
    await page.waitForTimeout(500)
    await onScreen("the exit dialog")
    await page.screenshot({ path: `${out}fil-97-exit-dialog.png` })
    await page.getByRole("button", { name: "Magpatuloy" }).click()
    await page.waitForTimeout(450)
    await page.getByRole("radio", { name: "Hindi", exact: true }).click()
    if ((await page.evaluate(() => JSON.parse(localStorage.getItem("wrd-survey:session")).age)) !== "No") fail("the Filipino HINDI isn't kept as the form's No")
    await page.locator('[data-bar="right"]').click()
    await page.getByText("Kailangan ninyo ang pahintulot ng inyong magulang o tagapag-alaga bago kayo sumagot.").waitFor()
    await settle(page)
    await onScreen("the under-18 stop")
    await page.screenshot({ path: `${out}fil-98-under-18.png` })
    if (records((await sheets()).consents).length !== records(book.consents).length) fail("the under-18 stop saved something (Filipino)")
    console.log("  the thank-you, the start, the exit dialog and the under-18 stop: all in Filipino")
    await ctx.close()
  }

  /* ---------- taking a break after the consent form, then continuing, then starting over ---------- */
  console.log("taking a break")
  {
    const { ctx, page } = await context({ width: 390, height: 700 })
    await page.goto(base + "/")
    await clickNext(page)
    await page.getByRole("radio", { name: "Yes", exact: true }).click()
    await clickNext(page)
    while (!(await page.getByRole("checkbox").count())) await clickNext(page)
    await page.getByRole("checkbox").first().click()
    await clickNext(page)
    await page.locator("#name").fill("Lito Reyes")
    await page.locator("#signature").fill("Lito Reyes")
    await clickNext(page)
    const letter = (await page.locator("main h1").last().textContent()) ?? ""
    const id = await page.evaluate(() => JSON.parse(localStorage.getItem("wrd-survey:session")).id)
    await page.getByRole("button", { name: "Exit" }).click()
    await page.getByText("Your answers stay on this phone.").waitFor()
    await page.getByRole("button", { name: "Leave" }).click()
    await page.getByText("You have an unfinished questionnaire on this phone.").waitFor()
    // a reload still waits on the start screen
    await page.reload()
    await page.getByText("You have an unfinished questionnaire on this phone.").waitFor()
    await settle(page)
    await page.screenshot({ path: `${out}phone-96-waiting.png` })
    if ((await page.locator('[data-bar="left"]').textContent()) !== "Start over") fail("no START OVER while a questionnaire waits")
    await clickNext(page)
    if ((await page.locator("main h1").last().textContent()) !== letter) fail("CONTINUE didn't go back to the letter")
    await page.getByRole("button", { name: "Exit" }).click()
    await page.getByRole("button", { name: "Leave" }).click()
    await settle(page)
    await page.locator('[data-bar="left"]').click()
    await page.getByText("Start over?").waitFor()
    await page.getByRole("dialog").getByRole("button", { name: "Start over" }).click()
    await settle(page)
    if (!(await page.getByRole("radio", { name: "Yes", exact: true }).count())) fail("START OVER didn't begin at the age check")
    const fresh = await page.evaluate(() => JSON.parse(localStorage.getItem("wrd-survey:session") ?? "null"))
    if (!fresh || fresh.id === id || fresh.consented) fail("START OVER didn't begin a new questionnaire")
    const book = await sheets()
    if (records(book.consents).find((c) => c.response_id === id)?.name !== "Lito Reyes") fail("the consent of the questionnaire left behind is missing")
    console.log("  continued where it was, and started over with a new questionnaire")
    await ctx.close()
  }

  /* ---------- a test run says so ---------- */
  {
    const { ctx, page } = await context({ width: 390, height: 700 })
    await page.goto(base + "/?test")
    await page.getByText("Test run: these answers are kept apart").waitFor()
    await clickNext(page)
    const id = await page.evaluate(() => JSON.parse(localStorage.getItem("wrd-survey:session")).id)
    if (!id.startsWith("T-")) fail(`a test run's id is ${id}`)
    await ctx.close()
  }

  /* ---------- declining the consent saves nothing ---------- */
  console.log("declining the consent")
  {
    const { ctx, page } = await context({ width: 390, height: 700 })
    await page.goto(base + "/")
    await clickNext(page)
    await page.getByRole("radio", { name: "Yes", exact: true }).click()
    await clickNext(page)
    while (!(await page.getByRole("checkbox").count())) await clickNext(page)
    await page.getByRole("checkbox").first().click()
    await clickNext(page)
    await page.locator("#name").fill("Pedro Cruz")
    // the exit button asks first, and KEEP GOING stays
    await page.getByRole("button", { name: "Exit" }).click()
    await page.getByText("Nothing has been saved yet.").waitFor()
    await page.getByRole("button", { name: "Keep going" }).click()
    await page.waitForTimeout(450)
    if ((await page.locator("#name").inputValue()) !== "Pedro Cruz") fail("KEEP GOING lost what was typed")
    await page.getByRole("button", { name: "No, I do not agree" }).click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${out}phone-97-decline-dialog.png` })
    await page.getByRole("button", { name: "End" }).click()
    await page.getByText("You chose not to take part").waitFor()
    const book = await sheets()
    if (JSON.stringify(book).includes("Pedro")) fail("a declined consent was saved")
    const stored = await page.evaluate(() => JSON.stringify(localStorage))
    if (stored.includes("Pedro")) fail("a declined consent stayed on the phone")
    console.log("  nothing saved, nothing left on the phone")
    await ctx.close()
  }

  /* ---------- the researchers' page ---------- */
  console.log("researchers' page")
  {
    const { ctx, page } = await context({ width: 1280, height: 900 })
    await page.goto(base + "/researchers/")
    await page.locator("#password").fill("nope")
    await page.getByRole("button", { name: "Open" }).click()
    await page.getByText("That password isn't right.").waitFor()
    await page.locator("#password").fill("dev")
    await page.getByRole("button", { name: "Open" }).click()
    await page.getByText("Questionnaire responses").waitFor()
    const text = await page.locator("body").textContent()
    if (!/1 of 10\s*submitted/.test(text)) fail("pilot count is not 1 of 10")
    if ((text.match(/1 of 16\s*submitted/g) ?? []).length !== 2) fail("the first-year and second-year counts are not 1 of 16 each")
    if (!text.includes("Average")) fail("no pilot time")
    if (!text.includes("1 has signed the consent form but not submitted yet")) fail("the questionnaire left waiting isn't counted")
    await page.screenshot({ path: `${out}researchers.png`, fullPage: true })
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Responses" }).click()])
    const csv = readFileSync(await dl.path(), "utf8")
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n")
    if (!csv.startsWith("﻿")) fail("the CSV has no byte-order mark")
    if (lines.length !== 4) fail(`responses CSV has ${lines.length - 1} rows, expected 3`)
    if (lines[0].split(",").length !== 64) fail(`responses CSV has ${lines[0].split(",").length} columns, expected 64`)
    if (!lines[0].endsWith(",language")) fail("the responses CSV doesn't end with the language column")
    if (lines.slice(1).map((l) => l.split(",").at(-1)).sort().join() !== "en,en,fil") fail("the responses CSV doesn't say which language each was answered in")
    const [dl2] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Consents" }).click()])
    const consents = readFileSync(await dl2.path(), "utf8")
    if (!consents.includes("Maria Santos")) fail("the consents CSV is missing the pilot's consent")
    console.log(`  counts right; CSVs: ${dl.suggestedFilename()} (${lines.length - 1} rows × ${lines[0].split(",").length} columns), ${dl2.suggestedFilename()}`)
    await ctx.close()
  }
} catch (e) {
  fail(String(e?.stack ?? e))
} finally {
  await browser.close()
  await server.close()
}

console.log(problems.length ? `\n${problems.length} problem(s)` : "\nall good")
process.exit(problems.length ? 1 : 0)
