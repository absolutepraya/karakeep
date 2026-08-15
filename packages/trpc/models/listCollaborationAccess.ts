import { and, eq, inArray } from "drizzle-orm";

import { listCollaborationScopes } from "@karakeep/db";
import { bookmarkLists, listCollaborators } from "@karakeep/db/schema";

import type { AuthedContext } from "..";

export type CollaborationRole = "viewer" | "editor";

export interface EffectiveCollaboratorGrant {
  membershipId: string;
  userId: string;
  role: CollaborationRole;
  recursive: boolean;
  inherited: boolean;
  sourceListId: string;
  sourceListName: string;
}

interface AccessibleListData {
  id: string;
  name: string;
  userId: string;
  parentId: string | null;
  type: "manual" | "smart";
}

async function getScope(
  ctx: AuthedContext,
  listId: string,
  userId: string,
): Promise<boolean> {
  const scope = await ctx.db.query.listCollaborationScopes.findFirst({
    where: and(
      eq(listCollaborationScopes.listId, listId),
      eq(listCollaborationScopes.userId, userId),
    ),
  });
  return scope?.recursive ?? false;
}

export async function setCollaborationScope(
  ctx: AuthedContext,
  input: { listId: string; userId: string; recursive: boolean },
) {
  await ctx.db
    .insert(listCollaborationScopes)
    .values(input)
    .onConflictDoUpdate({
      target: [listCollaborationScopes.listId, listCollaborationScopes.userId],
      set: { recursive: input.recursive },
    });
}

export async function deleteCollaborationScope(
  ctx: AuthedContext,
  input: { listId: string; userId: string },
) {
  await ctx.db
    .delete(listCollaborationScopes)
    .where(
      and(
        eq(listCollaborationScopes.listId, input.listId),
        eq(listCollaborationScopes.userId, input.userId),
      ),
    );
}

export async function getDirectCollaborationScope(
  ctx: AuthedContext,
  input: { listId: string; userId: string },
) {
  return getScope(ctx, input.listId, input.userId);
}

export async function getEffectiveCollaboratorGrant(
  ctx: AuthedContext,
  list: AccessibleListData,
  userId = ctx.user.id,
): Promise<EffectiveCollaboratorGrant | null> {
  if (list.type !== "manual") {
    return null;
  }

  const direct = await ctx.db.query.listCollaborators.findFirst({
    where: and(
      eq(listCollaborators.listId, list.id),
      eq(listCollaborators.userId, userId),
    ),
  });
  if (direct) {
    return {
      membershipId: direct.id,
      userId,
      role: direct.role,
      recursive: await getScope(ctx, list.id, userId),
      inherited: false,
      sourceListId: list.id,
      sourceListName: list.name,
    };
  }

  let parentId = list.parentId;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const ancestor = await ctx.db.query.bookmarkLists.findFirst({
      columns: {
        id: true,
        name: true,
        userId: true,
        parentId: true,
        type: true,
      },
      where: eq(bookmarkLists.id, parentId),
    });
    if (!ancestor || ancestor.userId !== list.userId) {
      break;
    }

    const membership = await ctx.db.query.listCollaborators.findFirst({
      where: and(
        eq(listCollaborators.listId, ancestor.id),
        eq(listCollaborators.userId, userId),
      ),
    });
    if (
      membership &&
      ancestor.type === "manual" &&
      (await getScope(ctx, ancestor.id, userId))
    ) {
      return {
        membershipId: membership.id,
        userId,
        role: membership.role,
        recursive: true,
        inherited: true,
        sourceListId: ancestor.id,
        sourceListName: ancestor.name,
      };
    }
    parentId = ancestor.parentId;
  }

  return null;
}

export async function getAllSharedListAccess(ctx: AuthedContext) {
  const directMemberships = await ctx.db.query.listCollaborators.findMany({
    where: eq(listCollaborators.userId, ctx.user.id),
    with: {
      list: {
        columns: {
          rssToken: false,
        },
      },
    },
  });
  if (directMemberships.length === 0) {
    return [];
  }

  const ownerIds = [...new Set(directMemberships.map((m) => m.list.userId))];
  const allOwnerLists = await ctx.db.query.bookmarkLists.findMany({
    columns: {
      rssToken: false,
    },
    where: inArray(bookmarkLists.userId, ownerIds),
  });
  const scopes = await ctx.db.query.listCollaborationScopes.findMany({
    where: eq(listCollaborationScopes.userId, ctx.user.id),
  });

  const membershipByList = new Map(
    directMemberships.map((membership) => [membership.listId, membership]),
  );
  const scopeByList = new Map(scopes.map((scope) => [scope.listId, scope]));
  const listById = new Map(allOwnerLists.map((list) => [list.id, list]));
  const result: {
    list: (typeof allOwnerLists)[number];
    grant: EffectiveCollaboratorGrant;
  }[] = [];

  for (const list of allOwnerLists) {
    if (list.type !== "manual") {
      continue;
    }

    const direct = membershipByList.get(list.id);
    if (direct) {
      result.push({
        list,
        grant: {
          membershipId: direct.id,
          userId: ctx.user.id,
          role: direct.role,
          recursive: scopeByList.get(list.id)?.recursive ?? false,
          inherited: false,
          sourceListId: list.id,
          sourceListName: list.name,
        },
      });
      continue;
    }

    let parentId = list.parentId;
    const visited = new Set<string>();
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const ancestor = listById.get(parentId);
      if (!ancestor || ancestor.userId !== list.userId) {
        break;
      }
      const ancestorMembership = membershipByList.get(ancestor.id);
      if (
        ancestorMembership &&
        ancestor.type === "manual" &&
        scopeByList.get(ancestor.id)?.recursive
      ) {
        result.push({
          list,
          grant: {
            membershipId: ancestorMembership.id,
            userId: ctx.user.id,
            role: ancestorMembership.role,
            recursive: true,
            inherited: true,
            sourceListId: ancestor.id,
            sourceListName: ancestor.name,
          },
        });
        break;
      }
      parentId = ancestor.parentId;
    }
  }

  return result;
}

export async function getEffectiveCollaboratorsForList(
  ctx: AuthedContext,
  list: AccessibleListData,
) {
  if (list.type !== "manual") {
    return [];
  }

  const ancestry = [list];
  let parentId = list.parentId;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const ancestor = await ctx.db.query.bookmarkLists.findFirst({
      columns: {
        id: true,
        name: true,
        userId: true,
        parentId: true,
        type: true,
      },
      where: eq(bookmarkLists.id, parentId),
    });
    if (!ancestor || ancestor.userId !== list.userId) {
      break;
    }
    ancestry.push(ancestor);
    parentId = ancestor.parentId;
  }

  const ancestryIds = ancestry.map((entry) => entry.id);
  const memberships = await ctx.db.query.listCollaborators.findMany({
    where: inArray(listCollaborators.listId, ancestryIds),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });
  if (memberships.length === 0) {
    return [];
  }

  const userIds = [
    ...new Set(memberships.map((membership) => membership.userId)),
  ];
  const scopes = await ctx.db.query.listCollaborationScopes.findMany({
    where: and(
      inArray(listCollaborationScopes.listId, ancestryIds),
      inArray(listCollaborationScopes.userId, userIds),
    ),
  });
  const scopeByKey = new Map(
    scopes.map((scope) => [`${scope.listId}:${scope.userId}`, scope.recursive]),
  );
  const membershipsByList = new Map<string, typeof memberships>();
  for (const membership of memberships) {
    const entries = membershipsByList.get(membership.listId) ?? [];
    entries.push(membership);
    membershipsByList.set(membership.listId, entries);
  }

  const resolved = new Map<
    string,
    (typeof memberships)[number] & {
      recursive: boolean;
      inherited: boolean;
      sourceListId: string;
      sourceListName: string;
    }
  >();
  for (const [depth, ancestor] of ancestry.entries()) {
    for (const membership of membershipsByList.get(ancestor.id) ?? []) {
      if (resolved.has(membership.userId)) {
        continue;
      }
      const recursive =
        scopeByKey.get(`${ancestor.id}:${membership.userId}`) ?? false;
      if (depth === 0 || recursive) {
        resolved.set(membership.userId, {
          ...membership,
          recursive,
          inherited: depth > 0,
          sourceListId: ancestor.id,
          sourceListName: ancestor.name,
        });
      }
    }
  }

  return [...resolved.values()];
}
