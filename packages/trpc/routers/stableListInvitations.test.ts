import { beforeEach, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";

import { listInvitations } from "@karakeep/db/schema";

import type { APICallerType, CustomTestContext } from "../testUtils";
import { defaultBeforeEach } from "../testUtils";

beforeEach<CustomTestContext>(defaultBeforeEach(true));

async function createManualList(api: APICallerType, name = "Shared") {
  return api.lists.create({
    name,
    icon: "📁",
    type: "manual",
  });
}

describe("stable list invitation lifecycle", () => {
  test<CustomTestContext>("normalizes invite email and reports delivery separately", async ({
    apiCallers,
  }) => {
    const ownerApi = apiCallers[0];
    const list = await createManualList(ownerApi);

    const result = await ownerApi.lists.addCollaborator({
      listId: list.id,
      email: "TEST2@TEST.COM",
      role: "viewer",
      recursive: false,
    });

    expect(result.invitationId).toBeTruthy();
    expect(result.emailSent).toBe(false);
  });

  test<CustomTestContext>("uses a neutral error for an unknown email", async ({
    apiCallers,
  }) => {
    const ownerApi = apiCallers[0];
    const list = await createManualList(ownerApi);

    await expect(
      ownerApi.lists.addCollaborator({
        listId: list.id,
        email: "missing@example.com",
        role: "viewer",
        recursive: false,
      }),
    ).rejects.toThrow("Unable to create an invitation for that email address");
  });

  test<CustomTestContext>("expires invitations after 30 days and resend renews them", async ({
    apiCallers,
    db,
  }) => {
    const ownerApi = apiCallers[0];
    const collaboratorApi = apiCallers[1];
    const list = await createManualList(ownerApi);
    const collaborator = await collaboratorApi.users.whoami();

    const { invitationId } = await ownerApi.lists.addCollaborator({
      listId: list.id,
      email: collaborator.email!,
      role: "viewer",
      recursive: false,
    });

    const expiredAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await db
      .update(listInvitations)
      .set({ invitedAt: expiredAt })
      .where(eq(listInvitations.id, invitationId));

    const [expired] = await collaboratorApi.lists.getPendingInvitations();
    expect(expired.expired).toBe(true);
    await expect(
      collaboratorApi.lists.acceptInvitation({ invitationId }),
    ).rejects.toThrow("Invitation has expired");

    const resend = await ownerApi.lists.resendInvitation({ invitationId });
    expect(resend.emailSent).toBe(false);

    const [renewed] = await collaboratorApi.lists.getPendingInvitations();
    expect(renewed.expired).toBe(false);
    expect(renewed.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test<CustomTestContext>("rejects an immediate repeated resend", async ({
    apiCallers,
    db,
  }) => {
    const ownerApi = apiCallers[0];
    const collaboratorApi = apiCallers[1];
    const list = await createManualList(ownerApi);
    const collaborator = await collaboratorApi.users.whoami();

    const { invitationId } = await ownerApi.lists.addCollaborator({
      listId: list.id,
      email: collaborator.email!,
      role: "viewer",
      recursive: false,
    });
    await db
      .update(listInvitations)
      .set({ invitedAt: new Date(Date.now() - 61_000) })
      .where(eq(listInvitations.id, invitationId));

    await ownerApi.lists.resendInvitation({ invitationId });
    await expect(
      ownerApi.lists.resendInvitation({ invitationId }),
    ).rejects.toThrow("Please wait before resending this invitation");
  });

  test<CustomTestContext>("updates pending role and recursive scope before acceptance", async ({
    apiCallers,
  }) => {
    const ownerApi = apiCallers[0];
    const collaboratorApi = apiCallers[1];
    const collaborator = await collaboratorApi.users.whoami();
    const parent = await createManualList(ownerApi, "Parent");
    const child = await ownerApi.lists.create({
      name: "Child",
      icon: "📄",
      type: "manual",
      parentId: parent.id,
    });

    const { invitationId } = await ownerApi.lists.addCollaborator({
      listId: parent.id,
      email: collaborator.email!,
      role: "viewer",
      recursive: false,
    });
    await ownerApi.lists.updateInvitation({
      invitationId,
      role: "editor",
      recursive: true,
    });

    const collaborators = await ownerApi.lists.getCollaborators({
      listId: parent.id,
    });
    const pending = collaborators.collaborators.find(
      (entry) => entry.id === invitationId,
    );
    expect(pending).toMatchObject({
      role: "editor",
      recursive: true,
      status: "pending",
    });

    await collaboratorApi.lists.acceptInvitation({ invitationId });
    expect(
      (await collaboratorApi.lists.get({ listId: child.id })).userRole,
    ).toBe("editor");
  });

  test<CustomTestContext>("reuses a declined invitation when the owner reinvites", async ({
    apiCallers,
  }) => {
    const ownerApi = apiCallers[0];
    const collaboratorApi = apiCallers[1];
    const collaborator = await collaboratorApi.users.whoami();
    const list = await createManualList(ownerApi);

    const first = await ownerApi.lists.addCollaborator({
      listId: list.id,
      email: collaborator.email!,
      role: "viewer",
      recursive: false,
    });
    await collaboratorApi.lists.declineInvitation({
      invitationId: first.invitationId,
    });

    const second = await ownerApi.lists.addCollaborator({
      listId: list.id,
      email: collaborator.email!,
      role: "editor",
      recursive: true,
    });
    expect(second.invitationId).toBe(first.invitationId);

    const [pending] = await collaboratorApi.lists.getPendingInvitations();
    expect(pending).toMatchObject({
      id: first.invitationId,
      role: "editor",
      recursive: true,
      expired: false,
    });
  });
});
