import { Body, Controller, Delete, Get, HttpCode, Inject, Put } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { initials } from '@sge/shared';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { FilesService } from '../files/files.service.js';

const profileSchema = z.object({
  firstName: z.string().trim().min(1), lastName: z.string().trim().min(1),
  photoVisibility: z.enum(['school', 'teachers', 'private']).default('school'),
});
const avatarSchema = z.object({ fileId: z.string().min(1) });

/** §3.4 — Mon compte : nom, photo (et qui la voit). Le téléphone n'est modifiable que par l'école. */
@Roles('eleve', 'parent', 'enseignant')
@Controller('me')
export class AccountController {
  constructor(@Inject(DB) private readonly db: Db, private readonly files: FilesService) {}

  @Put('profile')
  async profile(@CurrentUser() user: AuthUser, @Body({ schema: profileSchema }) body: z.infer<typeof profileSchema>) {
    const name = `${body.firstName} ${body.lastName}`;
    await this.db.update(users).set({ name, initials: initials(name), photoVisibility: body.photoVisibility }).where(eq(users.id, user.sub));
    return { ok: true, name, photoVisibility: body.photoVisibility };
  }

  @Get('profile')
  async current(@CurrentUser() user: AuthUser) {
    const [u] = await this.db.select({ photoVisibility: users.photoVisibility, avatarFileId: users.avatarFileId }).from(users).where(eq(users.id, user.sub));
    return { photoVisibility: u?.photoVisibility ?? 'school', avatarFileId: u?.avatarFileId ?? null };
  }

  /** Photo de profil : le fichier (envoyé avec l'usage « avatar ») remplace la précédente, qui est supprimée. */
  @Put('avatar')
  async avatar(@CurrentUser() user: AuthUser, @Body({ schema: avatarSchema }) body: z.infer<typeof avatarSchema>) {
    const previous = await this.db.transaction(async (tx) => {
      const [u] = await tx.select({ avatarFileId: users.avatarFileId }).from(users).where(eq(users.id, user.sub));
      await this.files.attach(tx, user, body.fileId, 'avatar', 'user', user.sub);
      await tx.update(users).set({ avatarFileId: body.fileId }).where(eq(users.id, user.sub));
      return u?.avatarFileId ?? null;
    });
    if (previous) await this.files.remove(previous);
    return { avatarFileId: body.fileId };
  }

  @Delete('avatar') @HttpCode(200)
  async removeAvatar(@CurrentUser() user: AuthUser) {
    const [u] = await this.db.select({ avatarFileId: users.avatarFileId }).from(users).where(eq(users.id, user.sub));
    await this.db.update(users).set({ avatarFileId: null }).where(eq(users.id, user.sub));
    if (u?.avatarFileId) await this.files.remove(u.avatarFileId);
    return { avatarFileId: null };
  }
}
