import { describe, expect, it } from "vitest";
import { mapReportToExcelRow } from "./excel";

describe("Excel export mapping", () => {
  it("keeps the first two personnel in legacy columns and moves the rest", () => {
    const row = mapReportToExcelRow({
      report_date: "2026-08-19",
      report_number: "RPR-2026-000001",
      company_name_snapshot: "Örnek Firma",
      created_by_name_snapshot: "Operatör",
      workshop_departure_at: null,
      customer_arrival_at: null,
      customer_departure_at: null,
      factory_return_at: null,
      company_contact_name: null,
      company_contact_phone: null,
      line_name: null,
      machine_brand_model: null,
      customer_machine_name: null,
      vehicle_plate: null,
      vehicle_start_km: null,
      vehicle_end_km: null,
      used_equipment: null,
      product_item_coil_code: null,
      product_code: null,
      product_measure: null,
      product_width: null,
      product_length: null,
      product_quantity: null,
      belt_code_snapshot: null,
      product_types: ["Konveyör Bant"],
      process_actions: ["Yeni Bant"],
      edge_cut_method: null,
      process_description: null,
      mechanical_connection: null,
      profile_material: null,
      replacement_reasons: null,
      replacement_reason_other: null,
      has_test_piece: null,
      test_status: null,
      press_start_time: null,
      press_end_time: null,
      power_outage: null,
      pressure_drop: null,
      heat_balance_ok: null,
      billing_status: null,
      technical_details: null,
      tensioning_done: null,
      customer_will_tension: null,
      customer_tensioned_auto: null,
      line_delivered_running: null,
      pre_tension_percent: null,
      pressure_value: null,
      pressure_unit: null,
      blanket_roughening_info_given: null,
      blanket_info_person_name: null,
      report_personnel: [
        { name_snapshot: "A Personel" },
        { name_snapshot: "B Personel" },
        { name_snapshot: "C Personel" }
      ],
      report_photos: [{ category: "Makine", caption: "", storage_path: "private/a.jpg" }]
    });

    expect(row[4]).toBe("A Personel");
    expect(row[5]).toBe("B Personel");
    expect(row[6]).toBe("C Personel");
    expect(row[row.length - 1]).toBe(1);
  });
});
