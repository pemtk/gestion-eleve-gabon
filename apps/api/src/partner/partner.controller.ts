import { Controller, Get, Header, Query } from '@nestjs/common';
import { PRIVACY_THRESHOLD } from '@sge/shared';
import { Roles } from '../common/auth.js';
import { PartnerService } from './partner.service.js';

@Roles('partenaire')
@Controller('partner')
export class PartnerController {
  constructor(private readonly partner: PartnerService) {}

  @Get('indicators')
  async indicators() {
    return { threshold: PRIVACY_THRESHOLD, ...(await this.partner.nationalIndicators()) };
  }

  @Get('provinces')
  async provinces(@Query('region') region = 'Toutes', @Query('level') level = 'Tous') {
    return { threshold: PRIVACY_THRESHOLD, rows: await this.partner.provinces(region, level) };
  }

  @Get('reports')
  async reports() {
    return { threshold: PRIVACY_THRESHOLD, rows: await this.partner.reports() };
  }

  /** `?dataset=provinces` pour le tableau par région ; par défaut, les signalements par type et statut. */
  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  export(@Query('dataset') dataset?: string) {
    return this.partner.exportCsv(dataset === 'provinces' ? 'provinces' : 'signalements');
  }
}
