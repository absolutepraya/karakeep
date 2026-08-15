import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray, or, sql } from "drizzle-orm";
import invariant from "tiny-invariant";
import { z } from "zod";

import { KarakeepDBTransaction, SqliteError } from "@karakeep/db";
import {
  bookmarkLists,
  bookmarks,
  bookmarksInLists,
  listCollaborators,
  ruleEngineRulesTable,
  users,
} from "@karakeep/db/schema";
import { parseSearchQuery } from "@karakeep/shared/searchQueryParser";
import { ZSortOrder } from "@karakeep/shared/types/bookmarks";
import {
  ZBookmarkList,
  zEditBookmarkListSchemaWithValidation,
  zNewBookmarkListSchema,
} from "@karakeep/shared/types/lists";
import { ZCursor } from "@karakeep/shared/types/pagination";
import { zRuleEngineRuleEventSchema } from "@karakeep/shared/types/rules";
import { switchCase } from "@karakeep/shared/utils/switch";

import { AuthedContext, Context } from "..";
import { buildImpersonatingAuthedContext } from "../lib/impersonate";
import { RuleEngine } from "../lib/ruleEngine";
import { getBookmarkIdsFromMatcher } from "../lib/search";
import { Bookmark } from "./bookmarks";
import {
  deleteCollaborationScope,
  getAllSharedListAccess,
  getDirectCollaborationScope,
  getEffectiveCollaboratorGrant,
  getEffectiveCollaboratorsForList,
  setCollaborationScope,
} from "./listCollaborationAccess";
import { ListInvitation } from "./listInvitations";

interface ListCollaboratorEntry {
  membershipId: string;
}

export abstract class List {
  protected constructor(
    protected ctx: AuthedContext,
    protected list: ZBookmarkList & { userId: string },
  ) {}

  get id() {
    return this.list.id;
  }

  asZBookmarkList() {
    if (this.list.userId === this.ctx.user.id) {
      return this.list;
    }

    // There's some privacy implications here, so we need to think twice
    // about the values that we return.
    return {
      id: this.list.id,
      name: this.list.name,
      description: this.list.description,
      userId: this.list.userId,
      icon: this.list.icon,
      type: this.list.type,
      query: this.list.query,
      userRole: this.list.userRole,
      hasCollaborators: this.list.hasCollaborators,

      // Hide parentId so an inherited share doesn't leak private hierarchy.
      parentId: null,
      // Hide whether the list is public or not.
      public: false,
    };
  }

  private static fromData(
    ctx: AuthedContext,
    data: ZBookmarkList & { userId: string },
    collaboratorEntry: ListCollaboratorEntry | null,
  ) {
    if (data.type === "smart") {
      return new SmartList(ctx, data);
    } else {
      return new ManualList(ctx, data, collaboratorEntry);
    }
  }

  static async fromId(
    ctx: AuthedContext,
    id: string,
  ): Promise<ManualList | SmartList> {
    // First try to find the list owned by the user.
    let list = await (async (): Promise<
      (ZBookmarkList & { userId: string }) | undefined
    > => {
      const l = await ctx.db.query.bookmarkLists.findFirst({
        columns: {
          rssToken: false,
        },
        where: and(
          eq(bookmarkLists.id, id),
          eq(bookmarkLists.userId, ctx.user.id),
        ),
        with: {
          collaborators: {
            columns: {
              id: true,
            },
            limit: 1,
          },
        },
      });
      return l
        ? {
            ...l,
            userRole: "owner",
            hasCollaborators: l.collaborators.length > 0,
          }
        : l;
    })();

    // Otherwise resolve an exact direct grant or the nearest recursive ancestor.
    let collaboratorEntry: ListCollaboratorEntry | null = null;
    if (!list) {
      const candidate = await ctx.db.query.bookmarkLists.findFirst({
        columns: {
          rssToken: false,
        },
        where: eq(bookmarkLists.id, id),
      });
      if (candidate) {
        const grant = await getEffectiveCollaboratorGrant(ctx, candidate);
        if (grant) {
          list = {
            ...candidate,
            userRole: grant.role,
            hasCollaborators: true,
          };
          collaboratorEntry = {
            // Contributions made through inherited editor access belong to the
            // granting direct membership. Removing that grant therefore cleans
            // those list-membership rows without deleting the bookmarks.
            membershipId: grant.membershipId,
          };
        }
      }
    }

    if (!list) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "List not found",
      });
    }
    if (list.type === "smart") {
      return new SmartList(ctx, list);
    } else {
      return new ManualList(ctx, list, collaboratorEntry);
    }
  }

  private static async getPublicList(
    ctx: Context,
    listId: string,
    token: string | null,
  ) {
    const listdb = await ctx.db.query.bookmarkLists.findFirst({
      where: and(
        eq(bookmarkLists.id, listId),
        or(
          eq(bookmarkLists.public, true),
          token !== null ? eq(bookmarkLists.rssToken, token) : undefined,
        ),
      ),
      with: {
        user: {
          columns: {
            name: true,
          },
        },
      },
    });
    if (!listdb) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "List not found",
      });
    }
    return listdb;
  }

  static async getPublicListMetadata(
    ctx: Context,
    listId: string,
    token: string | null,
  ) {
    const listdb = await this.getPublicList(ctx, listId, token);
    return {
      userId: listdb.userId,
      name: listdb.name,
      description: listdb.description,
      icon: listdb.icon,
      ownerName: listdb.user.name,
    };
  }

  static async getPublicListContents(
    ctx: Context,
    listId: string,
    token: string | null,
    pagination: {
      limit: number;
      order: Exclude<ZSortOrder, "relevance">;
      cursor: ZCursor | null | undefined;
    },
  ) {
    const listdb = await this.getPublicList(ctx, listId, token);

    // The token here acts as an authed context, so we can create
    // an impersonating context for the list owner as long as
    // we don't leak the context.
    const authedCtx = await buildImpersonatingAuthedContext(listdb.userId);
    const listObj = List.fromData(
      authedCtx,
      {
        ...listdb,
        userRole: "public",
        hasCollaborators: false, // Public lists don't expose collaborators
      },
      null,
    );
    const bookmarkIds = await listObj.getBookmarkIds();
    const list = listObj.asZBookmarkList();

    const bookmarks = await Bookmark.loadMulti(authedCtx, {
      ids: bookmarkIds,
      includeContent: false,
      limit: pagination.limit,
      sortOrder: pagination.order,
      cursor: pagination.cursor,
    });

    return {
      list: {
        icon: list.icon,
        name: list.name,
        description: list.description,
        ownerName: listdb.user.name,
        numItems: bookmarkIds.length,
      },
      bookmarks: bookmarks.bookmarks.map((b) => b.asPublicBookmark()),
      nextCursor: bookmarks.nextCursor,
    };
  }

  static async create(
    ctx: AuthedContext,
    input: z.infer<typeof zNewBookmarkListSchema>,
  ): Promise<ManualList | SmartList> {
    const [result] = await ctx.db
      .insert(bookmarkLists)
      .values({
        name: input.name,
        description: input.description,
        icon: input.icon,
        userId: ctx.user.id,
        parentId: input.parentId,
        type: input.type,
        query: input.query,
      })
      .returning();
    return this.fromData(
      ctx,
      {
        ...result,
        userRole: "owner",
        hasCollaborators: false, // Newly created lists have no collaborators
      },
      null,
    );
  }

  static async getAll(ctx: AuthedContext) {
    const [ownedLists, sharedLists] = await Promise.all([
      this.getAllOwned(ctx),
      this.getSharedWithUser(ctx),
    ]);
    return [...ownedLists, ...sharedLists];
  }

  static async getAllOwned(
    ctx: AuthedContext,
  ): Promise<(ManualList | SmartList)[]> {
    const lists = await ctx.db.query.bookmarkLists.findMany({
      columns: {
        rssToken: false,
      },
      where: and(eq(bookmarkLists.userId, ctx.user.id)),
      with: {
        collaborators: {
          columns: {
            id: true,
          },
          limit: 1,
        },
      },
    });
    return lists.map((l) =>
      this.fromData(
        ctx,
        {
          ...l,
          userRole: "owner",
          hasCollaborators: l.collaborators.length > 0,
        },
        null /* this is an owned list */,
      ),
    );
  }

  static async forBookmark(ctx: AuthedContext, bookmarkId: string) {
    const lists = await ctx.db.query.bookmarksInLists.findMany({
      where: eq(bookmarksInLists.bookmarkId, bookmarkId),
      with: {
        list: {
          columns: {
            rssToken: false,
          },
        },
      },
    });

    // For owner lists, check whether they have direct collaborators.
    const ownerListIds = lists
      .filter((l) => l.list.userId === ctx.user.id)
      .map((l) => l.list.id);

    const listsWithCollaborators = new Set<string>();
    if (ownerListIds.length > 0) {
      const collaborators = await ctx.db.query.listCollaborators.findMany({
        where: inArray(listCollaborators.listId, ownerListIds),
        columns: {
          listId: true,
        },
      });
      collaborators.forEach((c) => {
        listsWithCollaborators.add(c.listId);
      });
    }

    const resolved = await Promise.all(
      lists.map(async (l) => {
        if (l.list.userId === ctx.user.id) {
          return this.fromData(
            ctx,
            {
              ...l.list,
              userRole: "owner",
              hasCollaborators: listsWithCollaborators.has(l.list.id),
            },
            null,
          );
        }

        const grant = await getEffectiveCollaboratorGrant(ctx, l.list);
        if (!grant) {
          return null;
        }
        return this.fromData(
          ctx,
          {
            ...l.list,
            userRole: grant.role,
            hasCollaborators: true,
          },
          { membershipId: grant.membershipId },
        );
      }),
    );

    return resolved.filter(
      (list): list is ManualList | SmartList => list !== null,
    );
  }

  /**
   * Check if the user can view this list and its bookmarks.
   */
  canUserView(): boolean {
    return switchCase(this.list.userRole, {
      owner: true,
      editor: true,
      viewer: true,
      public: true,
    });
  }

  /**
   * Check if the user can edit this list (add/remove bookmarks).
   */
  canUserEdit(): boolean {
    return switchCase(this.list.userRole, {
      owner: true,
      editor: true,
      viewer: false,
      public: false,
    });
  }

  /**
   * Check if the user can manage this list (edit metadata, delete, manage collaborators).
   * Only the owner can manage the list.
   */
  canUserManage(): boolean {
    return switchCase(this.list.userRole, {
      owner: true,
      editor: false,
      viewer: false,
      public: false,
    });
  }

  /**
   * Ensure the user can view this list. Throws if they cannot.
   */
  ensureCanView(): void {
    if (!this.canUserView()) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "User is not allowed to view this list",
      });
    }
  }

  /**
   * Ensure the user can edit this list. Throws if they cannot.
   */
  ensureCanEdit(): void {
    if (!this.canUserEdit()) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "User is not allowed to edit this list",
      });
    }
  }

  /**
   * Ensure the user can manage this list. Throws if they cannot.
   */
  ensureCanManage(): void {
    if (!this.canUserManage()) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "User is not allowed to manage this list",
      });
    }
  }

  protected async cleanupRulesAfterListDeletion(tx: KarakeepDBTransaction) {
    const rules = await tx
      .select({
        id: ruleEngineRulesTable.id,
        event: ruleEngineRulesTable.event,
      })
      .from(ruleEngineRulesTable)
      .where(
        and(
          eq(ruleEngineRulesTable.userId, this.ctx.user.id),
          sql`json_valid(${ruleEngineRulesTable.event})`,
          sql`json_extract(${ruleEngineRulesTable.event}, '$.type') IN ('addedToList', 'removedFromList')`,
          sql`EXISTS (
            SELECT 1
            FROM json_each(json_extract(${ruleEngineRulesTable.event}, '$.listIds'))
            WHERE value = ${this.list.id}
          )`,
        ),
      );
    const rulesToDelete: string[] = [];
    const rulesToUpdate: { id: string; event: string }[] = [];

    for (const rule of rules) {
      let parsedEvent: unknown;
      try {
        parsedEvent = JSON.parse(rule.event);
      } catch {
        // Log and skip corrupted rule, continue with others
        console.error(`Failed to parse event JSON for rule ${rule.id}`);
        continue;
      }

      const ruleEvent = zRuleEngineRuleEventSchema.safeParse(parsedEvent);
      if (!ruleEvent.success) {
        // Log and skip invalid rule, continue with others
        console.error(`Failed to validate event schema for rule ${rule.id}`);
        continue;
      }
      const ruleEventData = ruleEvent.data;
      if (
        ruleEventData.type === "addedToList" ||
        ruleEventData.type === "removedFromList"
      ) {
        const filtered = ruleEventData.listIds.filter(
          (id: string) => id !== this.list.id,
        );
        if (filtered.length === 0) {
          rulesToDelete.push(rule.id);
        } else {
          const updatedEvent = {
            ...ruleEventData,
            listIds: filtered,
          };

          rulesToUpdate.push({
            id: rule.id,
            event: JSON.stringify(updatedEvent),
          });
        }
      }
    }

    if (rulesToDelete.length > 0) {
      await tx
        .delete(ruleEngineRulesTable)
        .where(inArray(ruleEngineRulesTable.id, rulesToDelete));
    }

    if (rulesToUpdate.length > 0) {
      await Promise.all(
        rulesToUpdate.map(({ id, event }) =>
          tx
            .update(ruleEngineRulesTable)
            .set({ event })
            .where(eq(ruleEngineRulesTable.id, id)),
        ),
      );
    }
  }

  async delete() {
    this.ensureCanManage();
    await this.ctx.db.transaction(async (tx) => {
      const res = await tx
        .delete(bookmarkLists)
        .where(
          and(
            eq(bookmarkLists.id, this.list.id),
            eq(bookmarkLists.userId, this.ctx.user.id),
          ),
        );
      if (res.changes == 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await this.cleanupRulesAfterListDeletion(tx);
    });
  }

  async getChildren(): Promise<(ManualList | SmartList)[]> {
    const lists = await List.getAllOwned(this.ctx);
    const listById = new Map(lists.map((l) => [l.id, l]));

    const adjecencyList = new Map<string, string[]>();

    // Initialize all lists with empty arrays first
    lists.forEach((l) => {
      adjecencyList.set(l.id, []);
    });

    // Then populate the parent-child relationships
    lists.forEach((l) => {
      const parentId = l.asZBookmarkList().parentId;
      if (parentId) {
        const currentChildren = adjecencyList.get(parentId) ?? [];
        currentChildren.push(l.id);
        adjecencyList.set(parentId, currentChildren);
      }
    });

    const resultIds: string[] = [];
    const queue: string[] = [this.list.id];

    while (queue.length > 0) {
      const id = queue.pop()!;
      const children = adjecencyList.get(id) ?? [];
      children.forEach((childId) => {
        queue.push(childId);
        resultIds.push(childId);
      });
    }

    return resultIds.map((id) => listById.get(id)!);
  }

  async update(
    input: z.infer<typeof zEditBookmarkListSchemaWithValidation>,
  ): Promise<void> {
    this.ensureCanManage();
    const result = await this.ctx.db
      .update(bookmarkLists)
      .set({
        name: input.name,
        description: input.description,
        icon: input.icon,
        parentId: input.parentId,
        query: input.query,
        public: input.public,
      })
      .where(
        and(
          eq(bookmarkLists.id, this.list.id),
          eq(bookmarkLists.userId, this.ctx.user.id),
        ),
      )
      .returning();
    if (result.length == 0) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    invariant(result[0].userId === this.ctx.user.id);
    // Fetch current collaborators to update hasCollaborators
    const collaboratorsCount =
      await this.ctx.db.query.listCollaborators.findMany({
        where: eq(listCollaborators.listId, this.list.id),
        columns: {
          id: true,
        },
        limit: 1,
      });
    this.list = {
      ...result[0],
      userRole: "owner",
      hasCollaborators: collaboratorsCount.length > 0,
    };
  }

  private async setRssToken(token: string | null) {
    const result = await this.ctx.db
      .update(bookmarkLists)
      .set({ rssToken: token })
      .where(
        and(
          eq(bookmarkLists.id, this.list.id),
          eq(bookmarkLists.userId, this.ctx.user.id),
        ),
      )
      .returning();
    if (result.length == 0) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    return result[0].rssToken;
  }

  async getRssToken(): Promise<string | null> {
    this.ensureCanManage();
    const [result] = await this.ctx.db
      .select({ rssToken: bookmarkLists.rssToken })
      .from(bookmarkLists)
      .where(
        and(
          eq(bookmarkLists.id, this.list.id),
          eq(bookmarkLists.userId, this.ctx.user.id),
        ),
      )
      .limit(1);
    return result.rssToken ?? null;
  }

  async regenRssToken() {
    this.ensureCanManage();
    return await this.setRssToken(crypto.randomBytes(32).toString("hex"));
  }

  async clearRssToken() {
    this.ensureCanManage();
    await this.setRssToken(null);
  }

  /**
   * Add a collaborator to this list by email.
   * Creates a pending invitation that must be accepted by the user.
   * Returns the invitation ID.
   */
  async addCollaboratorByEmail(
    email: string,
    role: "viewer" | "editor",
    recursive = false,
  ): Promise<string> {
    this.ensureCanManage();

    return await ListInvitation.inviteByEmail(this.ctx, {
      email,
      role,
      recursive,
      listId: this.list.id,
      listName: this.list.name,
      listType: this.list.type,
      listOwnerId: this.list.userId,
      inviterUserId: this.ctx.user.id,
      inviterName: this.ctx.user.name ?? null,
    });
  }

  /**
   * Remove a direct collaborator grant from this list.
   * Contributions tied to that direct membership are removed by the existing
   * bookmarksInLists foreign key; underlying bookmarks remain untouched.
   */
  async removeCollaborator(userId: string): Promise<void> {
    this.ensureCanManage();

    const result = await this.ctx.db
      .delete(listCollaborators)
      .where(
        and(
          eq(listCollaborators.listId, this.list.id),
          eq(listCollaborators.userId, userId),
        ),
      );

    if (result.changes === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Collaborator not found",
      });
    }
    await deleteCollaborationScope(this.ctx, {
      listId: this.list.id,
      userId,
    });
  }

  /**
   * Leave the direct grant that provides access. For inherited access this
   * means leaving the granting recursive share, not creating a child-only
   * denial override.
   */
  async leaveList(): Promise<void> {
    if (this.list.userRole === "owner") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "List owners cannot leave their own list. Delete the list instead.",
      });
    }
    if (!this.collaboratorEntry) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Collaborator not found",
      });
    }

    const membership = await this.ctx.db.query.listCollaborators.findFirst({
      where: and(
        eq(listCollaborators.id, this.collaboratorEntry.membershipId),
        eq(listCollaborators.userId, this.ctx.user.id),
      ),
    });
    if (!membership) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Collaborator not found",
      });
    }

    const result = await this.ctx.db
      .delete(listCollaborators)
      .where(eq(listCollaborators.id, membership.id));
    if (result.changes === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Collaborator not found",
      });
    }
    await deleteCollaborationScope(this.ctx, {
      listId: membership.listId,
      userId: this.ctx.user.id,
    });
  }

  async updateCollaborator(
    userId: string,
    role: "viewer" | "editor",
    recursive: boolean,
  ): Promise<void> {
    this.ensureCanManage();

    const result = await this.ctx.db
      .update(listCollaborators)
      .set({ role })
      .where(
        and(
          eq(listCollaborators.listId, this.list.id),
          eq(listCollaborators.userId, userId),
        ),
      );

    if (result.changes === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Collaborator not found",
      });
    }
    await setCollaborationScope(this.ctx, {
      listId: this.list.id,
      userId,
      recursive,
    });
  }

  /**
   * Backwards-compatible role-only update. Preserve the existing direct scope.
   */
  async updateCollaboratorRole(
    userId: string,
    role: "viewer" | "editor",
  ): Promise<void> {
    const recursive = await getDirectCollaborationScope(this.ctx, {
      listId: this.list.id,
      userId,
    });
    await this.updateCollaborator(userId, role, recursive);
  }

  /**
   * Get effective accepted collaborators plus this list's pending invitations.
   * Accepted inherited grants are annotated with their source list.
   */
  async getCollaborators() {
    this.ensureCanView();

    const isOwner = this.list.userId === this.ctx.user.id;

    const [collaborators, invitations] = await Promise.all([
      getEffectiveCollaboratorsForList(this.ctx, this.list),
      isOwner
        ? ListInvitation.invitationsForList(this.ctx, {
            listId: this.list.id,
          })
        : [],
    ]);

    const owner = await this.ctx.db.query.users.findFirst({
      where: eq(users.id, this.list.userId),
      columns: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    const collaboratorEntries = collaborators.map((c) => {
      return {
        id: c.id,
        userId: c.userId,
        role: c.role,
        recursive: c.recursive,
        inherited: c.inherited,
        sourceListId: c.sourceListId,
        sourceListName: c.sourceListName,
        status: "accepted" as const,
        addedAt: c.addedAt,
        invitedAt: c.addedAt,
        user: {
          id: c.user.id,
          name: c.user.name,
          // Only show email to the owner for privacy
          email: isOwner ? c.user.email : null,
          image: c.user.image,
        },
      };
    });

    return {
      collaborators: [...collaboratorEntries, ...invitations],
      owner: owner
        ? {
            id: owner.id,
            name: owner.name,
            // Only show owner email to the owner for privacy
            email: isOwner ? owner.email : null,
            image: owner.image,
          }
        : null,
    };
  }

  /**
   * Get all direct and inherited manual lists shared with the user.
   */
  static async getSharedWithUser(
    ctx: AuthedContext,
  ): Promise<(ManualList | SmartList)[]> {
    const collaborations = await getAllSharedListAccess(ctx);

    return collaborations.map(({ list, grant }) =>
      this.fromData(
        ctx,
        {
          ...list,
          userRole: grant.role,
          hasCollaborators: true,
        },
        {
          membershipId: grant.membershipId,
        },
      ),
    );
  }

  abstract get type(): "manual" | "smart";
  abstract getBookmarkIds(visitedListIds?: Set<string>): Promise<string[]>;
  abstract getSize(): Promise<number>;
  abstract addBookmark(bookmarkId: string): Promise<void>;
  abstract removeBookmark(bookmarkId: string): Promise<void>;
  abstract mergeInto(
    targetList: List,
    deleteSourceAfterMerge: boolean,
  ): Promise<void>;
}

export class SmartList extends List {
  private static readonly MAX_VISITED_LISTS = 30;

  parsedQuery: ReturnType<typeof parseSearchQuery> | null = null;

  constructor(ctx: AuthedContext, list: ZBookmarkList & { userId: string }) {
    super(ctx, list);
  }

  get type(): "smart" {
    invariant(this.list.type === "smart");
    return this.list.type;
  }

  get query() {
    invariant(this.list.query);
    return this.list.query;
  }

  getParsedQuery() {
    if (!this.parsedQuery) {
      const result = parseSearchQuery(this.query);
      if (result.result !== "full") {
        throw new Error("Invalid smart list query");
      }
      this.parsedQuery = result;
    }
    return this.parsedQuery;
  }

  async getBookmarkIds(visitedListIds = new Set<string>()): Promise<string[]> {
    if (visitedListIds.size >= SmartList.MAX_VISITED_LISTS) {
      return [];
    }

    if (visitedListIds.has(this.list.id)) {
      return [];
    }

    const newVisitedListIds = new Set(visitedListIds);
    newVisitedListIds.add(this.list.id);

    const parsedQuery = this.getParsedQuery();
    if (!parsedQuery.matcher) {
      return [];
    }
    return await getBookmarkIdsFromMatcher(
      this.ctx,
      parsedQuery.matcher,
      newVisitedListIds,
    );
  }

  async getSize(): Promise<number> {
    return await this.getBookmarkIds().then((ids) => ids.length);
  }

  addBookmark(_bookmarkId: string): Promise<void> {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Smart lists cannot be added to",
    });
  }

  removeBookmark(_bookmarkId: string): Promise<void> {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Smart lists cannot be removed from",
    });
  }

  mergeInto(
    _targetList: List,
    _deleteSourceAfterMerge: boolean,
  ): Promise<void> {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Smart lists cannot be merged",
    });
  }
}

export class ManualList extends List {
  constructor(
    ctx: AuthedContext,
    list: ZBookmarkList & { userId: string },
    private collaboratorEntry: ListCollaboratorEntry | null,
  ) {
    super(ctx, list);
  }

  get type(): "manual" {
    invariant(this.list.type === "manual");
    return this.list.type;
  }

  async getBookmarkIds(_visitedListIds?: Set<string>): Promise<string[]> {
    const results = await this.ctx.db
      .select({ id: bookmarksInLists.bookmarkId })
      .from(bookmarksInLists)
      .where(eq(bookmarksInLists.listId, this.list.id));
    return results.map((r) => r.id);
  }

  async getSize(): Promise<number> {
    const results = await this.ctx.db
      .select({ count: count() })
      .from(bookmarksInLists)
      .where(eq(bookmarksInLists.listId, this.list.id));
    return results[0].count;
  }

  async addBookmark(bookmarkId: string): Promise<void> {
    this.ensureCanEdit();

    try {
      await this.ctx.db.insert(bookmarksInLists).values({
        listId: this.list.id,
        bookmarkId,
        listMembershipId: this.collaboratorEntry?.membershipId,
      });
      const bookmark = await this.ctx.db.query.bookmarks.findFirst({
        where: eq(bookmarks.id, bookmarkId),
        columns: { userId: true },
      });
      if (bookmark) {
        await RuleEngine.triggerOnEvent(
          bookmark.userId,
          bookmarkId,
          [
            {
              type: "addedToList",
              listId: this.list.id,
            },
          ],
          undefined,
          this.ctx.db,
        );
      }
    } catch (e) {
      if (e instanceof SqliteError) {
        if (e.code == "SQLITE_CONSTRAINT_PRIMARYKEY") {
          // this is fine, it just means the bookmark is already in the list
          return;
        }
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong",
      });
    }
  }

  async removeBookmark(bookmarkId: string): Promise<void> {
    // Check that the user can edit this list
    this.ensureCanEdit();

    const deleted = await this.ctx.db
      .delete(bookmarksInLists)
      .where(
        and(
          eq(bookmarksInLists.listId, this.list.id),
          eq(bookmarksInLists.bookmarkId, bookmarkId),
        ),
      );
    if (deleted.changes == 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Bookmark ${bookmarkId} is already not in list ${this.list.id}`,
      });
    }
    const bookmark = await this.ctx.db.query.bookmarks.findFirst({
      where: eq(bookmarks.id, bookmarkId),
      columns: { userId: true },
    });
    if (bookmark) {
      await RuleEngine.triggerOnEvent(
        bookmark.userId,
        bookmarkId,
        [
          {
            type: "removedFromList",
            listId: this.list.id,
          },
        ],
        undefined,
        this.ctx.db,
      );
    }
  }

  async update(input: z.infer<typeof zEditBookmarkListSchemaWithValidation>) {
    if (input.query) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Manual lists cannot have a query",
      });
    }
    return super.update(input);
  }

  async mergeInto(
    targetList: List,
    deleteSourceAfterMerge: boolean,
  ): Promise<void> {
    this.ensureCanManage();
    targetList.ensureCanManage();
    if (targetList.type !== "manual") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You can only merge into a manual list",
      });
    }

    const bookmarkIds = await this.getBookmarkIds();

    await this.ctx.db.transaction(async (tx) => {
      await tx
        .insert(bookmarksInLists)
        .values(
          bookmarkIds.map((id) => ({
            bookmarkId: id,
            listId: targetList.id,
          })),
        )
        .onConflictDoNothing();

      if (deleteSourceAfterMerge) {
        await tx
          .delete(bookmarkLists)
          .where(eq(bookmarkLists.id, this.list.id));
        await this.cleanupRulesAfterListDeletion(tx);
      }
    });
  }
}
