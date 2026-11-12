import { Body, Controller, Get, Inject, Post, Put } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { classInputSchema, schoolYearSchema } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { assignments, classes, schoolYears } from '../db/schema.js';
import { SchoolPolicy } from './school.policy.js';

const assignmentSchema = z.object({
  teacher: z.string().min(1), className: z.string().min(1), subject: z.string().min(1),
  year: z.string().min(1), principal: z.boolean().default(false),
});

@Roles('etablissement')
@Controller('school')
export class SchoolConfigController {
  constructor(@Inject(DB) private readonly db: Db, private readonly policy: SchoolPolicy) {}

  @Get('year')
  async year() {
    const [y] = await this.db.select().from(schoolYears).where(eq(schoolYears.id, 'current'));
    return y;
  }

  /** §7.2 — le libellé, les dates et les trimestres (avec coefficients) ; l'année n'est visible qu'une fois activée. */
  @Put('year')
  async saveYear(@Body({ schema: schoolYearSchema }) body: z.infer<typeof schoolYearSchema>) {
    await this.policy.assertWritable();
    const [y] = await this.db.update(schoolYears).set({ ...body, active: false }).where(eq(schoolYears.id, 'current')).returning();
    return y;
  }

  @Post('year/activate')
  async activate() {
    await this.policy.assertWritable();
    const [y] = await this.db.update(schoolYears).set({ active: true }).where(eq(schoolYears.id, 'current')).returning();
    return y;
  }

  @Get('classes')
  async classes() {
    const rows = await this.db.select().from(classes).orderBy(classes.id);
    return rows.map(({ studentCount, ...c }) => ({ ...c, students: studentCount }));
  }

  @Post('classes')
  async createClass(@Body({ schema: classInputSchema }) body: z.infer<typeof classInputSchema>) {
    await this.policy.assertWritable();
    const [c] = await this.db.insert(classes).values({ id: randomUUID(), name: body.name, level: body.level, capacity: body.capacity }).returning();
    return { ...c, students: 0 };
  }

  @Get('assignments')
  assignments() {
    return this.db.select().from(assignments).orderBy(assignments.id);
  }

  @Post('assignments')
  async assign(@Body({ schema: assignmentSchema }) body: z.infer<typeof assignmentSchema>) {
    await this.policy.assertWritable();
    const [a] = await this.db.insert(assignments).values({ id: randomUUID(), ...body }).returning();
    return a;
  }
}
