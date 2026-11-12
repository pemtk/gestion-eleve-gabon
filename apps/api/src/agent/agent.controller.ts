import { Body, Controller, Get, Inject, NotFoundException, Param, Post } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { AGENT_SCHOOL, DASHBOARDS, visitReportSchema } from '@sge/shared';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { visitReports } from '../db/schema.js';

@Roles('agent')
@Controller('agent')
export class AgentController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** §8.1 — établissements dont l'agent a la charge. */
  @Get('schools')
  schools() {
    return DASHBOARDS.agent.table.rows.map(([name, active, completion, absences, status]) => ({ name, active, completion, absences, status }));
  }

  /** §8.2 — tableau de bord d'engagement d'une école. */
  @Get('schools/:name')
  async school(@Param('name') name: string) {
    if (!DASHBOARDS.agent.table.rows.some((r) => r[0] === name)) throw new NotFoundException('École introuvable dans votre périmètre.');
    return { name, ...AGENT_SCHOOL, reports: await this.db.select().from(visitReports).where(eq(visitReports.school, name)).orderBy(desc(visitReports.id)) };
  }

  @Get('reports')
  reports() {
    return this.db.select().from(visitReports).orderBy(desc(visitReports.id));
  }

  /** §8.3 — compte-rendu de visite, visible par l'administrateur et, selon paramétrage, par l'école. */
  @Post('reports')
  async createReport(@Body({ schema: visitReportSchema }) body: z.infer<typeof visitReportSchema>) {
    const [report] = await this.db.insert(visitReports).values({ school: body.schoolId, date: body.date, text: body.observations, visibleToSchool: body.visibleToSchool }).returning();
    return report;
  }

  @Get('alerts')
  alerts() {
    return AGENT_SCHOOL.alerts;
  }
}
