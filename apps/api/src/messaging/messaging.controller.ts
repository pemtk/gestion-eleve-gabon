import { Body, Controller, Get, Inject, NotFoundException, Param, Post } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { NOTIFICATIONS, type Message } from '@sge/shared';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { messages, notificationReads, threads } from '../db/schema.js';

const messageSchema = z
  .object({ text: z.string().trim().max(2000).optional(), image: z.boolean().optional(), clientId: z.string().min(1) })
  .refine((m) => m.text || m.image, 'Un message contient du texte ou une image.');

type MobileRole = 'eleve' | 'parent' | 'enseignant';
type MessageRow = typeof messages.$inferSelect;
const view = (m: MessageRow, role: string): Message => ({ id: m.clientId, mine: m.senderRole === role, text: m.text, image: m.image || undefined, time: m.time });

@Roles('eleve', 'parent', 'enseignant')
@Controller()
export class MessagingController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get('threads')
  threads(@CurrentUser() user: AuthUser) {
    return this.db.select().from(threads).where(eq(threads.role, user.role)).orderBy(asc(threads.id));
  }

  private async thread(id: string, role: string) {
    const [t] = await this.db.select().from(threads).where(and(eq(threads.id, id), eq(threads.role, role)));
    if (!t) throw new NotFoundException('Conversation introuvable.');
    return t;
  }

  @Get('threads/:id/messages')
  async messages(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.thread(id, user.role);
    return (await this.db.select().from(messages).where(eq(messages.threadId, id)).orderBy(asc(messages.id))).map((m) => view(m, user.role));
  }

  /** `clientId` rend l'envoi idempotent (index unique en base) : un message gardé hors ligne n'est jamais dupliqué. */
  @Post('threads/:id/messages')
  async send(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: messageSchema }) body: z.infer<typeof messageSchema>) {
    await this.thread(id, user.role);
    const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    await this.db.insert(messages).values({ threadId: id, clientId: body.clientId, senderRole: user.role, text: body.text ?? null, image: !!body.image, time }).onConflictDoNothing();
    const [row] = await this.db.select().from(messages).where(and(eq(messages.threadId, id), eq(messages.clientId, body.clientId)));
    return view(row!, user.role);
  }

  @Get('notifications')
  async notifications(@CurrentUser() user: AuthUser) {
    const read = new Set((await this.db.select().from(notificationReads).where(eq(notificationReads.role, user.role))).map((r) => r.notificationId));
    return NOTIFICATIONS[user.role as MobileRole].map((n) => ({ ...n, read: read.has(n.id) }));
  }

  @Post('notifications/read-all')
  async readAll(@CurrentUser() user: AuthUser) {
    const rows = NOTIFICATIONS[user.role as MobileRole].map((n) => ({ role: user.role, notificationId: n.id }));
    await this.db.insert(notificationReads).values(rows).onConflictDoNothing();
    return { ok: true };
  }
}
