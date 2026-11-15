import {
  Body,
  Controller,
  Get,
  Inject,
  Ip,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { caseCloseSchema, caseEvaluationSchema } from '@sge/shared';
import { z } from 'zod';
import {
  CurrentUser,
  Roles,
  schoolOf,
  type AuthUser,
} from '../../common/auth.js';
import { DB, type Db } from '../../db/db.module.js';
import { getSetting, setSetting } from '../../db/settings.js';
import { AuditService } from '../../audit/audit.service.js';
import { CasesService } from '../cases.service.js';
import { SchoolPolicy } from '../school.policy.js';

const referentSchema = z.object({
  name: z.string().trim().min(1),
  confirmed: z.boolean(),
});

const actionSchema = z.object({
  label: z.string().trim().min(1),
  owner: z.enum(['Référente', 'Directrice', 'Prof. principal']),
});

/** Vie scolaire (§7.10) : référent, signalements confidentiels et leur traitement, chaque accès étant tracé. */
@Roles('etablissement')
@Controller('school')
export class SchoolCasesController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly policy: SchoolPolicy,
    private readonly cases: CasesService,
    private readonly audit: AuditService,
  ) {}

  /** Trace l'accès (ou la tentative refusée) à un signalement confidentiel. */
  private trace<T>(
    user: AuthUser,
    ip: string,
    action: string,
    id: string | null,
    fn: () => Promise<T>,
    details?: Record<string, unknown>,
  ) {
    return this.audit.traced(
      { action, resourceType: 'case', resourceId: id, user, ip, details },
      fn,
    );
  }

  /** §7.10 — sans référent confirmé, seuls les signalements « conduite / engagement » sont possibles. */
  @Get('referent')
  async referent(@CurrentUser() user: AuthUser, @Ip() ip: string) {
    const sid = schoolOf(user);
    const referent = await getSetting(this.db, sid, 'referent');
    const cases = await this.trace(user, ip, 'case.list', null, () =>
      this.cases.list(sid),
    );
    return {
      referent,
      confidentialEnabled: !!referent?.confirmed,
      delays: { acknowledgeHours: 4, evaluationHours: 24 },
      cases,
      conduct: await this.cases.conduct(sid),
    };
  }

  @Put('referent')
  async setReferent(
    @CurrentUser() user: AuthUser,
    @Body({ schema: referentSchema }) body: z.infer<typeof referentSchema>,
    @Ip() ip: string,
  ) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    await setSetting(this.db, sid, 'referent', body);
    await this.audit.record({
      action: 'case.referent.update',
      resourceType: 'setting',
      resourceId: 'referent',
      user,
      ip,
    });
    return body;
  }

  @Get('cases/:id')
  caseDetail(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    return this.trace(user, ip, 'case.read', id, () =>
      this.cases.detail(id, schoolOf(user)),
    );
  }

  @Post('cases/:id/acknowledge')
  ack(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    return this.trace(user, ip, 'case.acknowledge', id, () =>
      this.cases.acknowledge(id, schoolOf(user)),
    );
  }

  @Post('cases/:id/evaluate')
  evaluate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body({ schema: caseEvaluationSchema })
    body: z.infer<typeof caseEvaluationSchema>,
    @Ip() ip: string,
  ) {
    return this.trace(
      user,
      ip,
      'case.evaluate',
      id,
      () => this.cases.evaluate(id, schoolOf(user), body),
      { gravity: body.gravity },
    );
  }

  @Post('cases/:id/actions')
  addAction(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body({ schema: actionSchema }) body: z.infer<typeof actionSchema>,
    @Ip() ip: string,
  ) {
    return this.trace(user, ip, 'case.action.add', id, () =>
      this.cases.addAction(id, schoolOf(user), body.label, body.owner),
    );
  }

  @Post('cases/:id/actions/:index/toggle')
  toggle(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('index') index: string,
    @Ip() ip: string,
  ) {
    return this.trace(
      user,
      ip,
      'case.action.toggle',
      id,
      () => this.cases.toggleAction(id, schoolOf(user), Number(index)),
      { index: Number(index) },
    );
  }

  @Post('cases/:id/prepare-close')
  prepareClose(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    return this.trace(user, ip, 'case.prepare_close', id, () =>
      this.cases.toClose(id, schoolOf(user)),
    );
  }

  @Post('cases/:id/close')
  close(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body({ schema: caseCloseSchema }) body: z.infer<typeof caseCloseSchema>,
    @Ip() ip: string,
  ) {
    return this.trace(user, ip, 'case.close', id, () =>
      this.cases.close(id, schoolOf(user), body),
    );
  }
}
