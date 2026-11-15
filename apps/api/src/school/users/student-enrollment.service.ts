import { ConflictException, Inject, NotFoundException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DB, type Db } from '../../db/db.module.js';
import { isUniqueViolation } from '../../db/errors.js';
import { AccountsService } from '../../accounts/accounts.service.js';
import { classes, students } from '../../db/schema.js';
import { code } from './school-users.shared.js';
import { Injectable } from '@nestjs/common';

@Injectable()
export class StudentEnrollmentService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly accounts: AccountsService,
  ) {}

  /** Fiche élève + compte (sans mot de passe, à activer par SMS) dans une même transaction ; le numéro est celui de l'élève. */
  async insertStudent(
    schoolId: string,
    v: { firstName: string; lastName: string; classId: string; phone: string },
    smsSent: boolean,
  ) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const row = await this.db.transaction(async (tx) => {
          const account = await this.accounts.create(
            {
              role: 'eleve',
              name: `${v.firstName} ${v.lastName}`,
              phone: v.phone,
              schoolId,
              title: 'Élève',
            },
            tx,
          );
          const r = {
            id: randomUUID(),
            schoolId,
            ...v,
            userId: account.id,
            code: code(),
            activated: false,
            smsSent,
          };
          await tx.insert(students).values(r);
          await tx
            .update(classes)
            .set({ studentCount: sql`${classes.studentCount} + 1` })
            .where(
              and(eq(classes.id, v.classId), eq(classes.schoolId, schoolId)),
            );
          return { r, account };
        });
        if (smsSent) this.accounts.invite(row.account);
        return row.r;
      } catch (e) {
        if (!isUniqueViolation(e)) throw e; // code parent déjà pris : nouveau tirage (un numéro déjà utilisé est un 409 de AccountsService)
      }
    }
    throw new ConflictException('Impossible de générer un code parent unique.');
  }

  async student(id: string, sid: string) {
    const [s] = await this.db
      .select()
      .from(students)
      .where(and(eq(students.id, id), eq(students.schoolId, sid)));
    if (!s) throw new NotFoundException('Élève introuvable.');
    return s;
  }
}
