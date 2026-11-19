/*
 * The app's own words, in English and in Filipino (Ian, 2026-11-19: a switch for the whole
 * questionnaire). The questionnaire's words are not here: English is questionnaire.json (made from
 * the Google Form, never edited by hand) and Filipino is questionnaire.fil.json (written by hand).
 * The Filipino speaks to the respondent as "kayo / ninyo", as the Filipino questionnaire does.
 * The researchers' page stays English.
 */

export type Lang = "en" | "fil"
export const LANGS: Lang[] = ["en", "fil"]

const MONTHS_FIL = [
  "Enero",
  "Pebrero",
  "Marso",
  "Abril",
  "Mayo",
  "Hunyo",
  "Hulyo",
  "Agosto",
  "Setyembre",
  "Oktubre",
  "Nobyembre",
  "Disyembre",
]

const en = {
  /** the language's own name, for the switch */
  name: "English",
  short: "EN",
  language: "Language",
  pageTitle: "English Word Retrieval Questionnaire",
  exit: "Exit",
  progress: "Progress",

  // the strip
  part: (roman: string) => `Part ${roman}`,
  pilotTest: "Pilot test",

  // the start screen
  waiting: "You have an unfinished questionnaire on this phone. Press CONTINUE to pick up where you left off.",
  testRun: "Test run: these answers are kept apart and don’t count.",

  // the bottom buttons
  start: "Start",
  continue: "Continue",
  startOver: "Start over",
  back: "Back",
  next: "Next",
  review: "Review",
  saving: "Saving…",
  submit: "Submit",
  sending: "Sending…",
  done: "Done",
  ok: "OK",

  // the count above the progress bar
  pageOf: (page: number, pages: number) => `Page ${page} of ${pages}`,
  itemOf: (n: number, of: number) => `${n} of ${of}`,
  /** the date the consent form is signed on, as "November 19, 2026" */
  date: (d: Date) => d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }),

  // the consent form and Part I
  tickOneOrMore: "Tick one or more",
  thirdYear: "Third year",
  fourthYear: "Fourth year",
  other: "Other",
  specify: "Please specify",
  /** what a part's directions start and (Parts II to IV) end with, left out where they are shown */
  directionsLead: "Directions:",
  directionsTail: "Choose one answer for each statement.",

  // the review and the blanks dialog
  reachedEnd: "You’ve reached the end",
  answered: (n: number, total: number) => `You answered ${n} of ${total} items.`,
  pressSubmit: "Press SUBMIT to send your answers.",
  tapOrSubmit: "Tap an item to answer it, or press SUBMIT.",
  leftBlank: "Left blank",
  goToItem: (label: string) => `Go to item ${label}`,
  /** "2 items" in red, then "left blank" */
  blankCount: (n: number) => `${n} ${n === 1 ? "item" : "items"}`,
  blankRest: "left blank",
  itemsLeftBlank: "Items left blank",
  submitAnywayAsk: "Submit anyway?",
  submitAnyway: "Submit anyway",
  goBack: "Go back",

  // the ends
  sent: "Your answers have been sent.",
  declinedTitle: "You chose not to take part",
  declinedBody: "Nothing you entered was saved. Thank you for your time.",

  // the dialogs
  breakTitle: "Take a break?",
  breakBody: "Your answers stay on this phone. Open this page again on this phone to pick up where you left off.",
  leaveTitle: "Leave now?",
  leaveBody: "Nothing has been saved yet.",
  keepGoing: "Keep going",
  leave: "Leave",
  restartTitle: "Start over?",
  restartBody: "The answers saved on this phone will be deleted, and a new questionnaire begins.",
  restartLeave: "Start over",
  declineTitle: "End without taking part?",
  declineBody: "Nothing you entered will be saved.",
  declineLeave: "End",

  // when a call fails
  notSent: "Not sent: no connection. Your answers are still on this phone. Try SUBMIT again.",
  noNetwork: "Can't reach the server. Check your connection and try again.",
  wentWrong: "Something went wrong. Please tell the researchers.",
}

export type Strings = typeof en

/**
 * The linker after a count written in figures: "4 na aytem" (apat na), but "2 aytem" (dalawang) and
 * "10 aytem" (sampung), where the linker is the -ng of the number as it is read. Counts here end
 * at 54, and the numbers that end in a consonant are those in 4, 6 and 9.
 */
const na = (n: number) => ([4, 6, 9].includes(n % 10) ? " na" : "")

const fil: Strings = {
  name: "Filipino",
  short: "FIL",
  language: "Wika",
  pageTitle: "Talatanungan sa Pag-alala ng Salitang Ingles",
  exit: "Lumabas",
  progress: "Pag-usad",

  part: (roman) => `Bahagi ${roman}`,
  pilotTest: "Pilot test",

  waiting: "May hindi pa tapos na talatanungan sa teleponong ito. Pindutin ang ITULOY upang magpatuloy kung saan kayo huminto.",
  testRun: "Pagsubok lamang: hiwalay na itinatabi ang mga sagot na ito at hindi ibinibilang.",

  start: "Magsimula",
  continue: "Ituloy",
  startOver: "Simulang muli",
  back: "Bumalik",
  next: "Susunod",
  review: "Rebyu",
  saving: "Sine-save…",
  submit: "Isumite",
  sending: "Ipinadadala…",
  done: "Tapos",
  ok: "OK",

  pageOf: (page, pages) => `Pahina ${page} ng ${pages}`,
  itemOf: (n, of) => `${n} sa ${of}`,
  // by hand, not toLocaleDateString("fil-PH"): a phone without Filipino month names would answer in English
  date: (d) => `${MONTHS_FIL[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,

  tickOneOrMore: "Pumili ng isa o higit pa",
  thirdYear: "Ikatlong taon",
  fourthYear: "Ikaapat na taon",
  other: "Iba pa",
  specify: "Mangyaring tukuyin",
  directionsLead: "Panuto:",
  directionsTail: "Pumili ng isang sagot para sa bawat pahayag.",

  reachedEnd: "Narating na ninyo ang dulo",
  answered: (n, total) => `Nasagot ninyo ang ${n} sa ${total}${na(total)} aytem.`,
  pressSubmit: "Pindutin ang ISUMITE upang ipadala ang inyong mga sagot.",
  tapOrSubmit: "Pindutin ang isang aytem upang sagutin ito, o pindutin ang ISUMITE.",
  leftBlank: "Walang sagot",
  goToItem: (label) => `Pumunta sa aytem ${label}`,
  blankCount: (n) => `${n}${na(n)} aytem`,
  blankRest: "ang walang sagot",
  itemsLeftBlank: "Mga aytem na walang sagot",
  submitAnywayAsk: "Isumite pa rin?",
  submitAnyway: "Isumite pa rin",
  goBack: "Bumalik",

  sent: "Naipadala na ang inyong mga sagot.",
  declinedTitle: "Pinili ninyong hindi lumahok",
  declinedBody: "Hindi nai-save ang anumang inilagay ninyo. Salamat sa inyong panahon.",

  breakTitle: "Magpapahinga muna?",
  breakBody: "Mananatili sa teleponong ito ang inyong mga sagot. Buksang muli ang pahinang ito sa teleponong ito upang magpatuloy kung saan kayo huminto.",
  leaveTitle: "Aalis na ngayon?",
  leaveBody: "Wala pang nai-save.",
  keepGoing: "Magpatuloy",
  leave: "Umalis",
  restartTitle: "Simulang muli?",
  restartBody: "Mabubura ang mga sagot na naka-save sa teleponong ito, at magsisimula ang isang bagong talatanungan.",
  restartLeave: "Simulang muli",
  declineTitle: "Tapusin nang hindi lumalahok?",
  declineBody: "Hindi maise-save ang anumang inilagay ninyo.",
  declineLeave: "Tapusin",

  notSent: "Hindi naipadala: walang koneksiyon. Nasa teleponong ito pa rin ang inyong mga sagot. Pinduting muli ang ISUMITE.",
  noNetwork: "Hindi maabot ang server. Suriin ang inyong koneksiyon at subukang muli.",
  wentWrong: "Nagkaroon ng problema. Mangyaring ipaalam sa mga mananaliksik.",
}

export const strings: Record<Lang, Strings> = { en, fil }
