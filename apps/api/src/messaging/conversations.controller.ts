import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { ConversationContactsService } from './conversation-contacts.service.js';
import { ConversationMessagesService } from './conversation-messages.service.js';
import { ConversationThreadsService } from './conversation-threads.service.js';
import { ConversationUnreadService } from './conversation-unread.service.js';

const messageSchema = z
  .object({
    text: z.string().trim().max(2000).optional(),
    fileId: z.string().min(1).optional(),
    clientId: z.string().min(1).max(100),
  })
  .refine(
    (m) => m.text || m.fileId,
    'Un message contient du texte ou une image.',
  );
const startSchema = z.object({ contact: z.string().min(1) });
const readSchema = z.object({ upTo: z.number().int().positive().optional() });

/**
 * Messagerie (§3.3, §5.5) : conversations privées, de classe et d'école. Chaque route déduit les droits de l'appartenance de l'utilisateur ;
 * une conversation qui n'est pas la sienne répond 404. L'actualisation se fait par interrogation (`?after=` et `/threads/unread`).
 */
@Roles('eleve', 'parent', 'enseignant', 'etablissement')
@Controller('threads')
export class ConversationsController {
  constructor(
    private readonly threadList: ConversationThreadsService,
    private readonly unreadCount: ConversationUnreadService,
    private readonly contactBook: ConversationContactsService,
    private readonly messageService: ConversationMessagesService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.threadList.threads(user);
  }

  /** Total des messages non lus (pastille de l'onglet Messages). */
  @Get('unread')
  async unread(@CurrentUser() user: AuthUser) {
    return { total: await this.unreadCount.unreadTotal(user) };
  }

  /** Les personnes que l'on peut écrire (et rien d'autre). */
  @Get('contacts')
  async contacts(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    return (await this.contactBook.contacts(user, q)).map(
      ({ key, name, label, initials }) => ({ key, name, label, initials }),
    );
  }

  /** Démarre (ou retrouve) une conversation privée avec un contact autorisé. */
  @Post()
  @HttpCode(201)
  start(
    @CurrentUser() user: AuthUser,
    @Body({ schema: startSchema }) body: z.infer<typeof startSchema>,
  ) {
    return this.contactBook.startPrivate(user, body.contact);
  }

  @Get(':id')
  summary(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.threadList.summary(user, id);
  }

  /** `?after=<seq>` ne retourne que les messages plus récents que le dernier reçu (actualisation). */
  @Get(':id/messages')
  async messages(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('after', new ParseIntPipe({ optional: true })) after?: number,
  ) {
    return (await this.messageService.messages(user, id, after ?? 0)).messages;
  }

  @Post(':id/messages')
  @HttpCode(201)
  send(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body({ schema: messageSchema }) body: z.infer<typeof messageSchema>,
  ) {
    return this.messageService.send(user, id, body);
  }

  @Post(':id/read')
  @HttpCode(200)
  read(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body({ schema: readSchema }) body: z.infer<typeof readSchema>,
  ) {
    return this.messageService.markRead(user, id, body.upTo);
  }
}
