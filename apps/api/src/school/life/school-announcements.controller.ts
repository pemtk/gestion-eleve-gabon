import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { announcementSchema } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  CurrentUser,
  Roles,
  schoolOf,
  type AuthUser,
} from '../../common/auth.js';
import { DB, type Db } from '../../db/db.module.js';
import { announcements, files, visitReports } from '../../db/schema.js';
import { FilesService, toStored } from '../../files/files.service.js';
import { SchoolPolicy } from '../school.policy.js';

/** Annonces de l'école avec pièce jointe (§7.9) et comptes-rendus de visite partagés (§8.3). */
@Roles('etablissement')
@Controller('school')
export class SchoolAnnouncementsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly policy: SchoolPolicy,
    private readonly files: FilesService,
  ) {}

  @Get('announcements')
  async announcements(@CurrentUser() user: AuthUser) {
    const rows = await this.db
      .select({ a: announcements, f: files })
      .from(announcements)
      .leftJoin(files, eq(files.id, announcements.attachmentFileId))
      .where(eq(announcements.schoolId, schoolOf(user)))
      .orderBy(desc(announcements.at));
    return rows.map(({ a, f }) => ({
      ...a,
      attachment: f ? toStored(f) : null,
    }));
  }

  /** §7.9 — la pièce jointe (PDF ou image, 5 Mo) est envoyée au préalable (`POST /files`, usage « attachment »). */
  @Post('announcements')
  async announce(
    @CurrentUser() user: AuthUser,
    @Body({ schema: announcementSchema })
    body: z.infer<typeof announcementSchema>,
  ) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    return this.db.transaction(async (tx) => {
      const id = randomUUID();
      const [a] = await tx
        .insert(announcements)
        .values({
          id,
          schoolId: sid,
          title: body.title ?? '',
          message: body.message,
          audience: body.audience,
          target: body.target,
          attachmentFileId: body.attachmentFileId,
        })
        .returning();
      const attachment = body.attachmentFileId
        ? toStored(
            await this.files.attach(
              tx,
              user,
              body.attachmentFileId,
              'attachment',
              'announcement',
              id,
            ),
          )
        : null;
      return { ...a!, attachment };
    });
  }

  /** §8.3 — comptes-rendus de visite que l'agent a choisi de partager avec l'école. */
  @Get('visit-reports')
  async visitReports(@CurrentUser() user: AuthUser) {
    const rows = await this.db
      .select({ r: visitReports, f: files })
      .from(visitReports)
      .leftJoin(files, eq(files.id, visitReports.attachmentFileId))
      .where(
        and(
          eq(visitReports.schoolId, schoolOf(user)),
          eq(visitReports.visibleToSchool, true),
        ),
      )
      .orderBy(desc(visitReports.id));
    return rows.map(({ r, f }) => ({
      id: r.id,
      date: r.date,
      text: r.text,
      attachment: f ? toStored(f) : null,
    }));
  }
}
