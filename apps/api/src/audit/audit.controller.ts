import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, Roles, schoolOf, type AuthUser } from '../common/auth.js';
import { AuditService } from './audit.service.js';

const query = z.object({ limit: z.coerce.number().int().min(1).max(500).optional(), type: z.string().optional(), school: z.string().optional() });

@Controller()
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** Journal d'accès de l'école (signalements confidentiels, sécurité des comptes) : réservé à la direction, limité à son établissement. */
  @Roles('etablissement') @Get('school/audit-log')
  school(@CurrentUser() user: AuthUser, @Query() q: Record<string, string>) {
    const { limit, type } = query.parse(q);
    return this.audit.list({ schoolId: schoolOf(user), resourceType: type, limit });
  }

  /** Journal de toute la plateforme, filtrable par école. */
  @Roles('admin') @Get('admin/audit-log')
  all(@Query() q: Record<string, string>) {
    const { limit, type, school } = query.parse(q);
    return this.audit.list({ schoolId: school, resourceType: type, limit });
  }
}
