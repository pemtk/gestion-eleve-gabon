import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { initials, normalizePhone, type Role } from '@sge/shared';
import { randomUUID } from 'node:crypto';
import { SmsGateway } from '../auth/sms.gateway.js';
import { DB, type Db } from '../db/db.module.js';
import { isUniqueViolation } from '../db/errors.js';
import * as schema from '../db/schema.js';
import { users } from '../db/schema.js';

/** Base de données ou transaction : permet de créer un compte dans la même transaction que la fiche qu'il accompagne. */
export type Executor = PgDatabase<NodePgQueryResultHKT, typeof schema>;

export interface NewAccount {
  role: Role;
  name: string;
  phone: string;
  schoolId?: string | null;
  title?: string;
  organization?: string | null;
  /** Compte déjà activé (jeu de démonstration, premier administrateur). Par défaut : à activer par code SMS. */
  activated?: boolean;
  passwordHash?: string | null;
  id?: string;
}

const WEB_ROLES = new Set<Role>(['etablissement', 'agent', 'partenaire', 'admin']);

/**
 * Création des comptes. Un numéro de téléphone = un compte sur toute la plateforme (identifiant de connexion).
 * Un compte créé par l'école ou l'administrateur n'a pas de mot de passe : son titulaire l'active avec le code SMS (§2.1).
 */
@Injectable()
export class AccountsService {
  constructor(@Inject(DB) private readonly db: Db, private readonly sms: SmsGateway) {}

  async phoneTaken(phone: string, ex: Executor = this.db): Promise<boolean> {
    const [row] = await ex.select({ id: users.id }).from(users).where(eq(users.phone, normalizePhone(phone)));
    return !!row;
  }

  async create(a: NewAccount, ex: Executor = this.db) {
    const phone = normalizePhone(a.phone);
    if (phone.length < 8 || phone.length > 9) throw new BadRequestException('Numéro de téléphone invalide (format +241…).');
    if (await this.phoneTaken(phone, ex)) throw new ConflictException('Un compte existe déjà avec ce numéro.');
    try {
      const [row] = await ex.insert(users).values({
        id: a.id ?? `u-${randomUUID()}`, phone, name: a.name.trim(), initials: initials(a.name), role: a.role, title: a.title ?? '',
        organization: a.organization ?? null, passwordHash: a.passwordHash ?? null, activated: a.activated ?? false, schoolId: a.schoolId ?? null,
      }).returning();
      return row!;
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('Un compte existe déjà avec ce numéro.');
      throw e;
    }
  }

  /**
   * SMS d'invitation : rien à retenir, la personne ouvre l'application et choisit « Code SMS » avec son numéro.
   * (Le code lui-même est envoyé à ce moment-là, à sa demande : il reste valable quelques minutes seulement.)
   */
  invite(user: { phone: string; name: string; role: string }, where?: string) {
    const first = user.name.split(' ')[0];
    const place = where ? ` (${where})` : '';
    const how = WEB_ROLES.has(user.role as Role)
      ? `Rendez-vous sur ${process.env.WEB_URL ?? 'http://localhost:5173'}`
      : 'Installez l’application Gestion Élève Gabon';
    this.sms.send(user.phone, `Bonjour ${first}, votre compte Gestion Élève Gabon${place} est prêt. ${how}, choisissez « Code SMS » et saisissez le ${user.phone} pour l’activer.`);
  }
}
