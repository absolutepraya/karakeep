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

type OwnerList = typeof bookmarkLists.$inferSelect;
type DirectMembership = typeof listCollaborators.$inferSelect;

interface OwnerAccessGraph {
  lists: OwnerList[];
  listById: Map<string, OwnerList>;
  membershipByList: Map<string, DirectMembership>;
  scopeByList: Map<string, boolean>;
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

async function loadOwnerAccessGraph(
  ctx: AuthedContext,
  ownerId: string,
  userId: string,
): Promise<OwnerAccessGraph> {
  const lists = await ctx.db.query.bookmarkLists.findMany({
    columns: { rssToken: false },
    where: eq(bookmarkLists.userId, ownerId),
  });
  if (lists.length === 0) {
    return {
      lists: [],
      listById: new Map(),
      membershipByList: new Map(),
      scopeByList: new Map(),
    };
  }

  const listIds = lists.map((list) => list.id);
  const [memberships, scopes] = await Promise.all([
    ctx.db.query.listCollaborators.findMany({
      where: and(
        eq(listCollaborators.userId, userId),
        inArray(listCollaborators.listId, listIds),
      ),
    }),
    ctx.db.query.listCollaborationScopes.findMany({
      where: and(
        eq(listCollaborationScopes.userId, userId),
        inArray(listCollaborationScopes.listId, listIds),
      ),
    }),
  ]);

  return {
    lists,
    listById: new Map(lists.map((list) => [list.id, list])),
    membershipByList: new Map(
      memberships.map((membership) => [membership.listId, membership]),
    ),
    scopeByList: new Map(
      scopes.map((scope) => [scope.listId, scope.recursive]),
    ),
  };
}

function resolveGrantFromGraph(
  list: AccessibleListData,
  userId: string,
  graph: OwnerAccessGraph,
): EffectiveCollaboratorGrant | null {
  if (list.type !== "manual") {
    return null;
  }

  const direct = graph.membershipByList.get(list.id);
  if (direct) {
    return {
      membershipId: direct.id,
      userId,
      role: direct.role,
      recursive: graph.scopeByList.get(list.id) ?? false,
      inherited: false,
      sourceListId: list.id,
      sourceListName: list.name,
    };
  }

  let parentId = list.parentId;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const ancestor = graph.listById.get(parentId);
    if (!ancestor || ancestor.userId !== list.userId) {
      break;
    }
    const membership = graph.membershipByList.get(ancestor.id);
    if (
      membership &&
      ancestor.type === "manual" &&
      graph.scopeByList.get(ancestor.id)
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
  const graph = await loadOwnerAccessGraph(ctx, list.userId, userId);
  return resolveGrantFromGraph(list, userId, graph);
}

export async function getEffectiveCollaboratorGrantsForOwner(
  ctx: AuthedContext,
  ownerId: string,
  userId: string,
) {
  const graph = await loadOwnerAccessGraph(ctx, ownerId, userId);
  return graph.lists.flatMap((list) => {
    const grant = resolveGrantFromGraph(list, userId, graph);
    return grant ? [{ list, grant }] : [];
  });
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

  const ownerLists = await ctx.db.query.bookmarkLists.findMany({
    columns: {
      id: true,
      name: true,
      userId: true,
      parentId: true,
      type: true,
    },
    where: eq(bookmarkLists.userId, list.userId),
  });
  const listById = new Map(ownerLists.map((entry) => [entry.id, entry]));
  const ancestry: AccessibleListData[] = [list];
  let parentId = list.parentId;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const ancestor = listById.get(parentId);
    if (!ancestor) {
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
