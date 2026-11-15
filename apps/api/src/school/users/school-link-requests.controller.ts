import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import {
  CurrentUser,
  Roles,
  schoolOf,
  type AuthUser,
} from '../../common/auth.js';
import { DB, type Db } from '../../db/db.module.js';
import { linkRequests, studentParents } from '../../db/schema.js';
import { SchoolPolicy } from '../school.policy.js';

/** Demandes de rattachement des parents : acceptation ou refus par l'école. */
@Roles('etablissement')
@Controller('school')
export class SchoolLinkRequestsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly policy: SchoolPolicy,
  ) {}

  @Get('link-requests')
  linkRequests(@CurrentUser() user: AuthUser) {
    return this.db
      .select()
      .from(linkRequests)
      .where(eq(linkRequests.schoolId, schoolOf(user)))
      .orderBy(linkRequests.id);
  }

  @Post('link-requests/:id/:decision')
  async decide(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('decision') decision: string,
  ) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    if (!['accept', 'refuse'].includes(decision)) throw new NotFoundException();
    return this.db.transaction(async (tx) => {
      const [r] = await tx
        .update(linkRequests)
        .set({ decision: decision === 'accept' ? 'ok' : 'no' })
        .where(
          and(
            eq(linkRequests.id, id),
            eq(linkRequests.schoolId, sid),
            isNull(linkRequests.decision),
          ),
        )
        .returning();
      if (!r) throw new NotFoundException();
      // Validation : le parent voit désormais l'enfant dans son application (la limite de 2 parents est levée par l'école).
      if (decision === 'accept' && r.studentId && r.parentUserId) {
        await tx
          .insert(studentParents)
          .values({
            studentId: r.studentId,
            name: r.parent,
            relation: r.relation,
            parentUserId: r.parentUserId,
          })
          .onConflictDoNothing();
      }
      return r;
    });
  }
}
