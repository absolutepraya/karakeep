import { describe, expect, test } from "vitest";

import {
  collaboratorRemovalMessage,
  invitationDeliveryMessage,
  canManageCollaboratorOnList,
} from "./collaborationUi";

describe("stable collaboration UI semantics", () => {
  test("reports email delivery truthfully", () => {
    expect(invitationDeliveryMessage(true)).toMatch(/sent/i);
    expect(invitationDeliveryMessage(false)).toMatch(/created/i);
    expect(invitationDeliveryMessage(false)).toMatch(/email.*not.*sent/i);
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

  test("removal confirmation distinguishes list entries from bookmarks", () => {
    const message = collaboratorRemovalMessage("Daffa");
    expect(message).toContain("Daffa");
    expect(message).toMatch(/removed from this shared list/i);
    expect(message).toMatch(/underlying bookmarks.*remain/i);
  });
});
