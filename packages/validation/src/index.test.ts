import { describe, expect, it } from "vitest";
import {
  emptyReportFormValues,
  organizationRegistrationSchema,
  reportFormSchema,
  reportReturnCloseoutSchema
} from "./index";

describe("reportFormSchema", () => {
  const base = {
    ...emptyReportFormValues,
    client_request_id: "550e8400-e29b-41d4-a716-446655440000",
    report_date: "2026-08-19",
    company_id: "550e8400-e29b-41d4-a716-446655440001"
  };

  it("requires either an action or a process description", () => {
    const result = reportFormSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it("accepts the minimum real report fields", () => {
    const result = reportFormSchema.safeParse({
      ...base,
      process_description: "Bant montaj kontrolü yapıldı."
    });
    expect(result.success).toBe(true);
  });

  it("requires edge cut method when edge cut is selected", () => {
    const result = reportFormSchema.safeParse({
      ...base,
      process_actions: ["Kenar Kesim"]
    });
    expect(result.success).toBe(false);
  });
});

describe("reportReturnCloseoutSchema", () => {
  const base = {
    customer_departure_at: "2026-09-07T15:00:00.000Z",
    factory_return_at: "2026-09-07T16:30:00.000Z",
    vehicle_plate: "34 ABC 123",
    vehicle_start_km: "125000",
    vehicle_end_km: "125120"
  };

  it("accepts return details recorded after customer delivery", () => {
    expect(reportReturnCloseoutSchema.safeParse(base).success).toBe(true);
  });

  it("requires return odometer data when a vehicle was used", () => {
    const result = reportReturnCloseoutSchema.safeParse({ ...base, vehicle_end_km: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a return before customer departure or below the starting odometer", () => {
    expect(reportReturnCloseoutSchema.safeParse({
      ...base,
      factory_return_at: "2026-09-07T14:00:00.000Z",
      vehicle_end_km: "124999"
    }).success).toBe(false);
  });
});

describe("organizationRegistrationSchema", () => {
  const registration = {
    organization_name: "Yeni Firma",
    first_name: "Ada",
    last_name: "Yönetici",
    email: "YONETICI@EXAMPLE.COM",
    phone: "",
    password: "Guvenli-Parola-2026",
    billing_interval: "monthly",
    plan_id: null,
    terms_accepted: true
  };

  it("normalizes a valid organization registration", () => {
    const result = organizationRegistrationSchema.parse(registration);
    expect(result.email).toBe("yonetici@example.com");
  });

  it("rejects registration without accepted terms", () => {
    const result = organizationRegistrationSchema.safeParse({
      ...registration,
      terms_accepted: false
    });
    expect(result.success).toBe(false);
  });
});
