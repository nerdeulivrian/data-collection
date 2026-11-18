import clsx from "clsx"
import { Download, LogOut, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { useTapSink } from "@/app/tapPress"
import { api, errorMessage, type Summary } from "@/api"
import { PressButton } from "@/components/PressButton"
import { ProgressBar } from "@/components/ProgressBar"
import { download, durations, isTest, records, toCsv, withoutTests } from "@/csv"

/** the groups, from the year level each respondent picks, and how many each should have (HANDOVER.md) */
const GROUPS = [
  { id: "P", name: "Pilot", who: "Third year", target: 10 },
  { id: "Y1", name: "First year", who: "", target: 16 },
  { id: "Y2", name: "Second year", who: "", target: 16 },
] as const

/** remembered for this browser tab only, so a reload doesn't ask again */
const PASSWORD_KEY = "wrd-survey:researcher"
const remembered = () => {
  try {
    return sessionStorage.getItem(PASSWORD_KEY) ?? ""
  } catch {
    return ""
  }
}
const remember = (pw: string | null) => {
  try {
    if (pw) sessionStorage.setItem(PASSWORD_KEY, pw)
    else sessionStorage.removeItem(PASSWORD_KEY)
  } catch {
    /* not kept */
  }
}

/**
 * The researchers' page: how many have answered in each group against its target, how many have
 * signed the consent form but not submitted, the pilot's answering time, and the two CSV files
 * (answers and consents, apart). Behind the password set in Code.gs; nothing here is public
 * without it.
 */
export function Dashboard() {
  useTapSink()
  const [password, setPassword] = useState(remembered)
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load(pw: string) {
    if (!pw || busy) return
    setBusy(true)
    setError(null)
    const r = await api.summary(pw)
    setBusy(false)
    if (!r.ok) {
      remember(null)
      setData(null)
      setError(
        r.error === "password"
          ? "That password isn't right."
          : r.error === "no_password"
            ? "No password has been set yet: put one in RESEARCHER_PASSWORD at the top of Code.gs and deploy a new version."
            : errorMessage(r.error),
      )
      return
    }
    remember(pw)
    setData(r)
  }

  useEffect(() => {
    const pw = remembered()
    if (pw) void load(pw)
    // once, on opening the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!data) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-app-bg p-4">
        <form
          className="card flex w-full max-w-[400px] flex-col gap-5 p-6"
          onSubmit={(e) => {
            e.preventDefault()
            void load(password)
          }}
        >
          <div className="flex flex-col gap-1">
            <h1 className="text-[24px] font-extrabold text-ink-strong">Researchers</h1>
            <p className="text-[15px] leading-snug font-medium text-ink-secondary">
              See who has answered, and download the answers.
            </p>
          </div>
          <PasswordField value={password} onChange={setPassword} error={error} />
          <PressButton tone="brand" size="wide" type="submit" disabled={busy || !password}>
            {busy ? "Opening…" : "Open"}
          </PressButton>
        </form>
      </div>
    )
  }

  const responses = records(data.responses)
  const real = responses.filter((r) => !isTest(r.response_id))
  const tests = responses.length - real.length
  const sent = new Set(responses.map((r) => r.response_id))
  const waiting = records(data.consents).filter((c) => !isTest(c.response_id) && !sent.has(c.response_id)).length
  const noYear = real.filter((r) => r.group === "").length
  const pilotTime = durations(data.responses, "P")
  const day = data.now.slice(0, 10)

  return (
    <div className="min-h-dvh bg-app-bg">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-5 px-4 py-6 tablet:px-8 tablet:py-10">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-extrabold text-ink-strong tablet:text-[30px]">Questionnaire responses</h1>
            <p className="text-[14px] font-semibold text-ink-secondary">As of {data.now} (Philippine time)</p>
          </div>
          <div className="flex gap-3">
            <PressButton tone="outline" size="sm" onClick={() => void load(remembered())} disabled={busy}>
              <RefreshCw size={16} className={clsx("mr-2", busy && "animate-spin")} aria-hidden />
              Refresh
            </PressButton>
            <PressButton
              tone="outline"
              size="sm"
              onClick={() => {
                remember(null)
                setPassword("")
                setData(null)
              }}
            >
              <LogOut size={16} className="mr-2" aria-hidden />
              Sign out
            </PressButton>
          </div>
        </header>

        <section className="grid gap-4 tablet:grid-cols-3" aria-label="Groups">
          {GROUPS.map((g) => {
            const submitted = real.filter((r) => r.group === g.id).length
            return (
              <article key={g.id} className="card flex flex-col gap-3 p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[17px] font-extrabold text-ink-strong">{g.name}</h2>
                  {g.who && <span className="text-[13px] font-bold text-ink-secondary">{g.who}</span>}
                </div>
                <p className="text-[15px] font-semibold text-ink">
                  <span className="text-[30px] font-extrabold text-ink-strong">{submitted}</span> of {g.target}{" "}
                  submitted
                </p>
                <div className="overflow-hidden rounded-pill">
                  <ProgressBar fraction={submitted / g.target} />
                </div>
              </article>
            )
          })}
        </section>
        {(waiting > 0 || noYear > 0) && (
          <p className="-mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold text-ink-secondary">
            {waiting > 0 && (
              <span className="text-brand-ink">
                {waiting} {waiting === 1 ? "has" : "have"} signed the consent form but not submitted yet
              </span>
            )}
            {noYear > 0 && <span>{noYear} submitted without a year level, so not counted above</span>}
          </p>
        )}

        <section className="grid gap-4 tablet:grid-cols-2">
          <article className="card flex flex-col gap-2 p-5">
            <h2 className="text-[17px] font-extrabold text-ink-strong">Pilot answering time</h2>
            {pilotTime ? (
              <>
                <p className="text-[15px] font-semibold text-ink">
                  Average <span className="text-[26px] font-extrabold text-ink-strong">{pilotTime.mean.toFixed(1)}</span> minutes
                </p>
                <p className="text-[15px] font-semibold text-ink-secondary">
                  Range {pilotTime.min.toFixed(1)} to {pilotTime.max.toFixed(1)} minutes, from {pilotTime.n}{" "}
                  {pilotTime.n === 1 ? "respondent" : "respondents"}
                </p>
              </>
            ) : (
              <p className="text-[15px] font-semibold text-ink-secondary">No pilot answers yet.</p>
            )}
            <p className="mt-1 text-[13px] leading-snug font-medium text-ink-secondary">
              Timed from the letter, right after the consent form, to SUBMIT.
            </p>
          </article>

          <article className="card flex flex-col gap-3 p-5">
            <h2 className="text-[17px] font-extrabold text-ink-strong">Download</h2>
            <div className="flex flex-wrap gap-3">
              <PressButton
                tone="brand"
                size="mdGrow"
                onClick={() => download(`responses-${day}.csv`, toCsv(withoutTests(data.responses)))}
              >
                <Download size={18} className="mr-2" aria-hidden />
                Responses
              </PressButton>
              <PressButton
                tone="outline"
                size="mdGrow"
                onClick={() => download(`consents-${day}.csv`, toCsv(withoutTests(data.consents)))}
              >
                <Download size={18} className="mr-2" aria-hidden />
                Consents
              </PressButton>
            </div>
            <p className="text-[13px] leading-snug font-medium text-ink-secondary">
              The consents file has names and addresses: keep it apart from the answers. Test runs (the
              …/?test link) are left out of both{tests > 0 && ` (${tests} so far)`}.
            </p>
          </article>
        </section>
      </div>
    </div>
  )
}

function PasswordField({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (v: string) => void
  error: string | null
}) {
  return (
    <div className="flex flex-col gap-[6px]">
      <label htmlFor="password" className="text-[15px] font-[700] text-ink-strong">
        Password
      </label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          "h-[48px] w-full rounded-[12px] border-2 bg-surface px-4 text-[17px] text-ink-strong outline-none focus:bg-white focus-visible:outline-none",
          error ? "border-incorrect" : "border-line focus:border-brand",
        )}
      />
      {error && (
        <p role="alert" className="text-[14px] leading-snug font-semibold text-incorrect-ink">
          {error}
        </p>
      )}
    </div>
  )
}
