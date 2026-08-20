import { describe, expect, it } from "vitest";
import {
  canReadReport,
  canUpdateReport,
  shouldUseExistingReportByClientRequestId
} from "./permissions";

describe("report permissions", () => {
  it("lets personnel read only their own reports", () => {
    expect(
      canReadReport(
        { id: "u1", role: "PERSONNEL", is_active: true },
        { created_by_user_id: "u1", status: "SUBMITTED" }
      )
    ).toBe(true);
    expect(
      canReadReport(
        { id: "u1", role: "PERSONNEL", is_active: true },
        { created_by_user_id: "u2", status: "SUBMITTED" }
      )
    ).toBe(false);
  });

  it("prevents personnel from editing submitted reports", () => {
    expect(
      canUpdateReport(
        { id: "u1", role: "PERSONNEL", is_active: true },
        { created_by_user_id: "u1", status: "SUBMITTED" }
      )
    ).toBe(false);
  });

  it("uses client request id to avoid duplicate submissions", () => {
    expect(
      shouldUseExistingReportByClientRequestId(
        "550e8400-e29b-41d4-a716-446655440000",
        "550e8400-e29b-41d4-a716-446655440000"
      )
    ).toBe(true);
  });
});
