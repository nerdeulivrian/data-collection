import { describe, expect, it } from "vitest"
import { durations, records, toCsv, withoutTests } from "./csv"

describe("toCsv", () => {
  it("starts with a byte-order mark and ends rows with CRLF", () => {
    expect(toCsv([["a", "b"], ["1", "2"]])).toBe("﻿a,b\r\n1,2\r\n")
  })

  it("quotes commas, quotes and line breaks", () => {
    expect(toCsv([["Obrero, Davao", 'say "uh"', "two\nlines"]])).toBe(
      '﻿"Obrero, Davao","say ""uh""","two\nlines"\r\n',
    )
  })

  it("keeps a spreadsheet from running a value as a formula", () => {
    expect(toCsv([["=1+1", "+63", "@x", "- Part II", "-1.5", "12.3"]])).toBe(
      "﻿'=1+1,'+63,'@x,'- Part II,-1.5,12.3\r\n",
    )
  })
})

describe("withoutTests", () => {
  it("drops the test runs and keeps the header", () => {
    const grid = [
      ["response_id", "group"],
      ["R-K7Q2XM4P", "P"],
      ["T-AAAA2222", "T"],
      ["R-BBBB3333", "Y1"],
    ]
    expect(withoutTests(grid)).toEqual([
      ["response_id", "group"],
      ["R-K7Q2XM4P", "P"],
      ["R-BBBB3333", "Y1"],
    ])
    expect(withoutTests([])).toEqual([])
  })
})

describe("records", () => {
  it("keys each row by the header", () => {
    expect(records([["response_id", "group"], ["R-K7Q2XM4P", "P"], ["R-B"]])).toEqual([
      { response_id: "R-K7Q2XM4P", group: "P" },
      { response_id: "R-B", group: "" },
    ])
    expect(records([])).toEqual([])
  })
})

describe("durations", () => {
  it("averages the group's times and gives the range", () => {
    const grid = [
      ["response_id", "group", "duration_min"],
      ["R-AAAA2222", "P", "10"],
      ["R-BBBB3333", "P", "14.5"],
      ["R-CCCC4444", "P", ""],
      ["R-DDDD5555", "Y1", "30"],
    ]
    expect(durations(grid, "P")).toEqual({ n: 2, mean: 12.25, min: 10, max: 14.5 })
    expect(durations(grid, "Y2")).toBeNull()
  })
})
