import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { CONVERSATION, type Message } from '@sge/shared';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { StoreService } from '../common/store.service.js';

const messageSchema = z
  .object({ text: z.string().trim().max(2000).optional(), image: z.boolean().optional(), clientId: z.string().min(1) })
  .refine((m) => m.text || m.image, 'Un message contient du texte ou une image.');

type MobileRole = 'eleve' | 'parent' | 'enseignant';

@Roles('eleve', 'parent', 'enseignant')
@Controller()
export class MessagingController {
  constructor(private readonly store: StoreService) {}

  @Get('threads')
  threads(@CurrentUser() user: AuthUser) {
    return this.store.threads[user.role as MobileRole];
  }

  @Get('threads/:id/messages')
  messages(@Param('id') id: string) {
    return this.store.conversations.get(id) ?? structuredClone(CONVERSATION);
  }

  /** `clientId` rend l'envoi idempotent : un message gardé hors ligne n'est jamais dupliqué à la synchronisation. */
  @Post('threads/:id/messages')
  send(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body({ schema: messageSchema }) body: z.infer<typeof messageSchema>) {
    const list = this.store.conversations.get(id) ?? structuredClone(CONVERSATION);
    const existing = list.find((m) => m.id === body.clientId);
    if (existing) return existing;
    const thread = this.store.threads[user.role as MobileRole]?.find((t) => t.id === id);
    if (!thread) throw new NotFoundException('Conversation introuvable.');
    const message: Message = { id: body.clientId, mine: true, text: body.text ?? null, image: body.image, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) };
    list.push(message);
    this.store.conversations.set(id, list);
    return message;
  }

  @Get('notifications')
  notifications(@CurrentUser() user: AuthUser) {
    return this.store.notifications[user.role as MobileRole].map((n) => ({ ...n, read: this.store.notificationsRead.has(`${user.role}:${n.id}`) }));
  }

  @Post('notifications/read-all')
  readAll(@CurrentUser() user: AuthUser) {
    for (const n of this.store.notifications[user.role as MobileRole]) this.store.notificationsRead.add(`${user.role}:${n.id}`);
    return { ok: true };
  }
}
