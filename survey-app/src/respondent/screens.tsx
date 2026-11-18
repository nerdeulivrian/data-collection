import clsx from "clsx"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { CheckCards, ChoiceCards, LikertScale } from "@/components/Answers"
import { Overline } from "@/components/Bits"
import { optionStyle } from "@/components/optionStyles"
import { TextField } from "@/components/TextField"
import {
  likertAt,
  likertParts,
  paragraphs,
  partName,
  profile,
  q,
  type Answers,
  type LikertPart,
  type Screen,
} from "@/survey"

/*
 * What each screen shows. All the questionnaire's words come from questionnaire.json (`q`); the
 * few words that are the app's own (button labels, "3 of 21", the review) are written here and in
 * App.tsx. Sizes: `compact` is a phone.
 */

function Column({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex w-full max-w-[560px] flex-col tablet:max-w-[680px]", className)}>
      {children}
    </div>
  )
}

/** a question as the player shows its prompt: bold, centered, balanced lines */
function Question({ children, compact }: { children: ReactNode; compact: boolean }) {
  return (
    <h1
      className={clsx(
        "w-full text-center leading-[1.2] font-[700] text-balance text-ink-strong",
        compact ? "text-[22px]" : "text-[30px]",
      )}
    >
      {children}
    </h1>
  )
}

const reading = (compact: boolean) =>
  compact ? "text-[15px] leading-[22px]" : "text-[18px] leading-[28px]"

/** "Directions:" in bold, the rest as it is */
function Directions({ text, compact }: { text: string; compact: boolean }) {
  const m = text.match(/^(Directions:)\s*([\s\S]*)$/)
  return (
    <p className={clsx("font-medium text-pretty text-ink", reading(compact))}>
      {m ? (
        <>
          <span className="font-[700] text-ink-strong">{m[1]}</span> {m[2]}
        </>
      ) : (
        text
      )}
    </p>
  )
}

/* ---------- the start ---------- */

/** the title and who it's for; a note when a questionnaire waits on this phone, or on a test run */
export function StartScreen({
  waiting,
  test,
  compact,
}: {
  waiting: boolean
  test: boolean
  compact: boolean
}) {
  const [about, ...people] = paragraphs(q.description)
  const note = clsx("rounded-[16px] border-2 p-4 font-semibold text-pretty", reading(compact))
  return (
    <Column className={compact ? "gap-6" : "gap-8"}>
      <div className={clsx("flex flex-col", compact ? "gap-3" : "gap-4")}>
        <h1
          className={clsx(
            "leading-[1.15] font-extrabold text-balance text-ink-strong",
            compact ? "text-[24px]" : "text-[36px]",
          )}
        >
          {q.title}
        </h1>
        <p className={clsx("font-medium text-pretty text-ink", reading(compact))}>{about}</p>
        {people.map((p) => (
          <p
            key={p}
            className={clsx(
              "font-semibold whitespace-pre-line text-ink-secondary",
              compact ? "text-[13px] leading-[19px]" : "text-[15px] leading-[22px]",
            )}
          >
            {p}
          </p>
        ))}
      </div>
      {(waiting || test) && (
        <div className={clsx("flex flex-col", compact ? "gap-3" : "gap-4")}>
          {waiting && (
            <p className={clsx(note, "border-brand bg-brand-wash text-brand-ink")}>
              You have an unfinished questionnaire on this phone. Press CONTINUE to pick up where you
              left off.
            </p>
          )}
          {test && (
            <p className={clsx(note, "border-line text-ink-secondary")}>
              Test run: these answers are kept apart and don’t count.
            </p>
          )}
        </div>
      )}
    </Column>
  )
}

/* ---------- before the questionnaire ---------- */

export function AgeScreen({
  value,
  onChoose,
  compact,
}: {
  value: string | null
  onChoose: (option: string) => void
  compact: boolean
}) {
  return (
    <Column className={compact ? "gap-6" : "gap-8"}>
      <Question compact={compact}>{q.age_check.question}</Question>
      <ChoiceCards
        label={q.age_check.question}
        options={q.age_check.options}
        value={value}
        onChoose={onChoose}
        compact={compact}
      />
    </Column>
  )
}

/** A page of the consent form, the letter or the general directions. */
export function ReadScreen({
  screen,
  compact,
}: {
  screen: Extract<Screen, { kind: "read" }>
  compact: boolean
}) {
  const { section, title, page, pages } = screen
  const letter = section === "letter"
  return (
    <Column className={compact ? "gap-3" : "gap-4"}>
      {pages > 1 && (
        <Overline>
          Page {page} of {pages}
        </Overline>
      )}
      {title && (
        <h1
          className={clsx(
            "leading-[1.2] text-balance text-ink-strong",
            letter
              ? clsx("font-[700]", compact ? "text-[17px]" : "text-[21px]")
              : clsx("font-extrabold", compact ? "text-[22px]" : "text-[30px]"),
          )}
        >
          {title}
        </h1>
      )}
      <div className={clsx("flex flex-col", compact ? "gap-3" : "gap-4")}>
        {screen.paragraphs.map((p, i) => {
          // the general directions' second paragraph is the definition of a word retrieval difficulty
          const callout = section === "directions" && i > 0
          return (
            <p
              key={i}
              className={clsx(
                "whitespace-pre-line text-pretty",
                reading(compact),
                callout
                  ? "rounded-[16px] border-2 border-brand bg-brand-wash p-4 font-semibold text-brand-ink"
                  : "font-medium text-ink",
              )}
            >
              {p}
            </p>
          )
        })}
      </div>
    </Column>
  )
}

export function DataUseScreen({
  values,
  onToggle,
  compact,
}: {
  values: number[]
  onToggle: (n: number) => void
  compact: boolean
}) {
  const d = q.consent.data_use
  return (
    <Column className={compact ? "gap-4" : "gap-6"}>
      <div className="flex flex-col gap-1">
        <Overline>Tick one or more</Overline>
        <h1
          className={clsx(
            "leading-[1.2] font-[700] text-ink-strong",
            compact ? "text-[20px]" : "text-[26px]",
          )}
        >
          {d.prompt}
        </h1>
      </div>
      <CheckCards label={d.prompt} options={d.options} values={values} onToggle={onToggle} compact={compact} />
    </Column>
  )
}

const today = () =>
  new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })

export function SignScreen({
  name,
  signature,
  address,
  onChange,
  onDecline,
  compact,
}: {
  name: string
  signature: string
  address: string
  onChange: (field: "name" | "signature" | "address", value: string) => void
  onDecline: () => void
  compact: boolean
}) {
  const f = q.consent.fields
  return (
    <Column className={compact ? "gap-4" : "gap-5"}>
      <TextField id="name" label={f.name} value={name} onChange={(v) => onChange("name", v)} autoComplete="name" maxLength={120} />
      <TextField id="signature" label={f.signature} value={signature} onChange={(v) => onChange("signature", v)} maxLength={120} />
      <TextField id="address" label={f.address} value={address} onChange={(v) => onChange("address", v)} autoComplete="street-address" maxLength={200} />
      <p className="text-[14px] font-semibold text-ink-secondary">
        Date: <span className="text-ink">{today()}</span>
      </p>
      <div className="flex flex-col items-center text-center">
        <p className={clsx("font-[700] text-ink-strong", compact ? "text-[17px]" : "text-[20px]")}>
          {q.consent.agree.question}
        </p>
        <button
          type="button"
          onClick={onDecline}
          className="flex min-h-[44px] items-center px-4 text-[15px] font-[700] text-incorrect-ink underline-offset-4 hover:underline"
        >
          {q.consent.agree.no}
        </button>
      </div>
    </Column>
  )
}

/* ---------- the parts ---------- */

/** the five answers, small and still, so the directions show what each number means */
function ScaleKey({ scale, compact }: { scale: LikertPart["scale"]; compact: boolean }) {
  return (
    <ul className={clsx("grid w-full grid-cols-5", compact ? "gap-[5px]" : "gap-3")} aria-label="The answers">
      {scale.map((s) => (
        <li
          key={s.value}
          className={clsx(
            "flex flex-col items-center rounded-[8px] border-2 border-line text-center",
            compact ? "gap-1 px-[2px] py-2" : "gap-2 px-2 py-3",
          )}
        >
          <span className={clsx("leading-none font-[800] text-ink", compact ? "text-[18px]" : "text-[24px]")}>
            {s.value}
          </span>
          <span
            className={clsx(
              "font-[700] text-ink-soft",
              compact ? "text-[10.5px] leading-[12px]" : "text-[13px] leading-[16px]",
            )}
          >
            {s.label}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function PartIntroScreen({ part, compact }: { part: number; compact: boolean }) {
  const p = part === 0 ? profile : likertParts[part - 1]
  const { roman, name } = partName(p.title)
  const scale = part === 0 ? null : (p as LikertPart).scale
  const count = part === 0 ? null : (p as LikertPart).items.length
  return (
    <Column className={compact ? "gap-4" : "gap-6"}>
      <div className="flex flex-col gap-1">
        <Overline>
          Part {roman}
          {count !== null && ` · ${count} items`}
        </Overline>
        <h1
          className={clsx(
            "leading-[1.15] font-extrabold text-balance text-ink-strong",
            compact ? "text-[26px]" : "text-[36px]",
          )}
        >
          {name}
        </h1>
      </div>
      <Directions text={p.directions} compact={compact} />
      {scale && <ScaleKey scale={scale} compact={compact} />}
    </Column>
  )
}

export function ProfileScreen({
  screen,
  answers,
  onAnswer,
  compact,
}: {
  screen: Extract<Screen, { kind: "profile" }>
  answers: Answers
  onAnswer: (id: string, value: string) => void
  compact: boolean
}) {
  const { item, ordinal, of } = screen
  const value = answers[item.id]
  return (
    <Column className={compact ? "gap-5" : "gap-7"}>
      <div className="flex flex-col items-center gap-2">
        <Overline>
          {ordinal} of {of}
        </Overline>
        <Question compact={compact}>{item.label}</Question>
      </div>
      {item.type === "number" ? (
        <div className="mx-auto w-[150px]">
          <TextField
            id={item.id}
            label={item.label}
            hideLabel
            value={value === undefined ? "" : String(value)}
            onChange={(v) => onAnswer(item.id, v.replace(/\D/g, ""))}
            inputMode="numeric"
            maxLength={3}
            big
            autoFocus={!compact}
          />
        </div>
      ) : (
        <ChoiceCards
          label={item.label}
          options={item.options ?? []}
          value={value === undefined ? null : String(value)}
          onChoose={(option) => onAnswer(item.id, option)}
          compact={compact}
          other={
            item.other
              ? {
                  value: String(answers[item.other] ?? ""),
                  onChange: (text) => onAnswer(item.other!, text),
                }
              : undefined
          }
        />
      )}
    </Column>
  )
}

export function LikertScreen({
  screen,
  value,
  onChoose,
  compact,
}: {
  screen: Extract<Screen, { kind: "likert" }>
  value: number | null
  onChoose: (value: number) => void
  compact: boolean
}) {
  const { part, item } = likertAt(screen)
  return (
    <Column className={compact ? "gap-6" : "gap-9"}>
      <div className={clsx("flex flex-col items-center text-center", compact ? "gap-2" : "gap-3")}>
        <Overline>
          {item.n} of {part.items.length}
        </Overline>
        {/* the part's stem, repeated on every item (Part III and IV's sentences run on into the item) */}
        <p
          className={clsx(
            "font-semibold text-balance text-ink-secondary",
            compact ? "text-[15px] leading-[21px]" : "text-[19px] leading-[27px]",
          )}
        >
          {part.stem}
        </p>
        <h1
          className={clsx(
            "leading-[1.25] font-[700] text-balance text-ink-strong",
            compact ? "text-[21px]" : "text-[30px]",
          )}
        >
          {item.text}
        </h1>
      </div>
      <LikertScale label={item.text} scale={part.scale} value={value} onChoose={onChoose} compact={compact} />
    </Column>
  )
}

export function PilotScreen({
  value,
  onChange,
  compact,
}: {
  value: string
  onChange: (text: string) => void
  compact: boolean
}) {
  const p = q.pilot_only
  return (
    <Column className={compact ? "gap-4" : "gap-6"}>
      <div className="flex flex-col gap-2">
        <h1
          className={clsx(
            "leading-[1.2] font-extrabold text-balance text-ink-strong",
            compact ? "text-[22px]" : "text-[30px]",
          )}
        >
          {p.title}
        </h1>
        <p className={clsx("font-medium text-pretty text-ink", reading(compact))}>{p.intro}</p>
      </div>
      <TextField id="pilot" label={p.question} value={value} onChange={onChange} rows={compact ? 5 : 6} maxLength={4000} />
    </Column>
  )
}

/* ---------- the end ---------- */

const MAX_REVIEW_TILES = 24

export function ReviewScreen({
  total,
  blanks,
  onGoTo,
  compact,
}: {
  total: number
  blanks: { index: number; label: string }[]
  onGoTo: (index: number) => void
  compact: boolean
}) {
  const shown = blanks.slice(0, MAX_REVIEW_TILES)
  return (
    <Column className="items-center gap-5 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1
          className={clsx(
            "leading-[1.2] font-extrabold text-balance text-ink-strong",
            compact ? "text-[24px]" : "text-[32px]",
          )}
        >
          You’ve reached the end
        </h1>
        <p className={clsx("font-medium text-pretty text-ink", reading(compact))}>
          You answered {total - blanks.length} of {total} items.{" "}
          {blanks.length === 0
            ? "Press SUBMIT to send your answers."
            : "Tap an item to answer it, or press SUBMIT."}
        </p>
      </div>
      {blanks.length > 0 && (
        <div className="flex flex-col items-center gap-3">
          <Overline className="text-incorrect-ink">Left blank</Overline>
          <ul className="flex flex-wrap justify-center gap-x-2 gap-y-3">
            {shown.map((b) => (
              <li key={b.index}>
                <button
                  type="button"
                  aria-label={`Go to item ${b.label}`}
                  onClick={() => onGoTo(b.index)}
                  className={clsx(
                    "press flex h-[44px] min-w-[44px] items-center justify-center rounded-[8px] border px-2 text-[15px] font-[700] text-incorrect [--press-depth:4px]",
                    optionStyle.unselected.box,
                  )}
                >
                  {b.label}
                </button>
              </li>
            ))}
            {blanks.length > shown.length && (
              <li className="flex h-[44px] items-center px-1 text-[15px] font-[700] text-incorrect">
                +{blanks.length - shown.length}
              </li>
            )}
          </ul>
        </div>
      )}
    </Column>
  )
}

/** the thank-you, the age stop and the declined consent: a sign in a ring, a title, a line */
export function EndScreen({
  icon: Icon,
  tone,
  title,
  body,
  compact,
}: {
  icon: LucideIcon
  tone: "brand" | "quiet"
  title: string
  body?: string
  compact: boolean
}) {
  return (
    <Column className="items-center gap-4 text-center">
      <span
        className={clsx(
          "flex items-center justify-center rounded-pill border-[6px]",
          tone === "brand" ? "border-brand bg-brand-wash text-brand" : "border-line text-ink-secondary",
          compact ? "h-[96px] w-[96px]" : "h-[120px] w-[120px]",
        )}
      >
        <Icon size={compact ? 44 : 54} strokeWidth={2.5} aria-hidden />
      </span>
      <h1
        className={clsx(
          "leading-[1.2] font-extrabold text-balance text-ink-strong",
          compact ? "text-[24px]" : "text-[32px]",
        )}
      >
        {title}
      </h1>
      {body && (
        <p className={clsx("max-w-[480px] font-medium text-pretty text-ink", reading(compact))}>{body}</p>
      )}
    </Column>
  )
}
