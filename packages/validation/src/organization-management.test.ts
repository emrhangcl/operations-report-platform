import { describe, expect, it } from "vitest";
import { organizationDeletionSchema } from "./organization-management";

describe("organization deletion confirmation", () => {
  it("requires explicit consent and normalizes the typed organization code", () => {
    expect(organizationDeletionSchema.parse({ confirmationSlug: " example-company ", confirmDeletion: true }))
      .toEqual({ confirmationSlug: "example-company", confirmDeletion: true });
  });
  it.each([{}, { confirmationSlug: "company" }, { confirmationSlug: "company", confirmDeletion: false },
    { confirmationSlug: " ", confirmDeletion: true }, { confirmationSlug: "company", confirmDeletion: true, userIds: ["other-user"] }])
  ("rejects incomplete or client-controlled deletion scope: %j", (body) => {
    expect(organizationDeletionSchema.safeParse(body).success).toBe(false);
  });
});
