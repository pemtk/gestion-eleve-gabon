import { Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin/admin.controller.js';
import { AgentController } from './agent/agent.controller.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { SmsGateway } from './auth/sms.gateway.js';
import { AuthGuard, RolesGuard } from './common/auth.js';
import { DbModule } from './db/db.module.js';
import { DashboardController } from './dashboard/dashboard.controller.js';
import { HealthController } from './health.controller.js';
import { AccountController } from './learning/account.controller.js';
import { ParentController } from './learning/parent.controller.js';
import { StudentController } from './learning/student.controller.js';
import { TeacherController } from './learning/teacher.controller.js';
import { MessagingController } from './messaging/messaging.controller.js';
import { PartnerController } from './partner/partner.controller.js';
import { PartnerService } from './partner/partner.service.js';
import { CasesService } from './school/cases.service.js';
import { SchoolConfigController } from './school/school-config.controller.js';
import { SchoolLifeController } from './school/school-life.controller.js';
import { SchoolSubscriptionController } from './school/school-subscription.controller.js';
import { SchoolUsersController } from './school/school-users.controller.js';
import { SchoolPolicy } from './school/school.policy.js';

export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET est obligatoire en production.');
  return 'dev-only-secret-change-me';
}

@Global()
@Module({
  imports: [DbModule, JwtModule.register({ global: true, secret: jwtSecret(), signOptions: { expiresIn: '12h' } })],
  controllers: [
    HealthController, AuthController, DashboardController,
    SchoolUsersController, SchoolConfigController, SchoolLifeController, SchoolSubscriptionController,
    StudentController, ParentController, TeacherController, AccountController, MessagingController,
    AgentController, PartnerController, AdminController,
  ],
  providers: [
    AuthService, SmsGateway, CasesService, SchoolPolicy, PartnerService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_PIPE, useValue: new StandardSchemaValidationPipe() },
  ],
})
export class AppModule {}
