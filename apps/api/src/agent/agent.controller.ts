import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { AGENT_SCHOOL, DASHBOARDS, visitReportSchema } from '@sge/shared';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { StoreService } from '../common/store.service.js';

@Roles('agent')
@Controller('agent')
export class AgentController {
  constructor(private readonly store: StoreService) {}

  /** §8.1 — établissements dont l'agent a la charge. */
  @Get('schools')
  schools() {
    return DASHBOARDS.agent.table.rows.map(([name, active, completion, absences, status]) => ({ name, active, completion, absences, status }));
  }

  /** §8.2 — tableau de bord d'engagement d'une école. */
  @Get('schools/:name')
  school(@Param('name') name: string) {
    const exists = DASHBOARDS.agent.table.rows.some((r) => r[0] === name);
    if (!exists) throw new NotFoundException('École introuvable dans votre périmètre.');
    return { name, ...AGENT_SCHOOL, reports: this.store.visitReports.filter((r) => r.school === name) };
  }

  @Get('reports')
  reports() {
    return this.store.visitReports;
  }

  /** §8.3 — compte-rendu de visite, visible par l'administrateur et, selon paramétrage, par l'école. */
  @Post('reports')
  createReport(@Body({ schema: visitReportSchema }) body: z.infer<typeof visitReportSchema>) {
    const report = { id: `v${this.store.visitReports.length + 1}`, school: body.schoolId, date: body.date, text: body.observations };
    this.store.visitReports.unshift(report);
    return { ...report, visibleToSchool: body.visibleToSchool };
  }

  @Get('alerts')
  alerts() {
    return AGENT_SCHOOL.alerts;
  }
}
