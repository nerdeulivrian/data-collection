import vm from "node:vm"

/**
 * Stand-ins for the parts of Google Sheets and Apps Script that Code.gs uses, close enough to run
 * it in tests and behind `pnpm dev` (server/devApi.ts). Where Sheets is strict (a range of zero
 * rows, data that doesn't fit its range) these throw too, so a mistake shows up here first.
 */

export type Cell = string | number | boolean

class FakeRange {
  constructor(
    private sheet: FakeSheet,
    private row: number,
    private column: number,
    private numRows: number,
    private numColumns: number,
  ) {}

  private map<T>(f: (v: Cell) => T): T[][] {
    const out: T[][] = []
    for (let i = 0; i < this.numRows; i++) {
      const r: T[] = []
      for (let j = 0; j < this.numColumns; j++) r.push(f(this.sheet.read(this.row + i, this.column + j)))
      out.push(r)
    }
    return out
  }

  getValues() {
    return this.map((v) => v)
  }

  getDisplayValues() {
    return this.map(display)
  }

  setValues(values: Cell[][]) {
    if (values.length !== this.numRows || values.some((r) => r.length !== this.numColumns)) {
      throw new Error("The data's size does not match the range's")
    }
    values.forEach((r, i) => r.forEach((v, j) => this.sheet.write(this.row + i, this.column + j, v)))
    return this
  }

  setValue(value: Cell) {
    if (this.numRows !== 1 || this.numColumns !== 1) throw new Error("setValue on a range of many cells")
    this.sheet.write(this.row, this.column, value)
    return this
  }

  setNumberFormat(format: string) {
    for (let j = 0; j < this.numColumns; j++) this.sheet.formats.set(this.column + j, format)
    return this
  }

  setFontWeight() {
    return this
  }
}

function display(v: Cell): string {
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE"
  return String(v)
}

export class FakeSheet {
  rows: Cell[][] = []
  formats = new Map<number, string>()
  frozenRows = 0

  constructor(
    readonly name: string,
    private book: FakeBook,
  ) {}

  getName() {
    return this.name
  }

  getLastRow() {
    for (let r = this.rows.length; r > 0; r--) if (this.rows[r - 1].some((v) => v !== "")) return r
    return 0
  }

  getLastColumn() {
    let width = 0
    for (const row of this.rows) {
      for (let c = row.length; c > width; c--) {
        if (row[c - 1] !== "") {
          width = c
          break
        }
      }
    }
    return width
  }

  getMaxRows() {
    return Math.max(1000, this.rows.length)
  }

  getRange(row: number, column: number, numRows = 1, numColumns = 1) {
    if (row < 1 || column < 1 || numRows < 1 || numColumns < 1) {
      throw new Error(`The range ${row}, ${column}, ${numRows}, ${numColumns} is not valid`)
    }
    return new FakeRange(this, row, column, numRows, numColumns)
  }

  appendRow(values: Cell[]) {
    const row = this.getLastRow() + 1
    values.forEach((v, i) => this.write(row, i + 1, v))
    return this
  }

  setFrozenRows(n: number) {
    this.frozenRows = n
  }

  read(row: number, column: number): Cell {
    return this.rows[row - 1]?.[column - 1] ?? ""
  }

  write(row: number, column: number, value: Cell) {
    while (this.rows.length < row) this.rows.push([])
    const r = this.rows[row - 1]
    while (r.length < column) r.push("")
    r[column - 1] = this.book.keep(value)
  }

  /** the tab as objects keyed by its header, for tests */
  records(): Record<string, Cell>[] {
    const [header, ...rest] = this.rows
    return rest
      .filter((r) => r.some((v) => v !== ""))
      .map((r) => Object.fromEntries(header.map((h, i) => [String(h), r[i] ?? ""])))
  }
}

export class FakeBook {
  sheets: FakeSheet[] = []
  /** texts that a real Sheet would have run as formulas */
  formulas: string[] = []

  getSheetByName(name: string) {
    return this.sheets.find((s) => s.name === name) ?? null
  }

  insertSheet(name: string) {
    if (this.getSheetByName(name)) throw new Error(`A sheet named ${name} already exists`)
    const sheet = new FakeSheet(name, this)
    this.sheets.push(sheet)
    return sheet
  }

  getSheets() {
    return this.sheets
  }

  tab(name: string) {
    const sheet = this.getSheetByName(name)
    if (!sheet) throw new Error(`no ${name} tab`)
    return sheet
  }

  /** What a cell keeps of a value written to it: a leading apostrophe only marks text. */
  keep(value: Cell): Cell {
    if (value === undefined || value === null) throw new Error("undefined written to a cell")
    if (typeof value === "string") {
      if (value.startsWith("'")) return value.slice(1)
      if (value.startsWith("=")) this.formulas.push(value)
    }
    return value
  }

  dump() {
    return Object.fromEntries(this.sheets.map((s) => [s.name, s.rows]))
  }
}

function formatDate(date: Date, timeZone: string, pattern: string) {
  if (pattern !== "yyyy-MM-dd HH:mm:ss") throw new Error(`formatDate: unsupported pattern ${pattern}`)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

/** A pretend Google: one spreadsheet, and the services Code.gs calls. */
export function createGoogle(options: { password?: string } = {}) {
  const book = new FakeBook()
  const globals = {
    SpreadsheetApp: { getActiveSpreadsheet: () => book, getActive: () => book },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) =>
          key === "RESEARCHER_PASSWORD" ? (options.password ?? null) : null,
      }),
    },
    LockService: {
      getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }),
    },
    ContentService: {
      MimeType: { JSON: "JSON" },
      createTextOutput: (content: string) => {
        const output = { content, setMimeType: () => output, getContent: () => content }
        return output
      },
    },
    Utilities: { formatDate },
    Logger: { log: () => {} },
  }
  return { book, globals }
}

type Output = { getContent(): string }

/** Runs Code.gs's source with the given globals and hands back its entry points. */
export function loadCode(source: string, globals: Record<string, unknown>) {
  const context = vm.createContext({ ...globals })
  vm.runInContext(source, context, { filename: "Code.gs" })
  const fn = (name: string) => context[name] as (...args: unknown[]) => unknown
  return {
    /** a POST with this body (an object is sent as JSON); the parsed reply */
    post(body: unknown): Record<string, unknown> & { ok: boolean } {
      const contents = typeof body === "string" ? body : JSON.stringify(body)
      return JSON.parse((fn("doPost")({ postData: { contents } }) as Output).getContent())
    },
    get(): Record<string, unknown> {
      return JSON.parse((fn("doGet")({}) as Output).getContent())
    },
    setup() {
      fn("setup")()
    },
  }
}
