import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { classInputSchema, schoolYearSchema } from '@sge/shared';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { StoreService } from '../common/store.service.js';
import { SchoolPolicy } from './school.policy.js';

const assignmentSchema = z.object({
  teacher: z.string().min(1), className: z.string().min(1), subject: z.string().min(1),
  year: z.string().min(1), principal: z.boolean().default(false),
});

@Roles('etablissement')
@Controller('school')
export class SchoolConfigController {
  constructor(private readonly store: StoreService, private readonly policy: SchoolPolicy) {}

  @Get('year')
  year() {
    return this.store.year;
  }

  /** §7.2 — le libellé, les dates et les trimestres (avec coefficients) ; l'année n'est visible qu'une fois activée. */
  @Put('year')
  saveYear(@Body({ schema: schoolYearSchema }) body: z.infer<typeof schoolYearSchema>) {
    this.policy.assertWritable();
    this.store.year = { ...this.store.year, ...body, active: false };
    return this.store.year;
  }

  @Post('year/activate')
  activate() {
    this.policy.assertWritable();
    this.store.year.active = true;
    return this.store.year;
  }

  @Get('classes')
  classes() {
    return this.store.classes;
  }

  @Post('classes')
  createClass(@Body({ schema: classInputSchema }) body: z.infer<typeof classInputSchema>) {
    this.policy.assertWritable();
    const created = { id: `c${this.store.classes.length + 1}`, name: body.name, level: body.level, capacity: body.capacity, students: 0, completion: 0 };
    this.store.classes.push(created);
    return created;
  }

  @Get('assignments')
  assignments() {
    return this.store.assignments;
  }

  @Post('assignments')
  assign(@Body({ schema: assignmentSchema }) body: z.infer<typeof assignmentSchema>) {
    this.policy.assertWritable();
    const created = { id: `a${this.store.assignments.length + 1}`, ...body };
    this.store.assignments.push(created);
    return created;
  }
}
