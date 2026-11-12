import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { formatCode, initials, inviteSchema, newStudentSchema, parseStudentCsv, type Student } from '@sge/shared';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { StoreService } from '../common/store.service.js';
import { SchoolPolicy } from './school.policy.js';

const csvSchema = z.object({ csv: z.string().min(1) });
const code = () => String(randomInt(100000, 1000000));

@Roles('etablissement')
@Controller('school')
export class SchoolUsersController {
  constructor(private readonly store: StoreService, private readonly policy: SchoolPolicy) {}

  private student(id: string): Student {
    const s = this.store.students.find((x) => x.id === id);
    if (!s) throw new NotFoundException('Élève introuvable.');
    return s;
  }

  @Get('students')
  students() {
    return this.store.students.map((s) => ({
      ...s,
      className: this.store.classes.find((c) => c.id === s.classId)?.name ?? s.classId,
      codeLabel: formatCode(s.code),
      initials: initials(`${s.firstName} ${s.lastName}`),
    }));
  }

  /** §7.5 — création manuelle : l'élève reçoit un SMS d'activation (formule Standard et plus). */
  @Post('students')
  createStudent(@Body({ schema: newStudentSchema }) body: z.infer<typeof newStudentSchema>) {
    this.policy.assertWritable();
    const student: Student = {
      id: `s${this.store.students.length + 1}`, firstName: body.firstName, lastName: body.lastName, classId: body.classId,
      phone: body.phone, code: code(), parents: [], activated: false, smsSent: this.policy.features.sms,
    };
    this.store.students.push(student);
    return { student, smsSent: this.policy.features.sms };
  }

  @Post('students/:id/regenerate-code')
  regenerate(@Param('id') id: string) {
    this.policy.assertWritable();
    const s = this.student(id);
    s.code = code();
    return { code: s.code, codeLabel: formatCode(s.code) };
  }

  @Post('students/:id/send-code')
  sendCode(@Param('id') id: string) {
    this.policy.require('sms');
    this.student(id);
    return { sent: true };
  }

  @Post('students/import/preview')
  preview(@Body({ schema: csvSchema }) body: { csv: string }) {
    const { rows, missingColumns } = parseStudentCsv(body.csv, this.store.classes.map((c) => c.name));
    return { missingColumns, rows, valid: rows.filter((r) => !r.error).length, errors: rows.filter((r) => r.error).length };
  }

  @Post('students/import/confirm')
  confirm(@Body({ schema: csvSchema }) body: { csv: string }) {
    this.policy.assertWritable();
    const { rows } = parseStudentCsv(body.csv, this.store.classes.map((c) => c.name));
    const valid = rows.filter((r) => !r.error);
    for (const r of valid) {
      this.store.students.push({
        id: `s${this.store.students.length + 1}`, firstName: r.prenom, lastName: r.nom, classId: this.store.classes.find((c) => c.name.toLowerCase() === r.classe.toLowerCase())!.id,
        phone: r.phone, code: code(), parents: [], activated: false, smsSent: this.policy.features.sms,
      });
    }
    return { imported: valid.length, skipped: rows.length - valid.length };
  }

  @Get('teachers')
  teachers() {
    return this.store.teachers;
  }

  @Post('teachers/invite')
  invite(@Body({ schema: inviteSchema }) body: z.infer<typeof inviteSchema>) {
    this.policy.assertWritable();
    this.policy.require('sms');
    const teacher = { id: `t${this.store.teachers.length + 1}`, name: body.name, phone: `+241 ${body.phone}`, assignments: '', status: 'Invitation envoyée' as const };
    this.store.teachers.push(teacher);
    return teacher;
  }

  @Post('teachers/:id/resend')
  resend(@Param('id') id: string) {
    this.policy.assertWritable();
    const t = this.store.teachers.find((x) => x.id === id);
    if (!t) throw new NotFoundException();
    t.status = 'Invitation envoyée';
    return t;
  }

  @Get('link-requests')
  linkRequests() {
    return this.store.linkRequests;
  }

  @Post('link-requests/:id/:decision')
  decide(@Param('id') id: string, @Param('decision') decision: string) {
    this.policy.assertWritable();
    const r = this.store.linkRequests.find((x) => x.id === id);
    if (!r || !['accept', 'refuse'].includes(decision)) throw new NotFoundException();
    r.decision = decision === 'accept' ? 'ok' : 'no';
    return r;
  }
}
