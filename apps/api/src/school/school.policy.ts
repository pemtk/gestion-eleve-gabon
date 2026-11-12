import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { planHas, type PlanFeatureKey } from '@sge/shared';
import { DB, type Db } from '../db/db.module.js';
import { getSubscription } from '../db/subscription.js';

/** Règles d'abonnement de l'établissement : suspendu = consultation seule ; certaines fonctions dépendent de la formule. */
@Injectable()
export class SchoolPolicy {
  constructor(@Inject(DB) private readonly db: Db) {}

  subscription(schoolId: string) {
    return getSubscription(this.db, schoolId);
  }

  async features(schoolId: string) {
    return planHas((await this.subscription(schoolId)).plan);
  }

  async assertWritable(schoolId: string) {
    if ((await this.subscription(schoolId)).suspended) {
      throw new ForbiddenException({ code: 'SUBSCRIPTION_SUSPENDED', message: 'Abonnement suspendu : consultation seule.' });
    }
  }

  async require(schoolId: string, feature: PlanFeatureKey) {
    if (!(await this.features(schoolId))[feature]) {
      throw new ForbiddenException({ code: 'PLAN_REQUIRED', feature, message: 'Cette fonction n’est pas incluse dans votre formule.' });
    }
  }
}
