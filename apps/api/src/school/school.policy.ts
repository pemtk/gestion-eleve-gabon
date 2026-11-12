import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { planHas, type PlanFeatureKey } from '@sge/shared';
import { DB, type Db } from '../db/db.module.js';
import { getSetting } from '../db/settings.js';

/** Règles d'abonnement : suspendu = consultation seule ; certaines fonctions dépendent de la formule. */
@Injectable()
export class SchoolPolicy {
  constructor(@Inject(DB) private readonly db: Db) {}

  subscription() {
    return getSetting(this.db, 'subscription');
  }

  async features() {
    return planHas((await this.subscription()).plan);
  }

  async assertWritable() {
    if ((await this.subscription()).suspended) {
      throw new ForbiddenException({ code: 'SUBSCRIPTION_SUSPENDED', message: 'Abonnement suspendu : consultation seule.' });
    }
  }

  async require(feature: PlanFeatureKey) {
    if (!(await this.features())[feature]) {
      throw new ForbiddenException({ code: 'PLAN_REQUIRED', feature, message: 'Cette fonction n’est pas incluse dans votre formule.' });
    }
  }
}
