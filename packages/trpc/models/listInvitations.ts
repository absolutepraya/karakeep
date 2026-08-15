import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";

import type { KarakeepDBTransaction } from "@karakeep/db";
import { listCollaborators, listInvitations, users } from "@karakeep/db/schema";

import type { AuthedContext } from "..";
import {
  deleteCollaborationScope,
  getDirectCollaborationScope,
  setCollaborationScope,
} from "./listCollaborationAccess";

type Role = "viewer" | "editor";
type InvitationStatus = "pending" | "declined";

function asTransactionContext(
  ctx: AuthedContext,
  db: KarakeepDBTransaction,
): AuthedContext {
  return { ...ctx, db } as unknown as AuthedContext;
}

export const LIST_INVITATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const LIST_INVITATION_RESEND_COOLDOWN_MS = 60 * 1000;

interface InvitationData {
  id: string;
  listId: string;
  listName: string;
  userId: string;
  role: Role;
  recursive: boolean;
  status: InvitationStatus;
  invitedAt: Date;
  invitedEmail: string | null;
  invitedBy: string | null;
  listOwnerUserId: string;
}

function invitationExpiresAt(invitedAt: Date) {
  return new Date(invitedAt.getTime() + LIST_INVITATION_TTL_MS);
}

function invitationIsExpired(invitedAt: Date) {
  return invitationExpiresAt(invitedAt).getTime() <= Date.now();
}

export class ListInvitation {
  protected constructor(
    protected ctx: AuthedContext,
    protected invitation: InvitationData,
  ) {}

  get id() {
    return this.invitation.id;
  }

  get recursive() {
    return this.invitation.recursive;
  }

  get expiresAt() {
    return invitationExpiresAt(this.invitation.invitedAt);
  }

  get expired() {
    return invitationIsExpired(this.invitation.invitedAt);
  }

  static async fromId(
    ctx: AuthedContext,
    invitationId: string,
  ): Promise<ListInvitation> {
    const invitation = await ctx.db.query.listInvitations.findFirst({
      where: eq(listInvitations.id, invitationId),
      with: {
        list: {
          columns: {
            userId: true,
            name: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Invitation not found",
      });
    }

    const isInvitedUser = invitation.userId === ctx.user.id;
    const isListOwner = invitation.list.userId === ctx.user.id;
    if (!isInvitedUser && !isListOwner) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Invitation not found",
      });
    }

    return new ListInvitation(ctx, {
      id: invitation.id,
      listId: invitation.listId,
      listName: invitation.list.name,
      userId: invitation.userId,
      role: invitation.role,
      recursive: await getDirectCollaborationScope(ctx, {
        listId: invitation.listId,
        userId: invitation.userId,
      }),
      status: invitation.status,
      invitedAt: invitation.invitedAt,
      invitedEmail: invitation.invitedEmail,
      invitedBy: invitation.invitedBy,
      listOwnerUserId: invitation.list.userId,
    });
  }

  ensureIsInvitedUser() {
    if (this.invitation.userId !== this.ctx.user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only the invited user can perform this action",
      });
    }
  }

  ensureIsListOwner() {
    if (this.invitation.listOwnerUserId !== this.ctx.user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only the list owner can perform this action",
      });
    }
  }

  private ensurePending() {
    if (this.invitation.status !== "pending") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only pending invitations can be changed",
      });
    }
  }

  private ensureActive() {
    if (this.expired) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invitation has expired",
      });
    }
  }

  async accept(): Promise<void> {
    this.ensureIsInvitedUser();
    this.ensurePending();
    this.ensureActive();

    await this.ctx.db.transaction(async (tx) => {
      const transactionCtx = asTransactionContext(this.ctx, tx);
      await tx
        .delete(listInvitations)
        .where(eq(listInvitations.id, this.invitation.id));
      await tx
        .insert(listCollaborators)
        .values({
          listId: this.invitation.listId,
          userId: this.invitation.userId,
          role: this.invitation.role,
          addedBy: this.invitation.invitedBy,
        })
        .onConflictDoNothing();
      await setCollaborationScope(transactionCtx, {
        listId: this.invitation.listId,
        userId: this.invitation.userId,
        recursive: this.invitation.recursive,
      });
    });
  }

  async decline(): Promise<void> {
    this.ensureIsInvitedUser();
    this.ensurePending();

    await this.ctx.db.transaction(async (tx) => {
      const transactionCtx = asTransactionContext(this.ctx, tx);
      await tx
        .update(listInvitations)
        .set({ status: "declined" })
        .where(eq(listInvitations.id, this.invitation.id));
      await deleteCollaborationScope(transactionCtx, {
        listId: this.invitation.listId,
        userId: this.invitation.userId,
      });
    });
    this.invitation.status = "declined";
  }

  async revoke(): Promise<void> {
    this.ensureIsListOwner();
    await this.ctx.db.transaction(async (tx) => {
      const transactionCtx = asTransactionContext(this.ctx, tx);
      await tx
        .delete(listInvitations)
        .where(eq(listInvitations.id, this.invitation.id));
      await deleteCollaborationScope(transactionCtx, {
        listId: this.invitation.listId,
        userId: this.invitation.userId,
      });
    });
  }

  async update(params: { role: Role; recursive: boolean }): Promise<void> {
    this.ensureIsListOwner();
    this.ensurePending();
    this.ensureActive();

    await this.ctx.db.transaction(async (tx) => {
      const transactionCtx = asTransactionContext(this.ctx, tx);
      await tx
        .update(listInvitations)
        .set({ role: params.role })
        .where(eq(listInvitations.id, this.invitation.id));
      await setCollaborationScope(transactionCtx, {
        listId: this.invitation.listId,
        userId: this.invitation.userId,
        recursive: params.recursive,
      });
    });
    this.invitation.role = params.role;
    this.invitation.recursive = params.recursive;
  }

  async resend(): Promise<boolean> {
    this.ensureIsListOwner();
    this.ensurePending();

    if (
      Date.now() - this.invitation.invitedAt.getTime() <
      LIST_INVITATION_RESEND_COOLDOWN_MS
    ) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Please wait before resending this invitation",
      });
    }

    const invitedAt = new Date();
    await this.ctx.db
      .update(listInvitations)
      .set({ invitedAt })
      .where(eq(listInvitations.id, this.invitation.id));
    this.invitation.invitedAt = invitedAt;
    return this.sendEmail();
  }

  async sendEmail(): Promise<boolean> {
    if (!this.invitation.invitedEmail) {
      return false;
    }

    const inviter = this.invitation.invitedBy
      ? await this.ctx.db.query.users.findFirst({
          where: eq(users.id, this.invitation.invitedBy),
          columns: { name: true },
        })
      : null;

    try {
      const { sendListInvitationEmail } = await import("../email");
      return await sendListInvitationEmail(
        this.invitation.invitedEmail,
        inviter?.name || "A user",
        this.invitation.listName,
        this.invitation.id,
      );
    } catch (error) {
      console.error("Failed to send list invitation email:", error);
      return false;
    }
  }

  static async inviteByEmail(
    ctx: AuthedContext,
    params: {
      email: string;
      role: Role;
      recursive: boolean;
      listId: string;
      listName: string;
      listType: "manual" | "smart";
      listOwnerId: string;
      inviterUserId: string;
      inviterName: string | null;
    },
  ): Promise<string> {
    const {
      email,
      role,
      recursive,
      listId,
      listType,
      listOwnerId,
      inviterUserId,
    } = params;
    const normalizedEmail = email.trim().toLowerCase();

    if (listType !== "manual") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only manual lists can have collaborators",
      });
    }

    const user = await ctx.db.query.users.findFirst({
      where: sql`lower(${users.email}) = ${normalizedEmail}`,
    });
    if (!user) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Unable to create an invitation for that email address",
      });
    }
    if (user.id === listOwnerId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot add the list owner as a collaborator",
      });
    }

    const existingCollaborator = await ctx.db.query.listCollaborators.findFirst(
      {
        where: and(
          eq(listCollaborators.listId, listId),
          eq(listCollaborators.userId, user.id),
        ),
      },
    );
    if (existingCollaborator) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "User is already a collaborator on this list",
      });
    }

    const existingInvitation = await ctx.db.query.listInvitations.findFirst({
      where: and(
        eq(listInvitations.listId, listId),
        eq(listInvitations.userId, user.id),
      ),
    });
    if (existingInvitation?.status === "pending") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "User already has a pending invitation for this list",
      });
    }

    const invitedAt = new Date();
    if (existingInvitation?.status === "declined") {
      await ctx.db.transaction(async (tx) => {
        const transactionCtx = asTransactionContext(ctx, tx);
        await tx
          .update(listInvitations)
          .set({
            status: "pending",
            role,
            invitedAt,
            invitedEmail: normalizedEmail,
            invitedBy: inviterUserId,
          })
          .where(eq(listInvitations.id, existingInvitation.id));
        await setCollaborationScope(transactionCtx, {
          listId,
          userId: user.id,
          recursive,
        });
      });
      return existingInvitation.id;
    }

    return ctx.db.transaction(async (tx) => {
      const transactionCtx = asTransactionContext(ctx, tx);
      const res = await tx
        .insert(listInvitations)
        .values({
          listId,
          userId: user.id,
          role,
          status: "pending",
          invitedAt,
          invitedEmail: normalizedEmail,
          invitedBy: inviterUserId,
        })
        .returning();
      await setCollaborationScope(transactionCtx, {
        listId,
        userId: user.id,
        recursive,
      });
      return res[0].id;
    });
  }

  static async pendingForUser(ctx: AuthedContext) {
    const invitations = await ctx.db.query.listInvitations.findMany({
      where: and(
        eq(listInvitations.userId, ctx.user.id),
        eq(listInvitations.status, "pending"),
      ),
      with: {
        list: {
          columns: {
            id: true,
            name: true,
            icon: true,
            description: true,
            rssToken: false,
          },
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return Promise.all(
      invitations.map(async (inv) => {
        const expiresAt = invitationExpiresAt(inv.invitedAt);
        return {
          id: inv.id,
          listId: inv.listId,
          role: inv.role,
          recursive: await getDirectCollaborationScope(ctx, {
            listId: inv.listId,
            userId: inv.userId,
          }),
          invitedAt: inv.invitedAt,
          expiresAt,
          expired: expiresAt.getTime() <= Date.now(),
          list: {
            id: inv.list.id,
            name: inv.list.name,
            icon: inv.list.icon,
            description: inv.list.description,
            owner: inv.list.user
              ? {
                  id: inv.list.user.id,
                  name: inv.list.user.name,
                  email: inv.list.user.email,
                }
              : null,
          },
        };
      }),
    );
  }

  static async invitationsForList(
    ctx: AuthedContext,
    params: { listId: string },
  ) {
    const invitations = await ctx.db.query.listInvitations.findMany({
      where: and(
        eq(listInvitations.listId, params.listId),
        eq(listInvitations.status, "pending"),
      ),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return Promise.all(
      invitations.map(async (invitation) => {
        const expiresAt = invitationExpiresAt(invitation.invitedAt);
        return {
          id: invitation.id,
          listId: invitation.listId,
          userId: invitation.userId,
          role: invitation.role,
          recursive: await getDirectCollaborationScope(ctx, {
            listId: invitation.listId,
            userId: invitation.userId,
          }),
          inherited: false,
          sourceListId: invitation.listId,
          sourceListName: null,
          status: invitation.status,
          invitedAt: invitation.invitedAt,
          addedAt: invitation.invitedAt,
          expiresAt,
          expired: expiresAt.getTime() <= Date.now(),
          user: {
            id: invitation.user.id,
            name: "Pending User",
            email: invitation.user.email || "",
            image: null,
          },
        };
      }),
    );
  }
}
