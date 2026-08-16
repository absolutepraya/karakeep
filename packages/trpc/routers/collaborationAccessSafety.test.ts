import { beforeEach, describe, expect, test } from "vitest";

import type { CustomTestContext } from "../testUtils";
import { defaultBeforeEach } from "../testUtils";

beforeEach<CustomTestContext>(defaultBeforeEach(true));

describe("collaboration access safety", () => {
  test<CustomTestContext>("rejects moving a list inside one of its descendants", async ({
    apiCallers,
  }) => {
    const owner = apiCallers[0];
    const parent = await owner.lists.create({
      name: "Parent",
      icon: "folder",
      type: "manual",
    });
    const child = await owner.lists.create({
      name: "Child",
      icon: "folder",
      type: "manual",
      parentId: parent.id,
    });

    await expect(
      owner.lists.edit({ listId: parent.id, parentId: child.id }),
    ).rejects.toThrow("A list cannot be moved inside one of its descendants");
  });

  test<CustomTestContext>("hides private recursive source metadata from collaborators", async ({
    apiCallers,
  }) => {
    const owner = apiCallers[0];
    const collaborator = apiCallers[1];
    const collaboratorUser = await collaborator.users.whoami();
    const parent = await owner.lists.create({
      name: "Private parent",
      icon: "folder",
      type: "manual",
    });
    const child = await owner.lists.create({
      name: "Shared child",
      icon: "folder",
      type: "manual",
      parentId: parent.id,
    });
    const { invitationId } = await owner.lists.addCollaborator({
      listId: parent.id,
      email: collaboratorUser.email!,
      role: "viewer",
      recursive: true,
    });
    await collaborator.lists.acceptInvitation({ invitationId });

    const collaboratorView = await collaborator.lists.getCollaborators({
      listId: child.id,
    });
    const inherited = collaboratorView.collaborators.find(
      (entry) => entry.userId === collaboratorUser.id,
    );
    expect(inherited).toMatchObject({ inherited: true });
    expect(inherited?.sourceListId).toBeUndefined();
    expect(inherited?.sourceListName).toBeNull();

    const ownerView = await owner.lists.getCollaborators({ listId: child.id });
    const ownerInherited = ownerView.collaborators.find(
      (entry) => entry.userId === collaboratorUser.id,
    );
    expect(ownerInherited).toMatchObject({
      inherited: true,
      sourceListId: parent.id,
      sourceListName: "Private parent",
    });
  });
});
