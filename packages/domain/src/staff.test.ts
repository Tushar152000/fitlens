import { describe, expect, it } from "vitest";
import { roleRank, STAFF_ROLE_LABELS, STAFF_ROLES, staffCan } from "./staff.js";

describe("staff roles", () => {
  it("lets only admins manage the team", () => {
    expect(staffCan("ADMIN", "manage-team")).toBe(true);
    expect(staffCan("EDITOR", "manage-team")).toBe(false);
    expect(staffCan("AUTHOR", "manage-team")).toBe(false);
  });

  it("ranks and labels every role", () => {
    expect(roleRank("ADMIN")).toBeGreaterThan(roleRank("EDITOR"));
    expect(roleRank("EDITOR")).toBeGreaterThan(roleRank("AUTHOR"));
    for (const r of STAFF_ROLES) expect(STAFF_ROLE_LABELS[r]).toBeTruthy();
  });
});
