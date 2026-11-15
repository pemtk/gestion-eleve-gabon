import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gt, sql } from 'drizzle-orm';
import { type Message } from '@sge/shared';
import type { AuthUser } from '../common/auth.js';
import { RateLimiter, type Limit } from '../common/rate-limiter.js';
import { DB, type Db } from '../db/db.module.js';
import {
  conversationMessages,
  conversationReads,
  conversations,
  users,
} from '../db/schema.js';
import { FilesService } from '../files/files.service.js';
import { ConversationAccessService } from './conversation-access.service.js';
import { ConversationUnreadService } from './conversation-unread.service.js';
import { timeLabel } from './time-label.js';

const PAGE = 200;

/** 60 messages par minute et par utilisateur : une file hors ligne qui se vide passe, un robot non. */
const SEND_LIMIT: Limit = { max: 60, windowMs: 60_000, blockMs: 60_000 };

/** Messages d'une conversation : lecture, envoi idempotent (texte ou image) et marquage « lu ». */
@Injectable()
export class ConversationMessagesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly limiter: RateLimiter,
    private readonly files: FilesService,
    private readonly access: ConversationAccessService,
    private readonly unread: ConversationUnreadService,
  ) {}

  /* ------------------------------ messages ------------------------------ */

  async messages(
    user: AuthUser,
    id: string,
    after = 0,
  ): Promise<{ messages: Message[]; canPost: boolean }> {
    const { access } = await this.access.open(user, id);
    const rows = await this.db
      .select({ m: conversationMessages, sender: users.name })
      .from(conversationMessages)
      .leftJoin(users, eq(users.id, conversationMessages.senderId))
      .where(
        and(
          eq(conversationMessages.conversationId, id),
          gt(conversationMessages.id, after),
        ),
      )
      .orderBy(
        after ? asc(conversationMessages.id) : desc(conversationMessages.id),
      )
      .limit(PAGE);
    const ordered = after ? rows : rows.reverse();
    return {
      canPost: access.post,
      messages: ordered.map(({ m, sender }) => this.view(m, user, sender)),
    };
  }

  private view(
    m: typeof conversationMessages.$inferSelect,
    user: AuthUser,
    sender: string | null,
  ): Message {
    return {
      id: m.clientId,
      seq: m.id,
      mine: m.senderId === user.sub,
      text: m.text,
      image: m.fileId ? true : undefined,
      fileId: m.fileId ?? undefined,
      sender: sender ?? undefined,
      time: timeLabel(m.createdAt),
    };
  }

  /** `clientId` rend l'envoi idempotent : un message gardé hors ligne puis renvoyé n'est jamais dupliqué. */
  async send(
    user: AuthUser,
    id: string,
    body: { text?: string; fileId?: string; clientId: string },
  ): Promise<Message> {
    const { conv } = await this.access.open(user, id, 'post');
    await this.limiter.check(`msg:${user.sub}`);
    await this.limiter.hit(`msg:${user.sub}`, SEND_LIMIT);
    const message = await this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(conversationMessages)
        .values({
          conversationId: id,
          clientId: body.clientId,
          senderId: user.sub,
          senderRole: user.role,
          text: body.text ?? null,
          fileId: body.fileId ?? null,
        })
        .onConflictDoNothing()
        .returning();
      if (inserted) {
        if (body.fileId)
          await this.files.attach(
            tx,
            user,
            body.fileId,
            'message',
            'conversation',
            conv.id,
            conv.schoolId,
          );
        await tx
          .update(conversations)
          .set({ lastMessageAt: inserted.createdAt })
          .where(eq(conversations.id, id));
        // Ce qu'on écrit soi-même est lu.
        await tx
          .insert(conversationReads)
          .values({
            conversationId: id,
            userId: user.sub,
            lastReadMessageId: inserted.id,
          })
          .onConflictDoUpdate({
            target: [
              conversationReads.conversationId,
              conversationReads.userId,
            ],
            set: {
              lastReadMessageId: sql`greatest(${conversationReads.lastReadMessageId}, ${inserted.id})`,
            },
          });
        return inserted;
      }
      const [existing] = await tx
        .select()
        .from(conversationMessages)
        .where(
          and(
            eq(conversationMessages.conversationId, id),
            eq(conversationMessages.clientId, body.clientId),
          ),
        );
      if (existing!.senderId !== user.sub)
        throw new BadRequestException('Identifiant de message déjà utilisé.');
      return existing!;
    });
    return this.view(message, user, user.name);
  }

  /** Marque la conversation comme lue (jusqu'au dernier message, ou `upTo`). */
  async markRead(
    user: AuthUser,
    id: string,
    upTo?: number,
  ): Promise<{ unread: number }> {
    await this.access.open(user, id);
    const [{ last }] = (await this.db
      .select({
        last: sql<number>`coalesce(max(${conversationMessages.id}), 0)::int`,
      })
      .from(conversationMessages)
      .where(
        and(
          eq(conversationMessages.conversationId, id),
          upTo ? sql`${conversationMessages.id} <= ${upTo}` : undefined,
        ),
      )) as [{ last: number }];
    await this.db
      .insert(conversationReads)
      .values({ conversationId: id, userId: user.sub, lastReadMessageId: last })
      .onConflictDoUpdate({
        target: [conversationReads.conversationId, conversationReads.userId],
        set: {
          lastReadMessageId: sql`greatest(${conversationReads.lastReadMessageId}, ${last})`,
        },
      });
    return {
      unread: (await this.unread.unreadCounts(user.sub, [id])).get(id) ?? 0,
    };
  }
}
