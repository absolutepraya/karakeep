from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if text.count(old) != 1:
        raise RuntimeError(f"Expected exactly one match in {path}, found {text.count(old)}")
    file.write_text(text.replace(old, new, 1))


# lists model: prevent cycles, bound traversal, and don't leak private ancestor metadata.
replace_once(
    "packages/trpc/models/lists.ts",
    '''    const resultIds: string[] = [];
    const queue: string[] = [this.list.id];
    while (queue.length > 0) {
      const id = queue.pop()!;
      const children = adjacencyList.get(id) ?? [];
      children.forEach((childId) => {
        queue.push(childId);
        resultIds.push(childId);
      });
    }
    return resultIds.map((id) => listById.get(id)!);''',
    '''    const resultIds: string[] = [];
    const queue: string[] = [this.list.id];
    const visited = new Set<string>([this.list.id]);
    while (queue.length > 0) {
      const id = queue.pop()!;
      const children = adjacencyList.get(id) ?? [];
      children.forEach((childId) => {
        if (visited.has(childId)) return;
        visited.add(childId);
        queue.push(childId);
        resultIds.push(childId);
      });
    }
    return resultIds.map((id) => listById.get(id)!);''',
)
replace_once(
    "packages/trpc/models/lists.ts",
    '''  ): Promise<void> {
    this.ensureCanManage();
    const result = await this.ctx.db
      .update(bookmarkLists)''',
    '''  ): Promise<void> {
    this.ensureCanManage();
    if (input.parentId !== undefined && input.parentId !== null) {
      if (input.parentId === this.list.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A list cannot be its own parent",
        });
      }
      const descendants = await this.getChildren();
      if (descendants.some((descendant) => descendant.id === input.parentId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A list cannot be moved inside one of its descendants",
        });
      }
    }
    const result = await this.ctx.db
      .update(bookmarkLists)''',
)
replace_once(
    "packages/trpc/models/lists.ts",
    '''      sourceListId: c.sourceListId,
      sourceListName: c.sourceListName,''',
    '''      sourceListId: isOwner ? c.sourceListId : undefined,
      sourceListName: isOwner ? c.sourceListName : null,''',
)

# Router: batch inherited grant resolution and reconcile offline access deltas.
replace_once(
    "packages/trpc/routers/lists.ts",
    '''  getEffectiveCollaboratorGrant,
  getEffectiveCollaboratorsForList,
} from "../models/listCollaborationAccess";''',
    '''  getEffectiveCollaboratorGrant,
  getEffectiveCollaboratorGrantsForOwner,
  getEffectiveCollaboratorsForList,
} from "../models/listCollaborationAccess";''',
)
replace_once(
    "packages/trpc/routers/lists.ts",
    '''async function inheritedListIdsFromGrant(
  ctx: AuthedContext,
  sourceListId: string,
  userId: string,
) {
  const source = await List.fromId(ctx, sourceListId);
  const descendants = await source.getChildren();
  const result = [sourceListId];
  for (const descendant of descendants) {
    const serialized = descendant.asZBookmarkList();
    const grant = await getEffectiveCollaboratorGrant(ctx, serialized, userId);
    if (grant?.sourceListId === sourceListId) {
      result.push(serialized.id);
    }
  }
  return result;
}''',
    '''async function inheritedListIdsFromGrant(
  ctx: AuthedContext,
  sourceListId: string,
  userId: string,
) {
  const source = await List.fromId(ctx, sourceListId);
  const ownerId = source.asZBookmarkList().userId;
  const grants = await getEffectiveCollaboratorGrantsForOwner(
    ctx,
    ownerId,
    userId,
  );
  return grants
    .filter(({ grant }) => grant.sourceListId === sourceListId)
    .map(({ list }) => list.id);
}

async function listAccessSnapshot(
  ctx: AuthedContext,
  listIds: string[],
  ownerId: string,
) {
  const result = new Map<string, Set<string>>();
  for (const listId of listIds) {
    result.set(listId, new Set(await listSyncUserIds(ctx, listId, ownerId)));
  }
  return result;
}

async function recordListAccessDiff(
  tx: KarakeepDBTransaction,
  listId: string,
  before: Set<string>,
  after: Set<string>,
  changedFields: string[],
  updateRetained: boolean,
) {
  const revoked = [...before].filter((userId) => !after.has(userId));
  const created = [...after].filter((userId) => !before.has(userId));
  const retained = updateRetained
    ? [...after].filter((userId) => before.has(userId))
    : [];
  if (revoked.length > 0) {
    await recordListSyncEvent(tx, revoked, listId, "revoke", []);
  }
  if (created.length > 0) {
    await recordListSyncEvent(tx, created, listId, "create", changedFields);
  }
  if (retained.length > 0) {
    await recordListSyncEvent(tx, retained, listId, "update", changedFields);
  }
}''',
)
replace_once(
    "packages/trpc/routers/lists.ts",
    '''        await recordListSyncEvent(tx, [ctx.user.id], list.id, "create", [
          "name",
          "description",
          "icon",
          "parentId",
          "query",
        ]);''',
    '''        const serialized = list.asZBookmarkList();
        await recordListSyncEvent(
          tx,
          await listSyncUserIds(
            transactionCtx,
            serialized.id,
            serialized.userId,
          ),
          serialized.id,
          "create",
          ["name", "description", "icon", "parentId", "query"],
        );''',
)
replace_once(
    "packages/trpc/routers/lists.ts",
    '''        const list = await List.fromId(transactionCtx, input.listId);
        await list.update(input);
        const serialized = list.asZBookmarkList();
        await recordListSyncEvent(
          tx,
          await listSyncUserIds(
            transactionCtx,
            serialized.id,
            serialized.userId,
          ),
          serialized.id,
          "update",
          [
            ...(input.name !== undefined ? ["name"] : []),
            ...(input.description !== undefined ? ["description"] : []),
            ...(input.icon !== undefined ? ["icon"] : []),
            ...(input.parentId !== undefined ? ["parentId"] : []),
            ...(input.query !== undefined ? ["query"] : []),
            ...(input.public !== undefined ? ["public"] : []),
          ],
        );
        return serialized;''',
    '''        const list = await List.fromId(transactionCtx, input.listId);
        const beforeSerialized = list.asZBookmarkList();
        const changedFields = [
          ...(input.name !== undefined ? ["name"] : []),
          ...(input.description !== undefined ? ["description"] : []),
          ...(input.icon !== undefined ? ["icon"] : []),
          ...(input.parentId !== undefined ? ["parentId"] : []),
          ...(input.query !== undefined ? ["query"] : []),
          ...(input.public !== undefined ? ["public"] : []),
        ];
        const affectedListIds =
          input.parentId !== undefined
            ? [
                beforeSerialized.id,
                ...(await list.getChildren()).map((child) => child.id),
              ]
            : [beforeSerialized.id];
        const beforeAccess = await listAccessSnapshot(
          transactionCtx,
          affectedListIds,
          beforeSerialized.userId,
        );

        await list.update(input);
        const serialized = list.asZBookmarkList();
        const afterAccess = await listAccessSnapshot(
          transactionCtx,
          affectedListIds,
          serialized.userId,
        );
        for (const listId of affectedListIds) {
          await recordListAccessDiff(
            tx,
            listId,
            beforeAccess.get(listId) ?? new Set(),
            afterAccess.get(listId) ?? new Set(),
            listId === serialized.id ? changedFields : [],
            listId === serialized.id,
          );
        }
        return serialized;''',
)
replace_once(
    "packages/trpc/routers/lists.ts",
    '''        const list = await List.fromId(transactionCtx, input.listId);
        await list.updateCollaborator(
          input.userId,
          input.role,
          input.recursive,
        );
        const serialized = list.asZBookmarkList();
        await recordListSyncEvent(
          tx,
          await listSyncUserIds(
            transactionCtx,
            serialized.id,
            serialized.userId,
          ),
          serialized.id,
          "update",
          ["collaborators"],
        );''',
    '''        const list = await List.fromId(transactionCtx, input.listId);
        const serialized = list.asZBookmarkList();
        const beforeListIds = await inheritedListIdsFromGrant(
          transactionCtx,
          serialized.id,
          input.userId,
        );
        await list.updateCollaborator(
          input.userId,
          input.role,
          input.recursive,
        );
        const afterListIds = await inheritedListIdsFromGrant(
          transactionCtx,
          serialized.id,
          input.userId,
        );
        const beforeSet = new Set(beforeListIds);
        const afterSet = new Set(afterListIds);
        await recordListSyncEvent(
          tx,
          [serialized.userId],
          serialized.id,
          "update",
          ["collaborators"],
        );
        for (const listId of beforeSet) {
          if (!afterSet.has(listId)) {
            await recordListSyncEvent(tx, [input.userId], listId, "revoke", []);
          }
        }
        for (const listId of afterSet) {
          await recordListSyncEvent(
            tx,
            [input.userId],
            listId,
            beforeSet.has(listId) ? "update" : "create",
            ["collaborators"],
          );
        }''',
)
replace_once(
    "packages/trpc/routers/lists.ts",
    '''        const list = await List.fromId(transactionCtx, input.listId);
        await list.updateCollaboratorRole(input.userId, input.role);
        const serialized = list.asZBookmarkList();
        await recordListSyncEvent(
          tx,
          await listSyncUserIds(
            transactionCtx,
            serialized.id,
            serialized.userId,
          ),
          serialized.id,
          "update",
          ["collaborators"],
        );''',
    '''        const list = await List.fromId(transactionCtx, input.listId);
        const serialized = list.asZBookmarkList();
        const affectedListIds = await inheritedListIdsFromGrant(
          transactionCtx,
          serialized.id,
          input.userId,
        );
        await list.updateCollaboratorRole(input.userId, input.role);
        await recordListSyncEvent(
          tx,
          [serialized.userId],
          serialized.id,
          "update",
          ["collaborators"],
        );
        for (const listId of affectedListIds) {
          await recordListSyncEvent(
            tx,
            [input.userId],
            listId,
            "update",
            ["collaborators"],
          );
        }''',
)
replace_once(
    "packages/trpc/routers/lists.ts",
    '''        await invitation.accept();
        if (invitationData) {
          await recordListSyncEvent(
            tx,
            [ctx.user.id, invitationData.listOwnerUserId],
            invitationData.listId,
            "create",
            ["collaborators"],
          );
        }''',
    '''        await invitation.accept();
        if (invitationData) {
          const createdListIds = await inheritedListIdsFromGrant(
            transactionCtx,
            invitationData.listId,
            ctx.user.id,
          );
          await recordListSyncEvent(
            tx,
            [invitationData.listOwnerUserId],
            invitationData.listId,
            "update",
            ["collaborators"],
          );
          for (const listId of createdListIds) {
            await recordListSyncEvent(
              tx,
              [ctx.user.id],
              listId,
              "create",
              ["collaborators"],
            );
          }
        }''',
)
replace_once(
    "packages/trpc/routers/lists.ts",
    '''    .output(z.object({ emailSent: z.boolean() }))
    .use(ensureInvitationAccess)''',
    '''    .output(z.object({ emailSent: z.boolean() }))
    .use(
      createRateLimitMiddleware({
        name: "lists.resendInvitation",
        windowMs: 15 * 60 * 1000,
        maxRequests: 5,
      }),
    )
    .use(ensureInvitationAccess)''',
)
replace_once(
    "packages/trpc/routers/lists.ts",
    '''        const list = await List.fromId(transactionCtx, input.listId);
        const serialized = list.asZBookmarkList();
        await list.leaveList();
        await recordListSyncEvent(
          tx,
          [ctx.user.id],
          serialized.id,
          "revoke",
          [],
        );''',
    '''        const list = await List.fromId(transactionCtx, input.listId);
        const serialized = list.asZBookmarkList();
        const grant = await getEffectiveCollaboratorGrant(
          transactionCtx,
          serialized,
          ctx.user.id,
        );
        if (!grant) {
          throw new Error("Expected an effective collaboration grant");
        }
        const source = await List.fromId(transactionCtx, grant.sourceListId);
        const sourceSerialized = source.asZBookmarkList();
        const revokedListIds = await inheritedListIdsFromGrant(
          transactionCtx,
          grant.sourceListId,
          ctx.user.id,
        );
        await list.leaveList();
        await recordListSyncEvent(
          tx,
          [sourceSerialized.userId],
          sourceSerialized.id,
          "update",
          ["collaborators"],
        );
        for (const listId of revokedListIds) {
          await recordListSyncEvent(
            tx,
            [ctx.user.id],
            listId,
            "revoke",
            [],
          );
        }''',
)
