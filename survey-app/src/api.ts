import { strings, type Lang, type Strings } from "./strings"
import type { Answers, Group } from "./survey"

/**
 * The calls to the Apps Script web app (server/Code.gs). Each is a POST of plain text, so the
 * browser sends it without asking the server first (no CORS preflight), and Apps Script's answer
 * comes back by way of its own redirect. In `pnpm dev` the same calls go to /dev-api.
 */
const API_URL: string = import.meta.env.VITE_API_URL || "/dev-api"

export type ApiError =
  | "incomplete"
  | "no_consent"
  | "password"
  | "no_password"
  | "bad_request"
  | "server"
  | "network"

export type Failure = { ok: false; error: ApiError }
type Result<T> = ({ ok: true } & T) | Failure

const TIMEOUT_MS = 30000

async function post<T>(body: Record<string, unknown>): Promise<Result<T>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(body),
      redirect: "follow",
      signal: controller.signal,
    })
    if (!res.ok) return { ok: false, error: "network" }
    const data = await res.json()
    if (!data || typeof data.ok !== "boolean") return { ok: false, error: "server" }
    return data as Result<T>
  } catch {
    return { ok: false, error: "network" }
  } finally {
    clearTimeout(timer)
  }
}

export type Summary = {
  now: string
  /** the tabs as they show, header row first */
  responses: string[][]
  consents: string[][]
}

export const api = {
  consent: (body: {
    id: string
    name: string
    signature: string
    address: string
    data_use: number[]
    /** the language the consent form was signed in */
    language: Lang
  }) => post<object>({ action: "consent", ...body }),
  submit: (body: {
    id: string
    group: Group | ""
    answers: Answers
    elapsed_ms: number
    /** the language on screen at SUBMIT; one who switched part-way shows only as this */
    language: Lang
  }) => post<{ submitted_at: string }>({ action: "submit", ...body }),
  summary: (password: string) => post<Summary>({ action: "summary", password }),
}

/** what to tell a respondent when a call fails: which of the app's messages (strings.ts) */
export function errorKind(error: ApiError): Extract<keyof Strings, "noNetwork" | "wentWrong"> {
  return error === "network" ? "noNetwork" : "wentWrong"
}

/** the same in English, for the researchers' page */
export function errorMessage(error: ApiError): string {
  return strings.en[errorKind(error)]
}
