import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { Roles } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { files, incidents, visitReports } from '../db/schema.js';
import { toStored } from '../files/files.service.js';

/** Supervision de la plateforme : comptes-rendus de visite et incidents techniques. */
@Roles('admin')
@Controller('admin')
export class AdminOversightController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Comptes-rendus de visite des agents (§8.3) : visibles de l'administrateur, avec leur pièce jointe. */
  @Get('reports')
  async reports() {
    const rows = await this.db
      .select({ r: visitReports, f: files })
      .from(visitReports)
      .leftJoin(files, eq(files.id, visitReports.attachmentFileId))
      .orderBy(desc(visitReports.id));
    return rows.map(({ r, f }) => ({
      ...r,
      attachment: f ? toStored(f) : null,
    }));
  }

  @Get('incidents')
  incidents() {
    return this.db.select().from(incidents).orderBy(incidents.id);
  }

  @Post('incidents/:id/resolve')
  async resolve(@Param('id') id: string) {
    const [incident] = await this.db
      .update(incidents)
      .set({ status: 'Résolu', tone: 'hi' })
      .where(eq(incidents.id, id))
      .returning();
    if (!incident) throw new NotFoundException();
    return incident;
  }
}
