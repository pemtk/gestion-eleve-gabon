import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { IndicatorsService } from './indicators/indicators.service.js';
import {
  FilesController,
  PayloadTooLargeFilter,
} from './files/files.controller.js';
import { FilesService } from './files/files.service.js';
import { AuditController } from './audit/audit.controller.js';
import { AuditService } from './audit/audit.service.js';
import { AccountsService } from './accounts/accounts.service.js';
import { AgentController } from './agent/agent.controller.js';
import { AuthController } from './auth/auth.controller.js';
import {
  ACCESS_TTL_SECONDS,
  RefreshTokens,
} from './auth/refresh-tokens.service.js';
import { RateLimiter } from './common/rate-limiter.js';
import { SmsGateway } from './auth/sms.gateway.js';
import { AuthGuard, RolesGuard } from './common/auth.js';
import { DbModule } from './db/db.module.js';
import { DashboardController } from './dashboard/dashboard.controller.js';
import { HealthController } from './health.controller.js';
import { AccountController } from './learning/account.controller.js';
import { GamificationService } from './learning/gamification.service.js';
import { StudentController } from './learning/student.controller.js';
import { TeacherRosterService } from './learning/teacher/teacher-roster.service.js';
import { TeacherClassesController } from './learning/teacher/teacher-classes.controller.js';
import { TeacherAttendanceController } from './learning/teacher/teacher-attendance.controller.js';
import { TeacherTasksController } from './learning/teacher/teacher-tasks.controller.js';
import { TeacherGradesController } from './learning/teacher/teacher-grades.controller.js';
import { TeacherReportsController } from './learning/teacher/teacher-reports.controller.js';
import { TeacherAnnouncementsController } from './learning/teacher/teacher-announcements.controller.js';
import { SchoolAbsencesController } from './school/life/school-absences.controller.js';
import { SchoolResultsController } from './school/life/school-results.controller.js';
import { SchoolAnnouncementsController } from './school/life/school-announcements.controller.js';
import { SchoolCasesController } from './school/life/school-cases.controller.js';
import { StudentEnrollmentService } from './school/users/student-enrollment.service.js';
import { SchoolStudentsController } from './school/users/school-students.controller.js';
import { SchoolStudentImportController } from './school/users/school-student-import.controller.js';
import { SchoolTeachersController } from './school/users/school-teachers.controller.js';
import { SchoolLinkRequestsController } from './school/users/school-link-requests.controller.js';
import { ParentChildrenService } from './learning/parent/parent-children.service.js';
import { ParentChildrenController } from './learning/parent/parent-children.controller.js';
import { ParentAlertsController } from './learning/parent/parent-alerts.controller.js';
import { ParentRewardsController } from './learning/parent/parent-rewards.controller.js';
import { AdminOrganizationsController } from './admin/admin-organizations.controller.js';
import { AdminSubscriptionsController } from './admin/admin-subscriptions.controller.js';
import { AdminUsersController } from './admin/admin-users.controller.js';
import { AdminOversightController } from './admin/admin-oversight.controller.js';
import { ConversationGroupsService } from './messaging/conversation-groups.service.js';
import { ConversationAccessService } from './messaging/conversation-access.service.js';
import { ConversationUnreadService } from './messaging/conversation-unread.service.js';
import { ConversationThreadsService } from './messaging/conversation-threads.service.js';
import { ConversationMessagesService } from './messaging/conversation-messages.service.js';
import { ConversationContactsService } from './messaging/conversation-contacts.service.js';
import { SchoolDashboardService } from './dashboard/school-dashboard.service.js';
import { AgentDashboardService } from './dashboard/agent-dashboard.service.js';
import { NetworkDashboardService } from './dashboard/network-dashboard.service.js';
import { AdminDashboardService } from './dashboard/admin-dashboard.service.js';
import { UserLookupService } from './auth/user-lookup.service.js';
import { AuthThrottleService } from './auth/auth-throttle.service.js';
import { OtpService } from './auth/otp.service.js';
import { AuthSessionService } from './auth/auth-session.service.js';
import { PasswordService } from './auth/password.service.js';
import { AuthService } from './auth/authentication.service.js';
import { ConversationsController } from './messaging/conversations.controller.js';
import { NavController } from './nav/nav.controller.js';
import { NavService } from './nav/nav.service.js';
import { MessagingController } from './messaging/messaging.controller.js';
import { PartnerController } from './partner/partner.controller.js';
import { PartnerService } from './partner/partner.service.js';
import { CasesService } from './school/cases.service.js';
import { SchoolConfigController } from './school/school-config.controller.js';
import { SchoolSubscriptionController } from './school/school-subscription.controller.js';
import { SchoolPolicy } from './school/school.policy.js';

export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production')
    throw new Error('JWT_SECRET est obligatoire en production.');
  return 'dev-only-secret-change-me';
}

@Global()
@Module({
  imports: [
    DbModule,
    JwtModule.register({
      global: true,
      secret: jwtSecret(),
      signOptions: { expiresIn: ACCESS_TTL_SECONDS },
    }),
  ],
  controllers: [
    HealthController,
    AuthController,
    DashboardController,
    SchoolStudentsController,
    SchoolStudentImportController,
    SchoolTeachersController,
    SchoolLinkRequestsController,
    SchoolConfigController,
    SchoolAbsencesController,
    SchoolResultsController,
    SchoolAnnouncementsController,
    SchoolCasesController,
    SchoolSubscriptionController,
    StudentController,
    ParentChildrenController,
    ParentAlertsController,
    ParentRewardsController,
    TeacherClassesController,
    TeacherAttendanceController,
    TeacherTasksController,
    TeacherGradesController,
    TeacherReportsController,
    TeacherAnnouncementsController,
    AccountController,
    MessagingController,
    ConversationsController,
    NavController,
    AgentController,
    PartnerController,
    AdminOrganizationsController,
    AdminSubscriptionsController,
    AdminUsersController,
    AdminOversightController,
    AuditController,
    FilesController,
  ],
  providers: [
    GamificationService,
    UserLookupService,
    AuthThrottleService,
    OtpService,
    AuthSessionService,
    PasswordService,
    AuthService,
    SmsGateway,
    AccountsService,
    IndicatorsService,
    SchoolDashboardService,
    AgentDashboardService,
    NetworkDashboardService,
    AdminDashboardService,
    RateLimiter,
    RefreshTokens,
    AuditService,
    FilesService,
    TeacherRosterService,
    StudentEnrollmentService,
    ParentChildrenService,
    ConversationGroupsService,
    ConversationAccessService,
    ConversationUnreadService,
    ConversationThreadsService,
    ConversationMessagesService,
    ConversationContactsService,
    NavService,
    CasesService,
    SchoolPolicy,
    PartnerService,
    { provide: APP_FILTER, useClass: PayloadTooLargeFilter },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_PIPE, useValue: new StandardSchemaValidationPipe() },
  ],
})
export class AppModule {}
