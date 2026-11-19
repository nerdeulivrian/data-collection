import vm from "node:vm"

/**
 * Stand-ins for the parts of Google Sheets and Apps Script that Code.gs uses, close enough to run
 * it in tests and behind `pnpm dev` (server/devApi.ts). Where Sheets is strict (a range of zero
 * rows, data that doesn't fit its range, row shading put on a range that has some) these throw
 * too, so a mistake shows up here first. The look that setup gives the tabs (colours, widths,
 * frozen panes, rules) is kept as asked, for the tests and for the preview page.
 */

export type Cell = string | number | boolean

/** where a range is: its first row and column (from 1) and its size */
type Box = { row: number; column: number; numRows: number; numColumns: number }
/** one thing asked of a range's look ("background", "#fff"), kept as asked: later ones win */
type Paint = Box & { prop: string; value: string }
/** how a cell ends up looking, for the tests and the preview (server/sheetPreview.ts) */
export type Look = {
  background?: string
  fontColor?: string
  fontWeight?: string
  italic?: boolean
  align?: string
  valign?: string
  wrap?: string
}

const inside = (b: Box, row: number, column: number) =>
  row >= b.row && row < b.row + b.numRows && column >= b.column && column < b.column + b.numColumns
const overlap = (a: Box, b: Box) =>
  a.row < b.row + b.numRows && b.row < a.row + a.numRows && a.column < b.column + b.numColumns && b.column < a.column + a.numColumns

/** A, B … Z, AA: a column's letters to its number */
const columnOf = (letters: string) => [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0)

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

  get box(): Box {
    return { row: this.row, column: this.column, numRows: this.numRows, numColumns: this.numColumns }
  }

  /** a look asked of the whole range. Like Sheets, it refuses a range that runs off the grid */
  private paint(prop: string, value: unknown, allowed?: string[]) {
    if (typeof value !== "string" || !value) throw new Error(`${prop}: ${String(value)} is not a value`)
    if (allowed && !allowed.includes(value)) throw new Error(`${prop}: ${value} is not one of ${allowed.join(", ")}`)
    if (this.row + this.numRows - 1 > this.sheet.getMaxRows() || this.column + this.numColumns - 1 > this.sheet.getMaxColumns()) {
      throw new Error("Those cells are out of bounds")
    }
    this.sheet.paints.push({ ...this.box, prop, value })
    return this
  }

  setFontWeight(weight: string) {
    return this.paint("fontWeight", weight, ["bold", "normal"])
  }

  setFontColor(colour: string) {
    return this.paint("fontColor", colour)
  }

  setBackground(colour: string) {
    return this.paint("background", colour)
  }

  setBackgrounds(colours: string[][]) {
    if (colours.length !== this.numRows || colours.some((r) => r.length !== this.numColumns)) {
      throw new Error("The colours' size does not match the range's")
    }
    colours.forEach((r, i) =>
      r.forEach((c, j) => new FakeRange(this.sheet, this.row + i, this.column + j, 1, 1).setBackground(c)),
    )
    return this
  }

  setHorizontalAlignment(alignment: string) {
    return this.paint("align", alignment, ["left", "center", "right"])
  }

  setVerticalAlignment(alignment: string) {
    return this.paint("valign", alignment, ["top", "middle", "bottom"])
  }

  setWrapStrategy(strategy: string) {
    return this.paint("wrap", strategy, ["WRAP", "OVERFLOW", "CLIP"])
  }

  /** alternating row colours. Like Sheets, it refuses a range that already has some */
  applyRowBanding(theme: string, showHeader: boolean, showFooter: boolean) {
    if (theme !== "LIGHT_GREY") throw new Error(`applyRowBanding: ${String(theme)} is not a theme`)
    if (showHeader || showFooter) throw new Error("applyRowBanding: the pretend Sheet has no header or footer bands")
    if (this.sheet.bandings.some((b) => overlap(b.box, this.box))) {
      throw new Error("You cannot add alternating background colors to a range that already has alternating background colors.")
    }
    const banding = new FakeBanding(this.sheet, this.box)
    this.sheet.bandings.push(banding)
    return banding
  }

  protect() {
    const protection = new FakeProtection(this.sheet, this.box)
    this.sheet.protections.push(protection)
    return protection
  }
}

class FakeBanding {
  first = "#ffffff"
  second = "#f3f3f3"

  constructor(
    private sheet: FakeSheet,
    readonly box: Box,
  ) {}

  setFirstRowColor(colour: string) {
    this.first = colour
    return this
  }

  setSecondRowColor(colour: string) {
    this.second = colour
    return this
  }

  remove() {
    this.sheet.bandings = this.sheet.bandings.filter((b) => b !== this)
  }
}

class FakeProtection {
  description = ""
  warningOnly = false

  constructor(
    private sheet: FakeSheet,
    readonly box: Box,
  ) {}

  getDescription() {
    return this.description
  }

  setDescription(description: string) {
    this.description = description
    return this
  }

  setWarningOnly(warningOnly: boolean) {
    this.warningOnly = warningOnly
    return this
  }

  remove() {
    this.sheet.protections = this.sheet.protections.filter((p) => p !== this)
  }
}

/** a conditional formatting rule, as built: a formula written for the first range's first cell */
export type FakeRule = { formula: string; format: Look; ranges: Box[] }

class FakeRuleBuilder {
  private formula = ""
  private format: Look = {}
  private ranges: Box[] = []

  whenFormulaSatisfied(formula: string) {
    this.formula = formula
    return this
  }

  setBackground(colour: string) {
    this.format.background = colour
    return this
  }

  setFontColor(colour: string) {
    this.format.fontColor = colour
    return this
  }

  setItalic(italic: boolean) {
    this.format.italic = italic
    return this
  }

  setRanges(ranges: FakeRange[]) {
    this.ranges = ranges.map((r) => r.box)
    return this
  }

  build(): FakeRule {
    if (!this.formula.startsWith("=")) throw new Error("a rule needs a formula")
    if (!this.ranges.length) throw new Error("a rule needs a range")
    return { formula: this.formula, format: { ...this.format }, ranges: this.ranges }
  }
}

/**
 * Whether a rule holds for a cell. Sheets moves a rule's formula along with the cell, from the
 * first range's first cell: $A2 keeps its column, K2 moves both ways. The pretend Sheet reads
 * only the two shapes of formula Code.gs writes, and says so when it meets another.
 */
function holds(sheet: FakeSheet, rule: FakeRule, row: number, column: number): boolean {
  if (!rule.ranges.some((b) => inside(b, row, column))) return false
  const down = row - rule.ranges[0].row
  const across = column - rule.ranges[0].column
  const test = /^=LEFT\(\$([A-Z]+)(\d+),(\d+)\)="([^"]*)"$/.exec(rule.formula)
  if (test) {
    const value = String(sheet.read(Number(test[2]) + down, columnOf(test[1])))
    return value.slice(0, Number(test[3])) === test[4]
  }
  const blank = /^=AND\(\$([A-Z]+)(\d+)<>"",ISBLANK\(([A-Z]+)(\d+)\)\)$/.exec(rule.formula)
  if (blank) {
    const whose = sheet.read(Number(blank[2]) + down, columnOf(blank[1]))
    return whose !== "" && sheet.read(Number(blank[4]) + down, columnOf(blank[3]) + across) === ""
  }
  throw new Error(`the pretend Sheet can't read this formula: ${rule.formula}`)
}

function display(v: Cell): string {
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE"
  return String(v)
}

export class FakeSheet {
  rows: Cell[][] = []
  formats = new Map<number, string>()
  frozenRows = 0
  frozenColumns = 0
  tabColor: string | null = null
  columnWidths = new Map<number, number>()
  rowHeights = new Map<number, number>()
  paints: Paint[] = []
  bandings: FakeBanding[] = []
  rules: FakeRule[] = []
  protections: FakeProtection[] = []

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

  getMaxColumns() {
    return Math.max(26, ...this.rows.map((r) => r.length))
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

  setFrozenColumns(n: number) {
    if (!Number.isInteger(n) || n < 0 || n >= this.getMaxColumns()) throw new Error(`can't freeze ${n} columns`)
    this.frozenColumns = n
  }

  setTabColor(colour: string) {
    if (!/^#[0-9a-f]{6}$/i.test(String(colour))) throw new Error(`setTabColor: ${String(colour)} is not a colour`)
    this.tabColor = colour
    return this
  }

  setColumnWidths(start: number, count: number, width: number) {
    if (start < 1 || count < 1 || start + count - 1 > this.getMaxColumns()) throw new Error("Those columns are out of bounds")
    if (!Number.isInteger(width) || width < 2) throw new Error(`setColumnWidths: ${width} is not a width`)
    for (let c = start; c < start + count; c++) this.columnWidths.set(c, width)
    return this
  }

  setRowHeight(row: number, height: number) {
    if (row < 1 || row > this.getMaxRows() || !Number.isInteger(height) || height < 2) throw new Error("setRowHeight: not a row or not a height")
    this.rowHeights.set(row, height)
    return this
  }

  getBandings() {
    return [...this.bandings]
  }

  getConditionalFormatRules() {
    return [...this.rules]
  }

  /** the whole list: what was there before goes */
  setConditionalFormatRules(rules: FakeRule[]) {
    this.rules = [...rules]
  }

  getProtections(type: string) {
    if (type !== "RANGE") throw new Error(`getProtections: ${String(type)}`)
    return [...this.protections]
  }

  /**
   * How a cell ends up looking. As in Sheets: a rule that holds wins over what the cell was given,
   * and the row shading shows only where the cell has no colour of its own.
   */
  look(row: number, column: number): Look {
    const look: Record<string, unknown> = {}
    for (const p of this.paints) if (inside(p, row, column)) look[p.prop] = p.value
    const band = this.bandings.find((b) => inside(b.box, row, column))
    if (band && !look.background) look.background = (row - band.box.row) % 2 === 0 ? band.first : band.second
    // the first rule that says something about a property keeps it
    for (const rule of [...this.rules].reverse()) if (holds(this, rule, row, column)) Object.assign(look, rule.format)
    return look as Look
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
  /** what Code.gs wrote to the log, a line each */
  const logs: string[] = []
  const globals = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => book,
      getActive: () => book,
      WrapStrategy: { WRAP: "WRAP", OVERFLOW: "OVERFLOW", CLIP: "CLIP" },
      BandingTheme: { LIGHT_GREY: "LIGHT_GREY" },
      ProtectionType: { RANGE: "RANGE", SHEET: "SHEET" },
      newConditionalFormatRule: () => new FakeRuleBuilder(),
    },
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
    Logger: { log: (message: unknown) => void logs.push(String(message)) },
  }
  return { book, globals, logs }
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
