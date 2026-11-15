import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { conversations } from '../db/schema.js';
import { accessOf, type Access, type Conv } from './access.js';

/** Ouverture d'une conversation avec les droits de l'utilisateur : introuvable (404) ou écriture interdite (403). */
@Injectable()
export class ConversationAccessService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /* ------------------------------ accès à une conversation ------------------------------ */

  /** Conversation lisible par l'utilisateur, sinon « introuvable » (on ne révèle pas qu'elle existe). */
  async open(
    user: AuthUser,
    id: string,
    need: 'read' | 'post' = 'read',
  ): Promise<{ conv: Conv; access: Access }> {
    const [conv] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    const access = conv
      ? await accessOf(this.db, user, conv)
      : { read: false, post: false };
    if (!conv || !access.read)
      throw new NotFoundException('Conversation introuvable.');
    if (need === 'post' && !access.post)
      throw new ForbiddenException(
        'Vous ne pouvez pas écrire dans cette conversation.',
      );
    return { conv, access };
  }
}
