import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { desc, eq, inArray, type SQL } from 'drizzle-orm';
import { visitReportSchema } from '@sge/shared';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import {
  files,
  organizations,
  userScopes,
  visitReports,
} from '../db/schema.js';
import { FilesService, toStored } from '../files/files.service.js';
import { alertsOf, DashboardService } from '../dashboard/dashboard.service.js';
import { IndicatorsService } from '../indicators/indicators.service.js';

/** Un agent ne voit que les établissements de son périmètre (table `user_scopes`). */
@Roles('agent')
@Controller('agent')
export class AgentController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly indicators: IndicatorsService,
    private readonly dashboards: DashboardService,
    private readonly files: FilesService,
  ) {}

  /** Comptes-rendus avec leur pièce jointe (photo ou document), du plus récent au plus ancien. */
  private async reportRows(where: SQL | undefined) {
    const rows = await this.db
      .select({ r: visitReports, f: files })
      .from(visitReports)
      .leftJoin(files, eq(files.id, visitReports.attachmentFileId))
      .where(where)
      .orderBy(desc(visitReports.id));
    return rows.map(({ r, f }) => ({
      ...r,
      attachment: f ? toStored(f) : null,
    }));
  }

  private scope(user: AuthUser) {
    return this.db
      .select({ id: organizations.id, name: organizations.name })
      .from(userScopes)
      .innerJoin(organizations, eq(organizations.id, userScopes.orgId))
      .where(eq(userScopes.userId, user.sub));
  }

  /** §8.1 — établissements dont l'agent a la charge, avec leurs indicateurs de la semaine. */
  @Get('schools')
  async schools(@CurrentUser() user: AuthUser) {
    return this.dashboards.agentRows(
      await this.indicators.schools(
        (await this.scope(user)).map((o) => o.id),
        7,
      ),
    );
  }

  /** §8.2 — tableau de bord d'engagement d'une école du périmètre. */
  @Get('schools/:name')
  async school(@CurrentUser() user: AuthUser, @Param('name') name: string) {
    const org = (await this.scope(user)).find((o) => o.name === name);
    if (!org)
      throw new NotFoundException('École introuvable dans votre périmètre.');
    const [stat] = await this.indicators.schools([org.id], 7);
    return {
      name,
      ...(await this.dashboards.agentSchool(stat!)),
      reports: await this.reportRows(eq(visitReports.schoolId, org.id)),
    };
  }

  @Get('reports')
  async reports(@CurrentUser() user: AuthUser) {
    const ids = (await this.scope(user)).map((o) => o.id);
    if (!ids.length) return [];
    return this.reportRows(inArray(visitReports.schoolId, ids));
  }

  /** §8.3 — compte-rendu de visite, visible par l'administrateur et, selon paramétrage, par l'école. L'école doit être dans le périmètre. */
  @Post('reports')
  async createReport(
    @CurrentUser() user: AuthUser,
    @Body({ schema: visitReportSchema })
    body: z.infer<typeof visitReportSchema>,
  ) {
    const org = (await this.scope(user)).find(
      (o) => o.name === body.schoolId || o.id === body.schoolId,
    );
    if (!org)
      throw new NotFoundException('École introuvable dans votre périmètre.');
    return this.db.transaction(async (tx) => {
      const [report] = await tx
        .insert(visitReports)
        .values({
          schoolId: org.id,
          school: org.name,
          date: body.date,
          text: body.observations,
          visibleToSchool: body.visibleToSchool,
          attachmentFileId: body.attachmentFileId,
        })
        .returning();
      // La pièce jointe suit l'école visitée : c'est elle qui décide si la direction peut la lire.
      const attachment = body.attachmentFileId
        ? toStored(
            await this.files.attach(
              tx,
              user,
              body.attachmentFileId,
              'report',
              'visit_report',
              String(report!.id),
              org.id,
            ),
          )
        : null;
      return { ...report!, attachment };
    });
  }

  /** Points d'attention de tout le périmètre (engagement, saisie des notes, activation, signalements). */
  @Get('alerts')
  async alerts(@CurrentUser() user: AuthUser) {
    const stats = await this.indicators.schools(
      (await this.scope(user)).map((o) => o.id),
      7,
    );
    return stats.flatMap((s) =>
      alertsOf(s).map((a) => ({
        icon: a.icon,
        text: `${s.name} · ${a.title} : ${a.text}`,
      })),
    );
  }
}
