import { Check, Hand, Undo2 } from "lucide-react"
import { AnimatePresence } from "motion/react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useLanguage } from "@/app/language"
import { useTapSink } from "@/app/tapPress"
import { useBreakpoint } from "@/app/useBreakpoint"
import { api, errorKind } from "@/api"
import { OTHER } from "@/components/Answers"
import { Toast } from "@/components/Bits"
import { BlanksDialog, ConfirmDialog } from "@/components/Dialogs"
import { forgetSession, loadSession, newSession, saveSession, type Session } from "@/storage"
import { strings, type Strings } from "@/strings"
import {
  askedCount,
  blanks,
  buildFlow,
  firstAfterConsent,
  groupOf,
  isPilot,
  likertAt,
  likertParts,
  partName,
  profile,
  q,
  texts,
  type Screen,
} from "@/survey"
import { Frame, type BarButton } from "./Frame"
import * as S from "./screens"

/** where the respondent is: the start screen, the questionnaire, or one of its three ends */
type View = "start" | "flow" | "minor" | "declined" | "done"
type Dialog = "exit" | "decline" | "blanks" | "restart" | null
/** a toast is kept as which message it is, so it changes language with the rest */
type ToastKind = Extract<keyof Strings, "notSent" | "noNetwork" | "wentWrong">

function chipFor(screen: Screen, t: Strings): string {
  switch (screen.kind) {
    // only the parts and the pilot's question have a name in the strip (Ian, 2026-11-19)
    case "age":
    case "dataUse":
    case "sign":
    case "read":
    case "review":
      return ""
    case "partIntro":
      return t.part(partName(q.parts[screen.part].title).roman)
    case "profile":
      return t.part(partName(profile.title).roman)
    case "likert":
      return t.part(partName(likertParts[screen.part - 1].title).roman)
    case "pilot":
      return t.pilotTest
  }
}

export function App() {
  useTapSink()
  const layout = useBreakpoint()
  const compact = layout === "mobile"
  // English or Filipino (Ian, 2026-11-19): `t` is the app's own words, `tx` the questionnaire's.
  // What is saved and compared stays English (`q`), whatever is shown
  const { lang } = useLanguage()
  const t = strings[lang]
  const tx = texts[lang]

  // a questionnaire left open on this phone (a reload, a closed tab) picks up where it was; one
  // left with EXIT waits on the start screen
  const [initial] = useState(loadSession)
  const [session, setSession] = useState<Session | null>(initial)
  const [view, setView] = useState<View>(initial && !initial.paused ? "flow" : "start")
  const [direction, setDirection] = useState<1 | -1>(1)
  const [busy, setBusy] = useState(false)
  /** opened as …/?test: a test run, kept apart from the real answers */
  const [testLink] = useState(() => new URLSearchParams(window.location.search).has("test"))
  const [dialog, setDialog] = useState<Dialog>(null)
  const [toast, setToast] = useState<ToastKind | null>(null)
  /** the respondent came to this item from the review: NEXT reads REVIEW and goes straight back */
  const [fromReview, setFromReview] = useState(false)
  /** the bar on an end screen: where the respondent stopped, and full once the answers are sent */
  const [endProgress, setEndProgress] = useState(0)

  // the pilot's question joins the flow once the respondent picks the pilot's year level. The flow
  // has the same screens in either language, so `at` means the same screen after a switch
  const pilot = session ? isPilot(session.answers) : false
  const flow = useMemo(() => buildFlow(pilot, lang), [pilot, lang])
  const at = session ? Math.min(session.at, flow.length - 1) : 0
  const flowProgress = flow.length > 1 ? at / (flow.length - 1) : 0
  const screen: Screen | null = view === "flow" && session ? flow[at] : null
  const reviewIndex = flow.length - 1

  useEffect(() => {
    if (view === "flow" && session) saveSession(session)
  }, [view, session])

  const update = (change: Partial<Session> | ((s: Session) => Partial<Session>)) =>
    setSession((s) => (s ? { ...s, ...(typeof change === "function" ? change(s) : change) } : s))

  const goTo = (index: number, dir: 1 | -1) => {
    setDirection(dir)
    update({ at: index })
  }
  const next = () => goTo(at + 1, 1)
  const back = () => {
    setFromReview(false)
    goTo(at - 1, -1)
  }
  const answer = (id: string, value: string | number) =>
    update((s) => {
      const answers = { ...s.answers, [id]: value }
      // a new answer other than Other clears what was written for Other
      const item = profile.items.find((i) => i.id === id)
      if (item?.other && value !== OTHER) answers[item.other] = ""
      return { answers }
    })

  /** to an end screen or back to the start; nothing of the session stays open */
  const finish = (to: View, dir: 1 | -1 = 1) => {
    setDirection(dir)
    setEndProgress(to === "done" ? 1 : flowProgress)
    setView(to)
    setSession(null)
    setDialog(null)
    setFromReview(false)
  }

  /** EXIT after the consent form: the answers wait on this phone, and the start screen offers them */
  const pause = () => {
    if (!session) return
    const waiting = { ...session, paused: true }
    saveSession(waiting)
    setSession(waiting)
    setDirection(-1)
    setView("start")
    setDialog(null)
    setFromReview(false)
  }

  /** START: a new questionnaire; CONTINUE: the one waiting on this phone */
  function begin() {
    setDirection(1)
    setSession((s) => (s?.paused ? { ...s, paused: false } : newSession(testLink)))
    setView("flow")
  }

  /** START OVER: the questionnaire waiting on this phone is deleted, and a new one begins */
  function startOver() {
    forgetSession()
    setDialog(null)
    setDirection(1)
    setSession(newSession(testLink))
    setView("flow")
  }

  async function agree() {
    if (!session || busy) return
    setBusy(true)
    const r = await api.consent({
      id: session.id,
      name: session.name.trim(),
      signature: session.signature.trim(),
      address: session.address.trim(),
      data_use: session.dataUse,
      language: lang,
    })
    setBusy(false)
    if (!r.ok) {
      setToast(errorKind(r.error))
      return
    }
    setDirection(1)
    // sent: the name, signature and address leave the phone; the clock starts with the letter
    update((s) => ({
      consented: true,
      name: "",
      signature: "",
      address: "",
      dataUse: [],
      startedAt: Date.now(),
      at: s.at + 1,
    }))
  }

  async function submit() {
    if (!session || busy) return
    setDialog(null)
    setBusy(true)
    const answers = { ...session.answers }
    for (const item of profile.items) {
      if (item.other && answers[item.id] !== OTHER) answers[item.other] = ""
    }
    if (!isPilot(answers)) delete answers.pilot_feedback
    // the age is no longer asked: one typed before that, still on this phone, isn't sent
    delete answers.P1_age
    // sending again after a lost reply is safe: the server keeps the first copy it got
    const r = await api.submit({
      id: session.id,
      group: groupOf(answers, session.test),
      answers,
      elapsed_ms: session.startedAt ? Date.now() - session.startedAt : 0,
      language: lang,
    })
    setBusy(false)
    if (r.ok) {
      forgetSession()
      finish("done")
      return
    }
    setToast(r.error === "network" ? "notSent" : errorKind(r.error))
  }

  const jumpTo = (index: number) => {
    setDialog(null)
    setFromReview(true)
    goTo(index, -1)
  }

  /* ---------- what the frame shows ---------- */

  let key: string
  let top: { chip: string; onExit: () => void } | null = null
  let pageCount: { group: string; text: string } | null = null
  /** the Likert slider: it stays where it is while a part's items slide */
  let dock: { group: string; node: ReactNode } | null = null
  /** the bar: empty at the start */
  let progress = 0
  let left: BarButton | null = null
  let right: BarButton
  let body: ReactNode
  const backButton = (disabled = false): BarButton => ({
    label: t.back,
    tone: "outline",
    onClick: back,
    disabled,
  })

  if (view === "flow" && session && screen) {
    key = `flow-${at}`
    top = { chip: chipFor(screen, t), onExit: () => setDialog("exit") }
    // the count above the progress bar: a section's pages, Part I's items, each Likert part's items
    if (screen.kind === "read" && screen.pages > 1)
      pageCount = { group: screen.section, text: t.pageOf(screen.page, screen.pages) }
    // where the consent form is signed, the date it is signed on
    else if (screen.kind === "sign") pageCount = { group: "sign", text: t.date(new Date()) }
    else if (screen.kind === "profile")
      pageCount = { group: "profile", text: t.itemOf(screen.ordinal, screen.of) }
    else if (screen.kind === "likert") {
      const { part, item } = likertAt(screen)
      pageCount = { group: `part-${screen.part}`, text: t.itemOf(item.n, part.items.length) }
    }
    progress = flowProgress
    const nextButton: BarButton =
      fromReview && (screen.kind === "likert" || screen.kind === "profile")
        ? {
            label: t.review,
            onClick: () => {
              setFromReview(false)
              goTo(reviewIndex, 1)
            },
          }
        : { label: t.next, onClick: next }
    switch (screen.kind) {
      case "age":
        left = {
          label: t.back,
          tone: "outline",
          onClick: () => {
            forgetSession()
            finish("start", -1)
          },
        }
        right = {
          label: t.next,
          disabled: !session.age,
          onClick: () => {
            if (session.age === q.age_check.options[1]) {
              forgetSession()
              finish("minor")
            } else next()
          },
        }
        body = <S.AgeScreen value={session.age} onChoose={(age) => update({ age })} compact={compact} />
        break
      case "read":
        left = backButton(at === firstAfterConsent(flow))
        right = nextButton
        body = <S.ReadScreen screen={screen} compact={compact} />
        break
      case "dataUse":
        left = backButton()
        right = { label: t.next, onClick: next, disabled: session.dataUse.length === 0 }
        body = (
          <S.DataUseScreen
            values={session.dataUse}
            onToggle={(n) =>
              update((s) => ({
                dataUse: s.dataUse.includes(n)
                  ? s.dataUse.filter((x) => x !== n)
                  : [...s.dataUse, n].sort(),
              }))
            }
            compact={compact}
          />
        )
        break
      case "sign":
        left = backButton()
        right = {
          label: busy ? t.saving : tx.consent.agree.yes,
          onClick: agree,
          disabled: busy || !session.name.trim() || !session.signature.trim(),
          grow: true,
        }
        body = (
          <S.SignScreen
            name={session.name}
            signature={session.signature}
            address={session.address}
            onChange={(field, value) => update({ [field]: value })}
            onDecline={() => setDialog("decline")}
            compact={compact}
          />
        )
        break
      case "partIntro":
        left = backButton()
        right = nextButton
        body = <S.PartIntroScreen part={screen.part} compact={compact} />
        break
      case "profile":
        left = backButton()
        right = nextButton
        body = (
          <S.ProfileScreen screen={screen} answers={session.answers} onAnswer={answer} compact={compact} />
        )
        break
      case "likert": {
        const id = likertAt(screen).item.id
        const value = session.answers[id]
        left = backButton()
        right = nextButton
        body = <S.LikertScreen screen={screen} compact={compact} />
        dock = {
          group: `part-${screen.part}`,
          node: (
            <S.LikertDock
              screen={screen}
              value={typeof value === "number" ? value : null}
              onChoose={(v) => answer(id, v)}
              compact={compact}
            />
          ),
        }
        break
      }
      case "pilot":
        left = backButton()
        right = nextButton
        body = (
          <S.PilotScreen
            value={String(session.answers.pilot_feedback ?? "")}
            onChange={(t) => answer("pilot_feedback", t)}
            compact={compact}
          />
        )
        break
      case "review": {
        const missing = blanks(flow, session.answers)
        left = backButton()
        right = {
          label: busy ? t.sending : t.submit,
          disabled: busy,
          onClick: () => (missing.length ? setDialog("blanks") : submit()),
        }
        body = (
          <S.ReviewScreen total={askedCount(flow)} blanks={missing} onGoTo={jumpTo} compact={compact} />
        )
        break
      }
    }
  } else if (view === "minor" || view === "declined" || view === "done") {
    key = view
    progress = endProgress
    right = { label: view === "done" ? t.done : t.ok, onClick: () => finish("start") }
    body =
      view === "done" ? (
        <S.EndScreen icon={Check} tone="brand" title={tx.closing_message} body={t.sent} compact={compact} />
      ) : view === "minor" ? (
        <S.EndScreen icon={Hand} tone="quiet" title={tx.age_check.stop_title} body={tx.age_check.stop_message} compact={compact} />
      ) : (
        <S.EndScreen icon={Undo2} tone="quiet" title={t.declinedTitle} body={t.declinedBody} compact={compact} />
      )
  } else {
    key = "start"
    const waiting = session?.paused ? session : null
    if (waiting) {
      left = { label: t.startOver, tone: "outline", onClick: () => setDialog("restart") }
      right = { label: t.continue, onClick: begin }
    } else {
      right = { label: t.start, onClick: begin }
    }
    body = (
      <S.StartScreen waiting={waiting !== null} test={waiting ? waiting.test : testLink} compact={compact} />
    )
  }

  /* ---------- keys, on a computer: Enter is the orange button, 1–5 pick, Esc to leave ---------- */

  const keys = useRef<(e: KeyboardEvent) => void>(() => {})
  /** a number key picked an answer while another had the focus: the focus moves to the picked one,
   *  so that Enter is then NEXT and doesn't press the other answer instead */
  const refocus = useRef(false)
  useEffect(() => {
    if (!refocus.current) return
    refocus.current = false
    document.activeElement
      ?.closest("[data-answers]")
      ?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
      ?.focus({ preventScroll: true })
  })
  useLayoutEffect(() => {
    keys.current = (e) => {
      if (dialog || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      const target = e.target instanceof Element ? e.target : null
      if (e.key === "Enter") {
        // a text box takes its own Enter, and a focused button presses itself: an answer in focus
        // (a card, a stop of the slider) is picked by it. Once it is the picked one, Enter is the
        // orange button, as everywhere else
        if (target?.closest("textarea")) return
        const onPicked =
          target?.closest('[data-answers] [role="radio"]')?.getAttribute("aria-checked") === "true"
        if (target?.closest("button, a") && !onPicked) return
        if (!right.disabled) {
          e.preventDefault()
          right.onClick()
        }
        return
      }
      if (target?.closest("input, textarea")) return
      if (e.key === "Escape" && top) {
        e.preventDefault()
        setDialog("exit")
        return
      }
      if (!session || !screen || !/^[1-9]$/.test(e.key)) return
      const n = Number(e.key)
      // with an answer in focus, the focus follows the one a number picks (below)
      refocus.current = true
      if (screen.kind === "likert" && n <= 5) answer(likertAt(screen).item.id, n)
      if (screen.kind === "age" && n <= q.age_check.options.length) update({ age: q.age_check.options[n - 1] })
      if (screen.kind === "profile" && screen.item.type === "choice") {
        const options = [...(screen.item.options ?? []), ...(screen.item.other ? [OTHER] : [])]
        if (n <= options.length) answer(screen.item.id, options[n - 1])
      }
    }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <>
      <Frame
        layout={layout}
        top={top}
        progress={progress}
        pageCount={pageCount}
        dock={dock}
        left={left}
        right={right}
        screenKey={key}
        direction={direction}
        inert={dialog !== null}
      >
        {body}
      </Frame>
      <AnimatePresence>
        {dialog === "exit" && session && (
          <ConfirmDialog
            key="exit"
            title={session.consented ? t.breakTitle : t.leaveTitle}
            body={session.consented ? t.breakBody : t.leaveBody}
            stay={t.keepGoing}
            leave={t.leave}
            onStay={() => setDialog(null)}
            onLeave={() => {
              if (session.consented) {
                pause()
              } else {
                forgetSession()
                finish("start", -1)
              }
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {dialog === "restart" && (
          <ConfirmDialog
            key="restart"
            title={t.restartTitle}
            body={t.restartBody}
            stay={t.goBack}
            leave={t.restartLeave}
            onStay={() => setDialog(null)}
            onLeave={startOver}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {dialog === "decline" && session && (
          <ConfirmDialog
            key="decline"
            title={t.declineTitle}
            body={t.declineBody}
            stay={t.goBack}
            leave={t.declineLeave}
            onStay={() => setDialog(null)}
            onLeave={() => {
              forgetSession()
              finish("declined")
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {dialog === "blanks" && session && (
          <BlanksDialog
            key="blanks"
            blanks={blanks(flow, session.answers)}
            onGoTo={jumpTo}
            onSubmit={submit}
            onStay={() => setDialog(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <Toast key={toast} message={t[toast]} onDone={() => setToast(null)} />}
      </AnimatePresence>
    </>
  )
}
