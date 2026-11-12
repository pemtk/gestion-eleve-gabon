import { Body, ConflictException, Controller, Get, Inject, NotFoundException, Param, Post } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { formatCode, initials, inviteSchema, newStudentSchema, parseStudentCsv } from '@sge/shared';
import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CurrentUser, Roles, schoolOf, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { isUniqueViolation } from '../db/errors.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { assignments, classes, linkRequests, studentParents, students, teachers, users } from '../db/schema.js';
import { SchoolPolicy } from './school.policy.js';

const csvSchema = z.object({ csv: z.string().min(1) });
/** Code parent à 6 chiffres, unique sur toute la plateforme : on retente en cas de collision (contrainte UNIQUE). */
const code = () => String(randomInt(100000, 1000000));

@Roles('etablissement')
@Controller('school')
export class SchoolUsersController {
  constructor(@Inject(DB) private readonly db: Db, private readonly policy: SchoolPolicy, private readonly accounts: AccountsService) {}

  /** Fiche élève + compte (sans mot de passe, à activer par SMS) dans une même transaction ; le numéro est celui de l'élève. */
  private async insertStudent(schoolId: string, v: { firstName: string; lastName: string; classId: string; phone: string }, smsSent: boolean) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const row = await this.db.transaction(async (tx) => {
          const account = await this.accounts.create({ role: 'eleve', name: `${v.firstName} ${v.lastName}`, phone: v.phone, schoolId, title: 'Élève' }, tx);
          const r = { id: randomUUID(), schoolId, ...v, userId: account.id, code: code(), activated: false, smsSent };
          await tx.insert(students).values(r);
          await tx.update(classes).set({ studentCount: sql`${classes.studentCount} + 1` }).where(and(eq(classes.id, v.classId), eq(classes.schoolId, schoolId)));
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

  @Get('students')
  async students(@CurrentUser() user: AuthUser) {
    const sid = schoolOf(user);
    const rows = await this.db.select({ s: students, className: classes.name }).from(students).innerJoin(classes, eq(classes.id, students.classId)).where(eq(students.schoolId, sid)).orderBy(students.lastName, students.firstName);
    const parents = await this.db.select({ p: studentParents }).from(studentParents).innerJoin(students, eq(students.id, studentParents.studentId)).where(eq(students.schoolId, sid)).orderBy(studentParents.id);
    return rows.map(({ s, className }) => ({
      ...s, className, codeLabel: formatCode(s.code), initials: initials(`${s.firstName} ${s.lastName}`),
      parents: parents.filter(({ p }) => p.studentId === s.id).map(({ p }) => ({ name: p.name, relation: p.relation })),
    }));
  }

  /** §7.5 — création manuelle : l'élève reçoit un SMS d'activation (formule Standard et plus). */
  @Post('students')
  async createStudent(@CurrentUser() user: AuthUser, @Body({ schema: newStudentSchema }) body: z.infer<typeof newStudentSchema>) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    const [cls] = await this.db.select({ id: classes.id }).from(classes).where(and(eq(classes.id, body.classId), eq(classes.schoolId, sid)));
    if (!cls) throw new NotFoundException('Classe introuvable.');
    const sms = (await this.policy.features(sid)).sms;
    const student = await this.insertStudent(sid, body, sms);
    return { student, smsSent: sms };
  }

  private async student(id: string, sid: string) {
    const [s] = await this.db.select().from(students).where(and(eq(students.id, id), eq(students.schoolId, sid)));
    if (!s) throw new NotFoundException('Élève introuvable.');
    return s;
  }

  @Post('students/:id/regenerate-code')
  async regenerate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    await this.student(id, sid);
    const next = code();
    await this.db.update(students).set({ code: next }).where(and(eq(students.id, id), eq(students.schoolId, sid)));
    return { code: next, codeLabel: formatCode(next) };
  }

  @Post('students/:id/send-code')
  async sendCode(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const sid = schoolOf(user);
    await this.policy.require(sid, 'sms');
    const st = await this.student(id, sid);
    const [account] = st.userId ? await this.db.select().from(users).where(eq(users.id, st.userId)) : [];
    if (account && !account.activated) this.accounts.invite(account);
    return { sent: true };
  }

  @Post('students/import/preview')
  async preview(@CurrentUser() user: AuthUser, @Body({ schema: csvSchema }) body: { csv: string }) {
    const names = (await this.db.select({ name: classes.name }).from(classes).where(eq(classes.schoolId, schoolOf(user)))).map((c) => c.name);
    const { rows, missingColumns } = parseStudentCsv(body.csv, names);
    return { missingColumns, rows, valid: rows.filter((r) => !r.error).length, errors: rows.filter((r) => r.error).length };
  }

  @Post('students/import/confirm')
  async confirm(@CurrentUser() user: AuthUser, @Body({ schema: csvSchema }) body: { csv: string }) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    const all = await this.db.select().from(classes).where(eq(classes.schoolId, sid));
    const { rows } = parseStudentCsv(body.csv, all.map((c) => c.name));
    const valid = rows.filter((r) => !r.error);
    const sms = (await this.policy.features(sid)).sms;
    const skipped = rows.filter((r) => r.error).map((r) => ({ line: r.line, reason: r.error! }));
    let imported = 0;
    for (const r of valid) {
      try {
        await this.insertStudent(sid, { firstName: r.prenom, lastName: r.nom, phone: r.phone, classId: all.find((c) => c.name.toLowerCase() === r.classe.toLowerCase())!.id }, sms);
        imported++;
      } catch (e) {
        if (!(e instanceof ConflictException)) throw e;
        skipped.push({ line: r.line, reason: 'Numéro déjà utilisé par un autre compte' });
      }
    }
    return { imported, skipped: skipped.length, skippedRows: skipped };
  }

  /** Enseignants de l'école ; la colonne « Affectations » est calculée (« Maths · 3ème B, 4ème A »). */
  @Get('teachers')
  async teachers(@CurrentUser() user: AuthUser) {
    const sid = schoolOf(user);
    const [rows, aff] = await Promise.all([
      this.db.select().from(teachers).where(eq(teachers.schoolId, sid)).orderBy(teachers.id),
      this.db.select({ a: assignments, className: classes.name }).from(assignments).innerJoin(classes, eq(classes.id, assignments.classId)).where(eq(assignments.schoolId, sid)).orderBy(classes.name),
    ]);
    return rows.map(({ userId: _u, ...t }) => {
      const bySubject = new Map<string, string[]>();
      for (const { a, className } of aff.filter(({ a }) => a.teacherId === t.id)) bySubject.set(a.subject, [...(bySubject.get(a.subject) ?? []), className]);
      return { ...t, assignments: [...bySubject.entries()].map(([subject, cls]) => `${subject} · ${cls.join(', ')}`).join(' ; ') };
    });
  }

  @Post('teachers/invite')
  async invite(@CurrentUser() user: AuthUser, @Body({ schema: inviteSchema }) body: z.infer<typeof inviteSchema>) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    await this.policy.require(sid, 'sms');
    const { teacher, account } = await this.db.transaction(async (tx) => {
      const account = await this.accounts.create({ role: 'enseignant', name: body.name, phone: body.phone, schoolId: sid, title: 'Enseignant' }, tx);
      const [teacher] = await tx.insert(teachers).values({ id: randomUUID(), schoolId: sid, userId: account.id, name: body.name, phone: `+241 ${account.phone}`, status: 'Invitation envoyée' }).returning();
      return { teacher: teacher!, account };
    });
    this.accounts.invite(account);
    const { userId: _u, ...rest } = teacher;
    return { ...rest, assignments: '' };
  }

  @Post('teachers/:id/resend')
  async resend(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    const [t] = await this.db.update(teachers).set({ status: 'Invitation envoyée' }).where(and(eq(teachers.id, id), eq(teachers.schoolId, sid))).returning();
    if (!t) throw new NotFoundException();
    const [account] = t.userId ? await this.db.select().from(users).where(eq(users.id, t.userId)) : [];
    if (account && !account.activated) this.accounts.invite(account);
    const { userId: _u, ...rest } = t;
    return { ...rest, assignments: '' };
  }

  @Get('link-requests')
  linkRequests(@CurrentUser() user: AuthUser) {
    return this.db.select().from(linkRequests).where(eq(linkRequests.schoolId, schoolOf(user))).orderBy(linkRequests.id);
  }

  @Post('link-requests/:id/:decision')
  async decide(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('decision') decision: string) {
    const sid = schoolOf(user);
    await this.policy.assertWritable(sid);
    if (!['accept', 'refuse'].includes(decision)) throw new NotFoundException();
    return this.db.transaction(async (tx) => {
      const [r] = await tx.update(linkRequests).set({ decision: decision === 'accept' ? 'ok' : 'no' }).where(and(eq(linkRequests.id, id), eq(linkRequests.schoolId, sid), isNull(linkRequests.decision))).returning();
      if (!r) throw new NotFoundException();
      // Validation : le parent voit désormais l'enfant dans son application (la limite de 2 parents est levée par l'école).
      if (decision === 'accept' && r.studentId && r.parentUserId) {
        await tx.insert(studentParents).values({ studentId: r.studentId, name: r.parent, relation: r.relation, parentUserId: r.parentUserId }).onConflictDoNothing();
      }
      return r;
    });
  }
}
