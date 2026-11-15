import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type SessionUser } from '@sge/shared';
import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { toSessionUser } from './auth.shared.js';

/** Recherche d'un compte par numéro de téléphone (un numéro = un compte) et profil de session. */
@Injectable()
export class UserLookupService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async findByPhone(phone: string) {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.phone, phone));
    return row;
  }

  async me(phone: string): Promise<SessionUser> {
    const record = await this.findByPhone(phone);
    if (!record) throw new UnauthorizedException();
    return toSessionUser(record);
  }

  async avatarOf(userId: string): Promise<string | null> {
    const [u] = await this.db
      .select({ id: users.avatarFileId })
      .from(users)
      .where(eq(users.id, userId));
    return u?.id ?? null;
  }

  async hasPassword(phone: string): Promise<boolean> {
    return !!(await this.findByPhone(phone))?.passwordHash;
  }
}
