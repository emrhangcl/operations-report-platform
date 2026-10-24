import { describe, expect, it } from "vitest";
import { formatTurkishDate, formatTurkishDateTime, minutesBetween } from "./date";

describe("formatTurkishDate", () => {
  it("returns a dash for missing or invalid values", () => {
    expect(formatTurkishDate(null)).toBe("-");
    expect(formatTurkishDate(undefined)).toBe("-");
    expect(formatTurkishDate("")).toBe("-");
    expect(formatTurkishDate("not-a-date")).toBe("-");
    expect(formatTurkishDate(new Date(Number.NaN))).toBe("-");
  });

  it("formats ISO strings and Date objects as DD.MM.YYYY in Europe/Istanbul", () => {
    expect(formatTurkishDate("2026-03-05T09:00:00Z")).toBe("05.03.2026");
    expect(formatTurkishDate(new Date("2026-03-05T09:00:00Z"))).toBe("05.03.2026");
  });

  it("uses the Istanbul day across the midnight boundary", () => {
    expect(formatTurkishDate("2026-12-31T21:30:00Z")).toBe("01.01.2027");
    expect(formatTurkishDate("2026-12-31T20:59:00Z")).toBe("31.12.2026");
  });
});

describe("formatTurkishDateTime", () => {
  it("returns a dash for missing or invalid values", () => {
    expect(formatTurkishDateTime(null)).toBe("-");
    expect(formatTurkishDateTime(undefined)).toBe("-");
    expect(formatTurkishDateTime("")).toBe("-");
    expect(formatTurkishDateTime("not-a-date")).toBe("-");
    expect(formatTurkishDateTime(new Date(Number.NaN))).toBe("-");
  });

  it("formats date and time in Europe/Istanbul", () => {
    expect(formatTurkishDateTime("2026-03-05T09:07:00Z")).toBe("05.03.2026 12:07");
    expect(formatTurkishDateTime(new Date("2026-03-05T09:07:00Z"))).toBe("05.03.2026 12:07");
  });

  it("uses the Istanbul day and hour across the midnight boundary", () => {
    expect(formatTurkishDateTime("2026-12-31T21:30:00Z")).toBe("01.01.2027 00:30");
  });
});

describe("minutesBetween", () => {
  it("returns null for missing input", () => {
    expect(minutesBetween(null, "2026-03-05T10:00:00Z")).toBeNull();
    expect(minutesBetween("2026-03-05T10:00:00Z", undefined)).toBeNull();
    expect(minutesBetween("", "")).toBeNull();
  });

  it("returns null for invalid dates", () => {
    expect(minutesBetween("not-a-date", "2026-03-05T10:00:00Z")).toBeNull();
    expect(minutesBetween("2026-03-05T10:00:00Z", "not-a-date")).toBeNull();
  });

  it("returns null when end is before start", () => {
    expect(minutesBetween("2026-03-05T10:00:00Z", "2026-03-05T09:59:00Z")).toBeNull();
  });

  it("returns whole minutes between start and end", () => {
    expect(minutesBetween("2026-03-05T10:00:00Z", "2026-03-05T10:00:00Z")).toBe(0);
    expect(minutesBetween("2026-03-05T10:00:00Z", "2026-03-05T11:30:00Z")).toBe(90);
  });

  it("rounds second differences to the nearest minute", () => {
    expect(minutesBetween("2026-03-05T10:00:00Z", "2026-03-05T10:01:29Z")).toBe(1);
    expect(minutesBetween("2026-03-05T10:00:00Z", "2026-03-05T10:01:30Z")).toBe(2);
    expect(minutesBetween("2026-03-05T10:00:00Z", "2026-03-05T10:00:20Z")).toBe(0);
  });
});
