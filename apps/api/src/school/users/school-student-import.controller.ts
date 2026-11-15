import {
  Body,
  ConflictException,
  Controller,
  Inject,
  Post,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { parseStudentCsv } from '@sge/shared';
import { z } from 'zod';
import {
  CurrentUser,
  Roles,
  schoolOf,
  type AuthUser,
} from '../../common/auth.js';
import { DB, type Db } from '../../db/db.module.js';
import { classes } from '../../db/schema.js';
import { SchoolPolicy } from '../school.policy.js';
import { StudentEnrollmentService } from './student-enrollment.service.js';

const csvSchema = z.object({ csv: z.string().min(1) });

/** Import d'élèves par fichier CSV : vérification puis création des comptes (§7.5). */
@Roles('etablissement')
@Controller('school')
export class SchoolStudentImportController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly policy: SchoolPolicy,
    private readonly enrollment: StudentEnrollmentService,
  ) {}

  @Post('students/import/preview')
  async preview(
    @CurrentUser() user: AuthUser,
    @Body({ schema: csvSchema }) body: { csv: string },
  ) {
    const names = (
      await this.db
        .select({ name: classes.name })
        .from(classes)
        .where(eq(classes.schoolId, schoolOf(user)))
    ).map((c) => c.name);
    const { rows, missingColumns } = parseStudentCsv(body.csv, names);
    return {
      missingColumns,
      rows,
      valid: rows.filter((r) => !r.error).length,
      errors: rows.filter((r) => r.error).length,
    };
  }

  @Post('students/import/confirm')
  async confirm(
    @CurrentUser() user: AuthUser,
    @Body({ schema: csvSchema }) body: { csv: string },
  ) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    const all = await this.db
      .select()
      .from(classes)
      .where(eq(classes.schoolId, sid));
    const { rows } = parseStudentCsv(
      body.csv,
      all.map((c) => c.name),
    );
    const valid = rows.filter((r) => !r.error);
    const sms = (await this.policy.features(sid)).sms;
    const skipped = rows
      .filter((r) => r.error)
      .map((r) => ({ line: r.line, reason: r.error! }));
    let imported = 0;
    for (const r of valid) {
      try {
        await this.enrollment.insertStudent(
          sid,
          {
            firstName: r.prenom,
            lastName: r.nom,
            phone: r.phone,
            classId: all.find(
              (c) => c.name.toLowerCase() === r.classe.toLowerCase(),
            )!.id,
          },
          sms,
        );
        imported++;
      } catch (e) {
        if (!(e instanceof ConflictException)) throw e;
        skipped.push({
          line: r.line,
          reason: 'Numéro déjà utilisé par un autre compte',
        });
      }
    }
    return { imported, skipped: skipped.length, skippedRows: skipped };
  }
}
