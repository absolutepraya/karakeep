import { beforeEach, describe, expect, test } from "vitest";

import type { APICallerType, CustomTestContext } from "../testUtils";
import { defaultBeforeEach } from "../testUtils";

beforeEach<CustomTestContext>(defaultBeforeEach(true));

async function inviteAndAccept(
  ownerApi: APICallerType,
  collaboratorApi: APICallerType,
  listId: string,
  recursive: boolean,
) {
  const collaborator = await collaboratorApi.users.whoami();
  const { invitationId } = await ownerApi.lists.addCollaborator({
    listId,
    email: collaborator.email!,
    role: "viewer",
    recursive,
  });
  await collaboratorApi.lists.acceptInvitation({ invitationId });
}

describe("shared-list visible hierarchy", () => {
  test<CustomTestContext>("preserves an accessible parent in the shared tree", async ({
    apiCallers,
  }) => {
    const ownerApi = apiCallers[0];
    const collaboratorApi = apiCallers[1];

    const parent = await ownerApi.lists.create({
      name: "Projects",
      icon: "📁",
      type: "manual",
    });
    const child = await ownerApi.lists.create({
      name: "University",
      icon: "🎓",
      type: "manual",
      parentId: parent.id,
    });

    await inviteAndAccept(ownerApi, collaboratorApi, parent.id, true);

    const { lists } = await collaboratorApi.lists.list();
    expect(lists.find((list) => list.id === child.id)?.parentId).toBe(parent.id);
  });

  test<CustomTestContext>("hides an inaccessible parent and promotes the shared child to a root", async ({
    apiCallers,
  }) => {
    const ownerApi = apiCallers[0];
    const collaboratorApi = apiCallers[1];

    const parent = await ownerApi.lists.create({
      name: "Private parent",
      icon: "🔒",
      type: "manual",
    });
    const child = await ownerApi.lists.create({
      name: "Shared child",
      icon: "📄",
      type: "manual",
      parentId: parent.id,
    });

    await inviteAndAccept(ownerApi, collaboratorApi, child.id, false);

    const { lists } = await collaboratorApi.lists.list();
    expect(lists.some((list) => list.id === parent.id)).toBe(false);
    expect(lists.find((list) => list.id === child.id)?.parentId).toBeNull();
  });

  test<CustomTestContext>("promotes an explicit child to a root when inherited parent access is removed", async ({
    apiCallers,
  }) => {
    const ownerApi = apiCallers[0];
    const collaboratorApi = apiCallers[1];
    const collaborator = await collaboratorApi.users.whoami();

    const parent = await ownerApi.lists.create({
      name: "Projects",
      icon: "📁",
      type: "manual",
    });
    const child = await ownerApi.lists.create({
      name: "DAA",
      icon: "📚",
      type: "manual",
      parentId: parent.id,
    });

    await inviteAndAccept(ownerApi, collaboratorApi, parent.id, true);
    await inviteAndAccept(ownerApi, collaboratorApi, child.id, false);

    await ownerApi.lists.removeCollaborator({
      listId: parent.id,
      userId: collaborator.id,
    });

    const { lists } = await collaboratorApi.lists.list();
    expect(lists.some((list) => list.id === parent.id)).toBe(false);
    expect(lists.find((list) => list.id === child.id)?.parentId).toBeNull();
  });
});
