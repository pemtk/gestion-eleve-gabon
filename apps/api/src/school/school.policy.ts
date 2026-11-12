import { ForbiddenException, Injectable } from '@nestjs/common';
import { planHas, type PlanFeatureKey } from '@sge/shared';
import { StoreService } from '../common/store.service.js';

/** Règles d'abonnement : suspendu = consultation seule ; certaines fonctions dépendent de la formule. */
@Injectable()
export class SchoolPolicy {
  constructor(private readonly store: StoreService) {}

  get features() {
    return planHas(this.store.subscription.plan);
  }

  assertWritable() {
    if (this.store.subscription.suspended) {
      throw new ForbiddenException({ code: 'SUBSCRIPTION_SUSPENDED', message: 'Abonnement suspendu : consultation seule.' });
    }
  }

  require(feature: PlanFeatureKey) {
    if (!this.features[feature]) {
      throw new ForbiddenException({ code: 'PLAN_REQUIRED', feature, message: 'Cette fonction n’est pas incluse dans votre formule.' });
    }
  }
}
