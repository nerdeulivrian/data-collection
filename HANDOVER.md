# Handover · Online Questionnaire Web App

**Study.** Exploring English Word Retrieval Difficulties and Verbal Compensatory Strategies of Filipino Majors: A Needs Analysis
**Team.** Armie Navarro, Reneil Ofilan, Ian M. Quibete (BSEd English 3, USeP College of Education)
**Course.** EL 3113 Language Education Research

## What to build

A small, mobile-first web app where selected BSEd Filipino students give consent and answer the validated survey questionnaire. Researchers can then export the answers as a CSV for analysis.

All text (consent form, letter, directions, every item, scales and item key) is in `questionnaire.json`. Render it from there. Do not retype items.

## Who answers

| Group | Respondents | Target | When | Access code format |
|---|---|---|---|---|
| Pilot | Third-year BSEd Filipino | 10 | Nov 18, 2026 | `P-01` to `P-10` |
| Y1 | First-year BSEd Filipino | 16 | Nov 19, 2026 onwards | `Y1-01` to `Y1-16` |
| Y2 | Second-year BSEd Filipino | 16 | Nov 19, 2026 onwards | `Y2-01` to `Y2-16` |

The researchers pick respondents by stratified random sampling and give each one an access code. The code sets the group, the year level and the respondent code (Part I item 1). Each code works once.

## Respondent flow

1. **Access code.** The student enters their code. Invalid or used codes are rejected.
2. **Age check.** The app asks "Are you 18 years old or older?" If the answer is no, it stops and says "Please see the researchers. You need your parent or guardian’s consent before answering." (Parental consent is handled on paper.)
3. **Informed consent.** Show the full form from `consent`. The student ticks one or more data-use boxes, then enters their name, typed signature and address. The date is saved automatically. The **I agree** button stays disabled until the name and signature are filled in. Declining ends the session without saving anything.
4. **Letter and general directions.** Show `letter` and `general_directions`, including the definition of a word retrieval difficulty.
5. **Part I to Part V.** Show one part per page, with a progress bar and Back/Next buttons.
6. **Pilot only.** Show the optional "unclear items" question from `pilot_only`.
7. **Review and submit.** If any items are blank, list them and ask "Submit anyway?" Skipping is allowed because the consent form promises it.
8. **Thank you.** Show `closing_message`.

## Rules that keep the instrument valid

- Use the item wording, item order and part order **exactly** as given. Validators approved this version.
- The only allowed wording change is in the directions, where "check (✓) the box" can become "tap your answer."
- Show Likert options from 5 to 1, left to right, with both the number and the label (for example, 5 Always).
- Do not preselect any answer, and do not shuffle items.
- Each item takes one answer only.
- Repeat the Part III stem ("When I cannot remember an English word while I am speaking, . . .") and the Part IV stem at the top of their pages.
- Part I items 1 and 4 are filled in by the system, not shown as inputs.

## Data to save

Keep consent records and survey answers in **separate tables**. The consent form promises that names are not part of the data.

**consents** · access_code, name, signature, address, data_use choices, agreed_at

**responses** · one row per respondent, with these columns.

| Column | Values |
|---|---|
| `code` | P-01, Y1-03 and so on |
| `group` | P, Y1, Y2 |
| `P1_age`, `P1_sex`, `P1_year`, `P1_l1`, `P1_l1_other`, `P1_home`, `P1_home_other`, `P1_engfreq` | as answered |
| `P2_01` … `P2_08` | 1 to 5, or blank |
| `P3_01` … `P3_21` | 1 to 5, or blank |
| `P4_01` … `P4_10` | 1 to 5, or blank |
| `P5_01` … `P5_10` | 1 to 5, or blank |
| `pilot_feedback` | text (pilot only) |
| `started_at`, `submitted_at`, `duration_min` | timestamps and minutes |

Save progress in the browser as the student goes, so a dropped connection does not lose answers. Only submitted rows count.

## Researcher page (password protected)

- Counts per group against the targets (10, 16, 16), with codes used and unused
- **Export CSV** for responses, and a separate export for consents
- For the pilot, the average and range of `duration_min` (the pilot checks answering time)

## Scoring reference

`item_key` in the JSON maps each item to its variable.

- Part III has seven strategies with three items each. Each strategy score is the mean of its three items.
- The pilot data are used for Cronbach’s alpha on Parts II to V (.70 or higher is acceptable). Compute it outside the app from the CSV.

## Privacy

- HTTPS only, no analytics or tracking scripts, and no answers in URLs.
- Store data where only the three researchers can reach it.
- Delete the data after the study, as the consent form says (Data Privacy Act of 2012).

## Suggested stack (keep it simple)

Any of these works. One option is Next.js or plain HTML with a small backend, plus Supabase or Firebase for the two tables and a CSV export route. Deploy on Vercel or Netlify.

## Done when

- [ ] All 56 items (7 profile, 8 + 21 + 10 + 10 Likert) render with the exact wording from the JSON
- [ ] Consent, the under-18 stop and the access codes work as described
- [ ] Blank items show a warning but can still be submitted
- [ ] The CSV opens in Excel or Google Sheets with the columns above
- [ ] It works on a phone screen and on slow mobile data
- [ ] A test run of the whole flow takes about 10 to 15 minutes
