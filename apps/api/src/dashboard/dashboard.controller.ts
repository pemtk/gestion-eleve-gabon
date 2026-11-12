import { Controller, ForbiddenException, Get, Inject, Param } from '@nestjs/common';
import { DASHBOARDS, NETWORK_DASHBOARD, ROLE_OF_SPACE, WEB_NAV, planHas, type WebSpace } from '@sge/shared';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { getSetting } from '../db/settings.js';

/**
 * Les indicateurs agrégés (taux, volumes) sont ceux du jeu de démonstration : le calcul à partir des
 * données réelles (activité des élèves, présences…) reste à brancher quand les volumes le justifient.
 */
@Controller('dashboard')
export class DashboardController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Un profil ne voit que son propre espace ; les tableaux avancés dépendent de la formule (écoles). */
  @Get(':space')
  async dashboard(@CurrentUser() user: AuthUser, @Param('space') space: WebSpace) {
    if (!(space in DASHBOARDS) || ROLE_OF_SPACE[space] !== user.role) throw new ForbiddenException('Cet espace n’est pas accessible avec votre profil.');
    const data = DASHBOARDS[space];
    const nav = WEB_NAV[space];
    if (space !== 'ecole') return { ...data, nav, statsLocked: false };
    const { plan, suspended } = await getSetting(this.db, 'subscription');
    return { ...data, nav, plan, suspended, statsLocked: !planHas(plan).stats };
  }

  @Get('ecole/network')
  async network(@CurrentUser() user: AuthUser) {
    if (user.role !== 'etablissement') throw new ForbiddenException();
    if (!planHas((await getSetting(this.db, 'subscription')).plan).network) {
      throw new ForbiddenException({ code: 'PLAN_REQUIRED', feature: 'network', message: 'La vue réseau n’est pas incluse dans votre formule.' });
    }
    return { ...DASHBOARDS.ecole, ...NETWORK_DASHBOARD, nav: WEB_NAV.ecole };
  }
}
