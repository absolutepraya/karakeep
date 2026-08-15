import { describe, expect, test } from "vitest";

import {
  canManageCollaboratorOnList,
  formatInvitationDate,
} from "./collaborationUi";

describe("stable collaboration UI semantics", () => {
  test("formats invitation dates deterministically", () => {
    expect(formatInvitationDate(new Date("2026-08-15T23:30:00-07:00"))).toBe(
      "Aug 16, 2026",
    );
  });

  test("only direct accepted collaborators can be managed from this list", () => {
    expect(
      canManageCollaboratorOnList({ status: "accepted", inherited: false }),
    ).toBe(true);
    expect(
      canManageCollaboratorOnList({ status: "accepted", inherited: true }),
    ).toBe(false);
    expect(
      canManageCollaboratorOnList({ status: "pending", inherited: false }),
    ).toBe(false);
  });
});
