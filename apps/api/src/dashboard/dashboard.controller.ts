import { Controller, ForbiddenException, Get, Inject, Param } from '@nestjs/common';
import { DASHBOARDS, ROLE_OF_SPACE, WEB_NAV, planHas, type WebSpace } from '@sge/shared';
import { CurrentUser, schoolOf, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { getSubscription, schoolName } from '../db/subscription.js';
import { PartnerService } from '../partner/partner.service.js';
import { DashboardService, withBadges } from './dashboard.service.js';

/**
 * Les indicateurs sont calculés à partir des données réelles (comptes activés, tâches terminées, appels, notes, signalements) :
 * ils changent quand les données changent. Les libellés et la navigation viennent du paquet partagé, les chiffres de la base.
 */
@Controller('dashboard')
export class DashboardController {
  constructor(@Inject(DB) private readonly db: Db, private readonly dashboards: DashboardService, private readonly partner: PartnerService) {}

  /** Un profil ne voit que son propre espace ; les tableaux avancés dépendent de la formule (écoles). */
  @Get(':space')
  async dashboard(@CurrentUser() user: AuthUser, @Param('space') space: WebSpace) {
    if (!(space in DASHBOARDS) || ROLE_OF_SPACE[space] !== user.role) throw new ForbiddenException('Cet espace n’est pas accessible avec votre profil.');
    const data = DASHBOARDS[space];
    const nav = WEB_NAV[space];
    if (space === 'ecole') {
      const sid = schoolOf(user);
      const { plan, suspended } = await getSubscription(this.db, sid);
      const { body, badges } = await this.dashboards.school(sid);
      // L'en-tête porte le nom de l'établissement connecté (pas celui du jeu de démonstration).
      const head = { ...data.head, kicker: `${await schoolName(this.db, sid)} · année 2026–2027` };
      return { ...data, ...body, head, nav: withBadges(nav, badges), plan, suspended, statsLocked: !planHas(plan).stats };
    }
    if (space === 'agent') {
      const { body, kicker, badges } = await this.dashboards.agent(user.sub);
      return { ...data, ...body, head: { ...data.head, kicker }, nav: withBadges(nav, badges), statsLocked: false };
    }
    if (space === 'partenaire') {
      const national = await this.partner.nationalIndicators();
      const rows = await this.partner.reports();
      const table = { ...data.table, rows: rows.map((r) => [r.type, r.open === null ? 'masqué' : String(r.open), r.inProgress === null ? 'masqué' : String(r.inProgress), r.closed === null ? 'masqué' : String(r.closed)]) };
      return { ...data, ...national, table, nav: withBadges(nav, {}), statsLocked: false };
    }
    const { body, badges } = await this.dashboards.admin();
    return { ...data, ...body, nav: withBadges(nav, badges), statsLocked: false };
  }

  @Get('ecole/network')
  async network(@CurrentUser() user: AuthUser) {
    if (user.role !== 'etablissement') throw new ForbiddenException();
    const sid = schoolOf(user);
    if (!planHas((await getSubscription(this.db, sid)).plan).network) {
      throw new ForbiddenException({ code: 'PLAN_REQUIRED', feature: 'network', message: 'La vue réseau n’est pas incluse dans votre formule.' });
    }
    const { kicker, ...body } = await this.dashboards.network(sid);
    return { ...DASHBOARDS.ecole, ...body, head: { ...DASHBOARDS.ecole.head, kicker }, nav: WEB_NAV.ecole };
  }
}
