import { describe, expect, it } from 'vitest';
import {
  can, isPasswordValid, maskSmallCell, normalizePhone, passwordChangeSchema, passwordRules,
  signupSchema, taskInputSchema, loginSchema, WEB_ROLES, MOBILE_ROLES, formatCode,
} from './index.js';

describe('mot de passe', () => {
  it('exige 8 caractères, un chiffre et une lettre', () => {
    expect(isPasswordValid('abcdefgh')).toBe(false);
    expect(isPasswordValid('12345678')).toBe(false);
    expect(isPasswordValid('abc123')).toBe(false);
    expect(isPasswordValid('motdepasse1')).toBe(true);
    expect(passwordRules('a1').filter((r) => !r.ok).map((r) => r.key)).toEqual(['length']);
  });
  it('refuse une confirmation différente', () => {
    const r = passwordChangeSchema.safeParse({ current: 'x', next: 'motdepasse1', confirm: 'motdepasse2' });
    expect(r.success).toBe(false);
  });
});

describe('téléphone', () => {
  it("retire l'indicatif +241", () => {
    expect(normalizePhone('+241 07 12 34 56')).toBe('07123456');
    expect(normalizePhone('00241 07 12 34 56')).toBe('07123456');
  });
  it('valide la connexion par mot de passe ou OTP', () => {
    expect(loginSchema.safeParse({ mode: 'otp', phone: '07 12 34 56' }).success).toBe(true);
    expect(loginSchema.safeParse({ mode: 'password', phone: '07 12 34 56' }).success).toBe(false);
    expect(signupSchema.safeParse({ firstName: 'A', lastName: 'B', phone: '12', password: 'motdepasse1' }).success).toBe(false);
  });
});

describe('confidentialité', () => {
  it('masque les cellules de moins de 10 individus', () => {
    expect(maskSmallCell(9)).toBeNull();
    expect(maskSmallCell(10)).toBe(10);
  });
});

describe('tâches', () => {
  it('exige un titre', () => {
    const base = { classId: '3b', subject: 'Maths', type: 'Exercice', description: '', due: 'Demain' };
    expect(taskInputSchema.safeParse({ ...base, title: '  ' }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...base, title: 'Fractions' }).success).toBe(true);
  });
});

describe('droits', () => {
  it('suit la matrice du manuel', () => {
    expect(can('eleve', 'grades.write')).toBe(false);
    expect(can('enseignant', 'grades.write')).toBe(true);
    expect(can('admin', 'subscriptions.manage')).toBe(true);
    expect(can('etablissement', 'subscriptions.manage')).toBe(false);
  });
  it('répartit les profils sur les supports', () => {
    expect(MOBILE_ROLES).toEqual(['eleve', 'parent', 'enseignant']);
    expect(WEB_ROLES).toEqual(['enseignant', 'etablissement', 'agent', 'partenaire', 'admin']);
  });
  it('formate le code parent', () => expect(formatCode('482917')).toBe('482 917'));
});
