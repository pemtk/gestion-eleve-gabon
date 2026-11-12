import { Controller, Get, Header, Query } from '@nestjs/common';
import { DASHBOARDS, PRIVACY_THRESHOLD } from '@sge/shared';
import { Roles } from '../common/auth.js';
import { PartnerService, type Level } from './partner.service.js';

@Roles('partenaire')
@Controller('partner')
export class PartnerController {
  constructor(private readonly partner: PartnerService) {}

  @Get('indicators')
  indicators() {
    return { threshold: PRIVACY_THRESHOLD, kpis: DASHBOARDS.partenaire.kpis, chart: DASHBOARDS.partenaire.chart };
  }

  @Get('provinces')
  provinces(@Query('region') region = 'Toutes', @Query('level') level: Level = 'Tous') {
    return { threshold: PRIVACY_THRESHOLD, rows: this.partner.provinces(region, level) };
  }

  @Get('reports')
  reports() {
    return { threshold: PRIVACY_THRESHOLD, rows: this.partner.reports() };
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  export() {
    return this.partner.exportCsv();
  }
}
