import { Body, Controller, Inject, Put } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { initials } from '@sge/shared';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { setSetting } from '../db/settings.js';

const profileSchema = z.object({
  firstName: z.string().trim().min(1), lastName: z.string().trim().min(1),
  photoVisibility: z.enum(['school', 'teachers', 'private']).default('school'),
});

/** §3.4 — Mon compte : nom, photo (et qui la voit). Le téléphone n'est modifiable que par l'école. */
@Roles('eleve', 'parent', 'enseignant')
@Controller('me')
export class AccountController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Put('profile')
  async profile(@CurrentUser() user: AuthUser, @Body({ schema: profileSchema }) body: z.infer<typeof profileSchema>) {
    const name = `${body.firstName} ${body.lastName}`;
    await this.db.update(users).set({ name, initials: initials(name) }).where(eq(users.id, user.sub));
    await setSetting(this.db, 'photoVisibility', body.photoVisibility);
    return { ok: true, name, photoVisibility: body.photoVisibility };
  }
}
