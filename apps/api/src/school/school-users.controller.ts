import { Body, Controller, Get, Inject, NotFoundException, Param, Post } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { formatCode, initials, inviteSchema, newStudentSchema, parseStudentCsv } from '@sge/shared';
import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { classes, linkRequests, studentParents, students, teachers } from '../db/schema.js';
import { SchoolPolicy } from './school.policy.js';

const csvSchema = z.object({ csv: z.string().min(1) });
/** Code parent à 6 chiffres, unique : on retente en cas de collision (contrainte UNIQUE en base). */
const code = () => String(randomInt(100000, 1000000));

@Roles('etablissement')
@Controller('school')
export class SchoolUsersController {
  constructor(@Inject(DB) private readonly db: Db, private readonly policy: SchoolPolicy) {}

  private async insertStudent(v: { firstName: string; lastName: string; classId: string; phone: string }, smsSent: boolean) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const row = { id: randomUUID(), ...v, code: code(), activated: false, smsSent };
        await this.db.transaction(async (tx) => {
          await tx.insert(students).values(row);
          await tx.update(classes).set({ studentCount: sql`${classes.studentCount} + 1` }).where(eq(classes.id, v.classId));
        });
        return row;
      } catch (e) {
        if ((e as { code?: string }).code !== '23505') throw e; // code déjà pris : nouveau tirage
      }
    }
    throw new Error('Impossible de générer un code parent unique.');
  }

  @Get('students')
  async students() {
    const rows = await this.db.select({ s: students, className: classes.name }).from(students).innerJoin(classes, eq(classes.id, students.classId)).orderBy(students.lastName, students.firstName);
    const parents = await this.db.select().from(studentParents).orderBy(studentParents.id);
    return rows.map(({ s, className }) => ({
      ...s, className, codeLabel: formatCode(s.code), initials: initials(`${s.firstName} ${s.lastName}`),
      parents: parents.filter((p) => p.studentId === s.id).map((p) => ({ name: p.name, relation: p.relation })),
    }));
  }

  /** §7.5 — création manuelle : l'élève reçoit un SMS d'activation (formule Standard et plus). */
  @Post('students')
  async createStudent(@Body({ schema: newStudentSchema }) body: z.infer<typeof newStudentSchema>) {
    await this.policy.assertWritable();
    const [cls] = await this.db.select({ id: classes.id }).from(classes).where(eq(classes.id, body.classId));
    if (!cls) throw new NotFoundException('Classe introuvable.');
    const sms = (await this.policy.features()).sms;
    const student = await this.insertStudent(body, sms);
    return { student, smsSent: sms };
  }

  private async student(id: string) {
    const [s] = await this.db.select().from(students).where(eq(students.id, id));
    if (!s) throw new NotFoundException('Élève introuvable.');
    return s;
  }

  @Post('students/:id/regenerate-code')
  async regenerate(@Param('id') id: string) {
    await this.policy.assertWritable();
    await this.student(id);
    const next = code();
    await this.db.update(students).set({ code: next }).where(eq(students.id, id));
    return { code: next, codeLabel: formatCode(next) };
  }

  @Post('students/:id/send-code')
  async sendCode(@Param('id') id: string) {
    await this.policy.require('sms');
    await this.student(id);
    return { sent: true };
  }

  private async classNames() {
    return (await this.db.select({ name: classes.name }).from(classes)).map((c) => c.name);
  }

  @Post('students/import/preview')
  async preview(@Body({ schema: csvSchema }) body: { csv: string }) {
    const { rows, missingColumns } = parseStudentCsv(body.csv, await this.classNames());
    return { missingColumns, rows, valid: rows.filter((r) => !r.error).length, errors: rows.filter((r) => r.error).length };
  }

  @Post('students/import/confirm')
  async confirm(@Body({ schema: csvSchema }) body: { csv: string }) {
    await this.policy.assertWritable();
    const all = await this.db.select().from(classes);
    const { rows } = parseStudentCsv(body.csv, all.map((c) => c.name));
    const valid = rows.filter((r) => !r.error);
    const sms = (await this.policy.features()).sms;
    for (const r of valid) {
      await this.insertStudent({ firstName: r.prenom, lastName: r.nom, phone: r.phone, classId: all.find((c) => c.name.toLowerCase() === r.classe.toLowerCase())!.id }, sms);
    }
    return { imported: valid.length, skipped: rows.length - valid.length };
  }

  @Get('teachers')
  teachers() {
    return this.db.select().from(teachers).orderBy(teachers.id);
  }

  @Post('teachers/invite')
  async invite(@Body({ schema: inviteSchema }) body: z.infer<typeof inviteSchema>) {
    await this.policy.assertWritable();
    await this.policy.require('sms');
    const [teacher] = await this.db.insert(teachers).values({ id: randomUUID(), name: body.name, phone: `+241 ${body.phone}`, assignments: '', status: 'Invitation envoyée' }).returning();
    return teacher;
  }

  @Post('teachers/:id/resend')
  async resend(@Param('id') id: string) {
    await this.policy.assertWritable();
    const [t] = await this.db.update(teachers).set({ status: 'Invitation envoyée' }).where(eq(teachers.id, id)).returning();
    if (!t) throw new NotFoundException();
    return t;
  }

  @Get('link-requests')
  linkRequests() {
    return this.db.select().from(linkRequests).orderBy(linkRequests.id);
  }

  @Post('link-requests/:id/:decision')
  async decide(@Param('id') id: string, @Param('decision') decision: string) {
    await this.policy.assertWritable();
    if (!['accept', 'refuse'].includes(decision)) throw new NotFoundException();
    const [r] = await this.db.update(linkRequests).set({ decision: decision === 'accept' ? 'ok' : 'no' }).where(eq(linkRequests.id, id)).returning();
    if (!r) throw new NotFoundException();
    return r;
  }
}
