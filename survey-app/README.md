# Online questionnaire

The survey for *Exploring English Word Retrieval Difficulties and Verbal Compensatory Strategies of
Filipino Majors: A Needs Analysis* (EL 3113), built to HANDOVER.md, in Tuwon's style, without the
handover's access codes (dropped on 2026-11-18). Respondents open the link, sign the consent form
and answer one item per screen, like Tuwon's player. Nothing scrolls. The answers go to a Google
Sheet that only the researchers can open, and the researchers' page counts them and exports the
CSV files.

Every word of the questionnaire comes from the validated Google Form, by way of
`src/questionnaire.json` (made by `scripts/form_to_questionnaire.py`; don't edit it by hand). The
form's respondent code is the one thing left out.

The questionnaire can be read in **English or Filipino**: a small **EN | FIL** switch sits beside
the exit button on every screen. See [English and Filipino](#english-and-filipino).

## What a respondent sees

1. **The start screen:** the title and who the study is for, and START.
2. **Are you 18 years old or older?** No stops here with the form's message. Nothing is saved.
3. **The consent form**, a section per page, then the data-use boxes (at least one ticked), then
   name, typed signature and address. YES, I AGREE stays gray until the name and the signature are
   filled in. *No, I do not agree* ends the session, and nothing is saved. The date is recorded
   automatically.
4. **The letter** and **the general directions**, with the definition of a word retrieval
   difficulty.
5. **Parts I to V.** Each part opens with its directions. Then comes one item per screen,
   with BACK and NEXT and the progress bar. Part I asks the year level among its five items (the form's six without the age), in the
   form's words. The Likert answers are a slider with five stops, from 5 to 1, left to right, each
   with its number and label. Nothing is picked in advance: the slider has no knob until the
   respondent taps a stop, and the knob can then be slid from stop to stop. The slider stays in one
   place from item to item, and only the words above it change. The Part III and IV stems are
   repeated above every item. A small count above the progress bar ("3 of 21") says where in the
   part the respondent is.
6. **Only for those who pick *Third year*:** the question about unclear items.
7. **Review.** The page shows how many items are answered and lists the blank ones (II.3 is Part II,
   item 3). SUBMIT with blanks asks *Submit anyway?*. A blank item can be opened from the list: NEXT
   reads REVIEW there and comes straight back.
8. **The thank-you message.**

The **EN | FIL** switch (top right, beside EXIT, and on the start and end screens too) changes
every word on the screen at once: the consent form, the letter, the directions, the items, the
scale labels, the buttons and the messages. It keeps the respondent's place and answers, and the
phone remembers the choice. English is what a phone shows the first time.

Progress is kept on the phone as the respondent goes, so a reload or a dropped connection loses
nothing. EXIT (top right) after the consent form is a break: the start screen then says a
questionnaire is waiting, with CONTINUE and START OVER (which deletes it from the phone, for the
next person). The name, signature and address leave the phone as soon as the consent form is sent.
Everything is deleted from the phone once the answers are submitted.

With no codes, anyone with the link can answer, and more than once: share the link only with the
respondents. The year level each respondent picks decides the group: *First year* is Y1, *Second
year* Y2, *Third year* P (saved in the form's words, *Third year (pilot test only)*). A grayed
*Fourth year* card is shown but can't be picked.

The answering time (`duration_min`) runs from the letter, right after the consent form, to
SUBMIT, measured by the phone's own clock.

## The data

It lives in one Google Sheet, in two tabs:

| Tab | What | |
|---|---|---|
| `consents` | response_id, name, signature, address, data_use_1–3 (Yes/No, in the form's order), agreed_at, language | names: keep apart |
| `responses` | one row per submission: `response_id`, `group`, `P1_age` … `P1_engfreq`, `P2_01` … `P5_10` (1–5 or blank), `pilot_feedback`, `started_at`, `submitted_at`, `duration_min`, `language` | 64 columns; `P1_age` stays empty, since the age is no longer asked |

`response_id` is made on the phone for each questionnaire (like `R-K7Q2XM4P`). It ties a consent
row to its answers, so a respondent who withdraws can be removed from both. The same questionnaire
sent twice (a lost connection, a second tap) is kept once. `group` is blank if the year level was
skipped. Times are Philippine time.

`language` is `en` or `fil`: in `consents`, the language the consent form was signed in; in
`responses`, the language on the screen at SUBMIT. A respondent who switched part-way shows only
as the last one. It is blank in rows saved before the column existed.

**Test runs:** open the site as `…/?test`. The start screen says it's a test, the ids start with
`T-`, and the researchers' page leaves them out of the counts and both CSV files. They stay in the
Sheet, where they can be deleted. Never share the `?test` link with respondents.

**After the study** (as the consent form promises, Data Privacy Act of 2012): download what you
need, then delete the Google Sheet. In Apps Script, use Deploy → Manage deployments → Archive.

## English and Filipino

The answers are saved **the same way in either language**: 1 to 5 for the scales, and Part I in
the form's English words (*Female*, *Second year*, *Other* …). Only what is shown changes, so
rows answered in Filipino and in English go in the same columns and can be analysed together. The
`language` column says which was used.

- **English** is `src/questionnaire.json`, made from the Google Form. Never edit it by hand.
- **Filipino** is `src/questionnaire.fil.json`, written by hand in the same shape. To change a
  Filipino word, change it there. Keep the same items in the same order, the same number of
  paragraphs in each text (a blank line between paragraphs), and the English examples inside the
  items (“How do I say this?”, “Can you pass the takure?” …) in English. `pnpm test` checks all of
  that, and that both languages have exactly the same screens.
- The app's own words (buttons, "3 of 21", dialogs, messages) are in `src/strings.ts`, English
  and Filipino side by side.
- The study's title, the names, *BSEd Filipino*, *College of Education* and the Data Privacy Act
  stay in English in both. The researchers' page is English only.
- The consent form and the letter are cut into pages at the same places in both languages, so the
  switch never moves a respondent to another screen.

**The Filipino version is a translation, not yet a validated instrument.** It was checked by a
blind back-translation and a separate language review, both done by AI, which is not a
validation. Before a respondent reads it, have the research adviser or a Filipino-language
teacher go over it. `pnpm review-sheet` writes `filipino-review.html`: the English and the Filipino
side by side, row by row, with a column for remarks. It opens in a browser and prints.

## The researchers' page

`…/researchers/` on the same site. It needs the password set in Code.gs. It shows submitted /
target per group (10, 16, 16), how many have signed the consent form but not submitted, the pilot's
average answering time and range, and the two downloads: **Responses** and **Consents**. The CSV
files are UTF-8 and open in Excel and Google Sheets. The Google Sheet itself can also be downloaded
as CSV.

## Set up the Google Sheet (once, about 5 minutes)

Use the Google account that should keep the data. A personal Gmail account is safest. A school
account may not offer **Anyone** in step 5, and without it the app can't reach the Sheet.

1. Make a new Google Sheet (go to **sheets.new**) and name it, e.g. *Questionnaire data*. Share it
   with the other two researchers only.
2. **Extensions → Apps Script.** Select everything in the editor, delete it, and paste the whole of
   [`server/Code.gs`](server/Code.gs).
3. On the line `const RESEARCHER_PASSWORD = ""`, type a password between the quotes. Make it long, and
   not one any of you uses elsewhere: it is all that stands between the web and the names. Then save
   (Ctrl+S / Cmd+S).
4. In the function menu beside **Debug**, pick **setup**, then press **Run**. The first time, Google
   asks for permission: **Review permissions** → your account → (if it says Google hasn't verified the
   app: **Advanced** → **Go to … (unsafe)**; it's your own script) → **Allow**. The log ends with
   *Ready.*, and the Sheet has its two tabs.
5. **Deploy → New deployment** → the gear → **Web app**. Set *Execute as*: **Me** and *Who has access*:
   **Anyone**. Then **Deploy**, and copy the **Web app URL** (it ends in `/exec`).
6. To check it, open that URL in a browser. It should say `{"ok":true,"service":"questionnaire",…}`.

If Code.gs changes later: paste the new file, **put your password back** on the
`RESEARCHER_PASSWORD` line (the file in this folder has none), save, run **setup** again (it brings
the tabs up to date and deletes nothing), then **Deploy → Manage deployments** → pencil →
*Version*: **New version** → **Deploy**. The URL stays the same. A `codes` tab left by the earlier,
code-based version can be deleted.

The `language` column came with the Filipino version (2026-11-19). A Sheet set up before that gets
it by the steps above: **setup** adds `language` as the last column of both tabs and keeps every
row. Until then nothing breaks: the questionnaire works in both languages, and the language is
simply not recorded.

## Put it online

Build with the web app's URL, then publish the `dist` folder on any HTTPS static host. The build
stops if the URL is missing. On GitHub Pages, with the `gh` command signed in:

```sh
VITE_API_URL="https://script.google.com/macros/s/…/exec" pnpm build
cd dist && git init -qb gh-pages && git add -A && git commit -qm "Questionnaire site"
gh repo create wrd-survey --public --source=. --push
gh api -X POST "repos/{owner}/{repo}/pages" -f "source[branch]=gh-pages" -f "source[path]=/"
```

A minute or two later the questionnaire is at `https://<account>.github.io/wrd-survey/`, and the
researchers' page at `…/wrd-survey/researchers/`. The repository holds only the built site, not
this source. To publish a change, run the build again (it keeps `dist/.git`), then
`git add -A && git commit -qm Update && git push` in `dist`.

There are no analytics, trackers or outside fonts, and no answers ever go in a URL. The pages ask
search engines not to list them.

## For developers

```sh
pnpm install
pnpm dev       # http://localhost:5181 — runs the real Code.gs on a pretend Sheet; researchers' password: dev
pnpm test      # Code.gs on the pretend Sheet, the flow, the CSV, and that English and Filipino match
pnpm e2e       # the whole questionnaire in a browser: a pilot on a 360×640 phone, a first year on a laptop,
               # a second year in Filipino (switching in the middle and back), a break and START OVER,
               # a test run, a declined consent, the researchers' page and its CSVs (screenshots in e2e-out/)
pnpm review-sheet   # filipino-review.html: English and Filipino side by side, for the adviser
```

- `server/Code.gs`: the backend (Apps Script). `server/googleFakes.ts` is the pretend Google
  behind the tests and `pnpm dev`.
- `src/survey.ts`: the questionnaire and the order of the screens. `src/respondent/` holds the
  questionnaire's screens and `src/researchers/` the researchers' page.
- `src/questionnaire.fil.json`, `src/strings.ts`, `src/app/language.tsx`: the Filipino words, the
  app's own words in both languages, and the language picked (kept on the phone as
  `wrd-survey:lang`).
- `src/components`, `src/design`: from Tuwon's player (`tuwon-player`). These are the press buttons,
  the option cards, the progress bar, the dialogs, the tokens, Tuwon Sans and the step slide-over.
