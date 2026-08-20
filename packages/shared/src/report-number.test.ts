import { describe, expect, it } from "vitest";
import { formatReportNumber } from "./report-number";

describe("formatReportNumber", () => {
  it("uses the TUNCA annual sequence format", () => {
    expect(formatReportNumber(2026, 1)).toBe("TNC-2026-000001");
    expect(formatReportNumber(2026, 123)).toBe("TNC-2026-000123");
  });
});
