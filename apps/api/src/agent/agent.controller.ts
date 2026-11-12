import { Body, Controller, Get, Inject, NotFoundException, Param, Post } from '@nestjs/common';
import { desc, eq, inArray } from 'drizzle-orm';
import { AGENT_SCHOOL, DASHBOARDS, visitReportSchema } from '@sge/shared';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { organizations, userScopes, visitReports } from '../db/schema.js';

/** Un agent ne voit que les établissements de son périmètre (table `user_scopes`). */
@Roles('agent')
@Controller('agent')
export class AgentController {
  constructor(@Inject(DB) private readonly db: Db) {}

  private scope(user: AuthUser) {
    return this.db.select({ id: organizations.id, name: organizations.name }).from(userScopes).innerJoin(organizations, eq(organizations.id, userScopes.orgId)).where(eq(userScopes.userId, user.sub));
  }

  /** §8.1 — établissements dont l'agent a la charge. */
  @Get('schools')
  async schools(@CurrentUser() user: AuthUser) {
    const names = new Set((await this.scope(user)).map((o) => o.name));
    return DASHBOARDS.agent.table.rows.filter((r) => names.has(r[0]!)).map(([name, active, completion, absences, status]) => ({ name, active, completion, absences, status }));
  }

  /** §8.2 — tableau de bord d'engagement d'une école du périmètre. */
  @Get('schools/:name')
  async school(@CurrentUser() user: AuthUser, @Param('name') name: string) {
    const org = (await this.scope(user)).find((o) => o.name === name);
    if (!org || !DASHBOARDS.agent.table.rows.some((r) => r[0] === name)) throw new NotFoundException('École introuvable dans votre périmètre.');
    return { name, ...AGENT_SCHOOL, reports: await this.db.select().from(visitReports).where(eq(visitReports.schoolId, org.id)).orderBy(desc(visitReports.id)) };
  }

  @Get('reports')
  async reports(@CurrentUser() user: AuthUser) {
    const ids = (await this.scope(user)).map((o) => o.id);
    if (!ids.length) return [];
    return this.db.select().from(visitReports).where(inArray(visitReports.schoolId, ids)).orderBy(desc(visitReports.id));
  }

  /** §8.3 — compte-rendu de visite, visible par l'administrateur et, selon paramétrage, par l'école. L'école doit être dans le périmètre. */
  @Post('reports')
  async createReport(@CurrentUser() user: AuthUser, @Body({ schema: visitReportSchema }) body: z.infer<typeof visitReportSchema>) {
    const org = (await this.scope(user)).find((o) => o.name === body.schoolId || o.id === body.schoolId);
    if (!org) throw new NotFoundException('École introuvable dans votre périmètre.');
    const [report] = await this.db.insert(visitReports).values({ schoolId: org.id, school: org.name, date: body.date, text: body.observations, visibleToSchool: body.visibleToSchool }).returning();
    return report;
  }

  @Get('alerts')
  alerts() {
    return AGENT_SCHOOL.alerts;
  }
}
