import { SCHOOL_YEAR } from '@sge/shared';

export type Year = typeof SCHOOL_YEAR;

export type Assignment = {
  id: string;
  teacherId: string;
  classId: string;
  teacher: string;
  className: string;
  subject: string;
  year: string;
  principal: boolean;
};
