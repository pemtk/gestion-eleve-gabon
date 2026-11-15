import { type DashboardData } from '@sge/shared';

export type DashboardBody = Pick<
  DashboardData,
  'kpis' | 'chart' | 'side' | 'table'
>;
