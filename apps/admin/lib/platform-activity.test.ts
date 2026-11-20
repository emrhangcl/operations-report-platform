import { describe, expect, it } from "vitest";
import { buildDailyActivity, periodChange, type DailyActivity } from "./platform-activity";

const now = new Date("2026-11-20T12:00:00Z");

describe("buildDailyActivity", () => {
  it("returns one zero row per day, oldest first, ending on today's Istanbul date", () => {
    const series = buildDailyActivity({ payments: [], organizations: [], days: 7, now });
    expect(series).toHaveLength(7);
    expect(series.every((day) => day.collectedMinor === 0 && day.newOrganizations === 0)).toBe(true);
    expect(series[0]?.date).toBe("2026-11-14");
    expect(series[6]?.date).toBe("2026-11-20");
  });

  it("assigns a payment at 21:30 UTC to the next Istanbul day", () => {
    const series = buildDailyActivity({
      payments: [{ amount_minor: 5000, refunded_amount_minor: 0, paid_at: "2026-11-19T21:30:00Z" }],
      organizations: [],
      days: 7,
      now
    });
    expect(series.find((day) => day.date === "2026-11-20")?.collectedMinor).toBe(5000);
    expect(series.find((day) => day.date === "2026-11-19")?.collectedMinor).toBe(0);
  });

  it("nets refunds and skips unpaid or out-of-window payments", () => {
    const series = buildDailyActivity({
      payments: [
        { amount_minor: 10000, refunded_amount_minor: 2500, paid_at: "2026-11-18T09:00:00Z" },
        { amount_minor: 9999, refunded_amount_minor: 0, paid_at: null },
        { amount_minor: 7777, refunded_amount_minor: 0, paid_at: "2026-10-01T09:00:00Z" }
      ],
      organizations: [],
      days: 7,
      now
    });
    expect(series.find((day) => day.date === "2026-11-18")?.collectedMinor).toBe(7500);
    expect(series.reduce((sum, day) => sum + day.collectedMinor, 0)).toBe(7500);
  });

  it("counts organizations by their Istanbul creation day", () => {
    const series = buildDailyActivity({
      payments: [],
      organizations: [{ created_at: "2026-11-20T08:00:00Z" }, { created_at: "2026-11-20T10:00:00Z" }, { created_at: "2026-11-15T10:00:00Z" }],
      days: 7,
      now
    });
    expect(series.find((day) => day.date === "2026-11-20")?.newOrganizations).toBe(2);
    expect(series.find((day) => day.date === "2026-11-15")?.newOrganizations).toBe(1);
  });
});

describe("periodChange", () => {
  const day = (index: number, collectedMinor: number): DailyActivity => ({ date: `d${index}`, collectedMinor, newOrganizations: 0 });

  it("returns no percentage when the previous period is zero", () => {
    const series = [day(1, 0), day(2, 0), day(3, 40), day(4, 60)];
    expect(periodChange(series, "collectedMinor", 2)).toEqual({ current: 100, previous: 0, percent: null });
  });

  it("returns the percentage change against the previous period", () => {
    const series = [day(1, 50), day(2, 50), day(3, 75), day(4, 75)];
    expect(periodChange(series, "collectedMinor", 2)).toEqual({ current: 150, previous: 100, percent: 50 });
  });

  it("returns no percentage when the series is too short for a previous period", () => {
    expect(periodChange([day(1, 10)], "collectedMinor", 2).percent).toBeNull();
  });
});
