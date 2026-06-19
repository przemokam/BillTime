import { describe, it, expect } from "vitest";
import {
  parseTimeOfDay,
  parseDuration,
  formatTimeOfDay,
  formatDuration,
  durationMinutes,
} from "./time";

describe("parseTimeOfDay (Clockify ruleset)", () => {
  const cases: [string, number | null][] = [
    ["1", 60],
    ["13", 13 * 60],
    ["130", 90],
    ["2330", 23 * 60 + 30],
    ["0345", 3 * 60 + 45],
    ["9.45", 9 * 60 + 45],
    ["9:45", 9 * 60 + 45],
    ["1pm", 13 * 60],
    ["1 am", 60],
    ["12am", 0],
    ["12pm", 12 * 60],
    ["00:00", 0],
    ["23:59", 23 * 60 + 59],
    ["", null],
    ["24", null],
    ["1265", null],
    ["abc", null],
  ];
  it.each(cases)("%s -> %s", (input, expected) => {
    expect(parseTimeOfDay(input)).toBe(expected);
  });
});

describe("parseDuration", () => {
  const cases: [string, number | null][] = [
    ["1.5", 90],
    ["1h30m", 90],
    [".5", 30],
    [":30", 30],
    ["1:30", 90],
    ["0.1", 6],
    ["90m", 90],
    ["2h", 120],
    ["", null],
    ["xx", null],
  ];
  it.each(cases)("%s -> %s", (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });
});

describe("formatting", () => {
  it("formatTimeOfDay", () => {
    expect(formatTimeOfDay(13 * 60)).toBe("13:00");
    expect(formatTimeOfDay(90)).toBe("01:30");
  });
  it("formatDuration", () => {
    expect(formatDuration(270)).toBe("4h 30m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(45)).toBe("45m");
  });
  it("durationMinutes handles midnight crossing", () => {
    expect(durationMinutes(540, 810)).toBe(270);
    expect(durationMinutes(1380, 60)).toBe(120); // 23:00 -> 01:00
  });
});
