/**
 * CSV files that open cleanly in Excel and Google Sheets: UTF-8 with a byte-order mark (so Excel
 * reads the curly quotes and ñ right), Windows line ends, quotes where a value needs them. A value
 * that starts like a formula (= + - @, but not a plain negative number) gets an apostrophe, so a
 * spreadsheet shows it instead of running it.
 */
export function toCsv(rows: string[][]): string {
  const field = (value: string) => {
    let v = value ?? ""
    if (/^[=+@]/.test(v) || /^-(?![\d.])/.test(v)) v = "'" + v
    return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  }
  return "﻿" + rows.map((r) => r.map(field).join(",")).join("\r\n") + "\r\n"
}

/** a test run's response_id starts with T- (the app opened as …/?test) */
export const isTest = (id: string | undefined) => String(id ?? "").startsWith("T-")

/** the grid without the test runs, header row kept */
export function withoutTests(grid: string[][], idColumn = "response_id"): string[][] {
  if (grid.length === 0) return grid
  const [header, ...rows] = grid
  const c = header.indexOf(idColumn)
  return [header, ...rows.filter((r) => !isTest(r[c]))]
}

/** a grid's rows as objects keyed by its header */
export function records(grid: string[][]): Record<string, string>[] {
  const [header, ...rows] = grid
  return header ? rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""]))) : []
}

/** the pilot's answering times: average and range, in minutes */
export function durations(grid: string[][], group: string) {
  if (grid.length < 2) return null
  const [header, ...rows] = grid
  const g = header.indexOf("group")
  const d = header.indexOf("duration_min")
  const minutes = rows
    .filter((r) => r[g] === group && r[d] !== "")
    .map((r) => Number(r[d]))
    .filter((m) => Number.isFinite(m))
  if (minutes.length === 0) return null
  return {
    n: minutes.length,
    mean: minutes.reduce((a, b) => a + b, 0) / minutes.length,
    min: Math.min(...minutes),
    max: Math.max(...minutes),
  }
}

export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
