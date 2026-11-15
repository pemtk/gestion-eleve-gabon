import { Inject, Injectable } from '@nestjs/common';
import { eq, isNotNull, ne } from 'drizzle-orm';
import { WEB_NAV, WEB_SPACE_OF, type NavItem } from '@sge/shared';
import type { AuthUser } from '../common/auth.js';
import { DB, type Db } from '../db/db.module.js';
import { alertsOf } from '../dashboard/alerts.js';
import { incidents, orgSubscriptions, userScopes } from '../db/schema.js';
import { IndicatorsService } from '../indicators/indicators.service.js';
import { ConversationUnreadService } from '../messaging/conversation-unread.service.js';
import { schoolBadges } from '../school/badges.js';

/** Compteurs affichés dans la barre latérale, par adresse de menu. */
type Badges = Record<string, number>;

/**
 * Menu de chaque espace web avec ses pastilles réelles (jamais de valeur figée) :
 * école — rattachements, absences, signalements, messages ; agent — écoles et alertes ; administrateur — demandes de formule et incidents.
 */
@Injectable()
export class NavService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly indicators: IndicatorsService,
    private readonly unread: ConversationUnreadService,
  ) {}

  async forUser(user: AuthUser): Promise<NavItem[]> {
    const space = WEB_SPACE_OF[user.role];
    if (!space) return [];
    const badges = await this.badges(user);
    return WEB_NAV[space].map(({ badge: _fixed, ...item }) =>
      badges[item.to] ? { ...item, badge: String(badges[item.to]) } : item,
    );
  }

  private async badges(user: AuthUser): Promise<Badges> {
    if (user.role === 'etablissement' && user.schoolId) {
      const [b, messages] = await Promise.all([
        schoolBadges(this.db, user.schoolId),
        this.unread.unreadTotal(user),
      ]);
      return {
        '/ecole/utilisateurs': b.users,
        '/ecole/absences': b.absences,
        '/ecole/vie-scolaire': b.cases,
        '/ecole/messages': messages,
      };
    }
    if (user.role === 'agent') {
      const ids = (
        await this.db
          .select({ id: userScopes.orgId })
          .from(userScopes)
          .where(eq(userScopes.userId, user.sub))
      ).map((r) => r.id);
      const stats = await this.indicators.schools(ids, 7);
      return {
        '/agent': stats.length,
        '/agent/alertes': stats.reduce(
          (n, s) => n + alertsOf(s, 'agent').length,
          0,
        ),
      };
    }
    if (user.role === 'admin') {
      const [requests, open] = await Promise.all([
        this.db
          .select({ id: orgSubscriptions.orgId })
          .from(orgSubscriptions)
          .where(isNotNull(orgSubscriptions.requestedPlan)),
        this.db
          .select({ id: incidents.id })
          .from(incidents)
          .where(ne(incidents.status, 'Résolu')),
      ]);
      return {
        '/admin/abonnements': requests.length,
        '/admin/incidents': open.length,
      };
    }
    return {};
  }
}
