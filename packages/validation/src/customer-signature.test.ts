import { describe, expect, it } from "vitest";
import { customerSignatureSchema } from "./customer-signature";

const signature = { version: 1, signer_name: "Ayşe Yılmaz", signer_title: "Fabrika müdürü", consent: true, strokes: [[[10, 20], [90, 70], [150, 30]]] };

describe("customer signature", () => {
  it("accepts a bounded drawing and normalizes signer metadata", () => {
    expect(customerSignatureSchema.parse({ ...signature, signer_name: " Ayşe Yılmaz " }).signer_name).toBe("Ayşe Yılmaz");
  });
  it.each([
    { consent: false }, { signer_name: " " }, { signer_title: " " }, { version: 2 },
    { strokes: [] }, { strokes: [[[2, 2], [3, 3]]] },
    { strokes: [[[0, 0], [601, 40]]] }, { strokes: [[[0, 0], [40, Infinity]]] },
    { strokes: Array.from({ length: 41 }, () => [[0, 0], [60, 60]]) },
    { strokes: [Array.from({ length: 501 }, (_, i) => [i % 600, i % 240])] },
    { strokes: Array.from({ length: 5 }, () => Array.from({ length: 500 }, (_, i) => [i % 600, i % 240])) }
  ])("rejects incomplete, empty or oversized evidence: %j", (invalid) => {
    expect(customerSignatureSchema.safeParse({ ...signature, ...invalid }).success).toBe(false);
  });
  it("rejects extra client-controlled evidence fields", () => {
    expect(customerSignatureSchema.safeParse({ ...signature, signed_at: "2020-01-01" }).success).toBe(false);
  });
});
