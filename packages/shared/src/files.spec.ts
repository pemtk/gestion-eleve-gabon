import { describe, expect, it } from 'vitest';
import { FILE_POLICIES, acceptedTypes, formatBytes } from './index.js';

describe('fichiers', () => {
  it('formate les tailles', () =>
    expect([
      formatBytes(900),
      formatBytes(2048),
      formatBytes(5 * 1024 * 1024),
      formatBytes(1.5 * 1024 * 1024),
    ]).toEqual(['1 Ko', '2 Ko', '5 Mo', '1,5 Mo']));
  it('liste les types acceptés', () => {
    expect(acceptedTypes('proof')).toBe('JPEG, PNG ou WebP');
    expect(acceptedTypes('report')).toBe('JPEG, PNG, WebP ou PDF');
  });
  it('limite les profils par usage : seul l’élève joint une preuve', () => {
    expect(FILE_POLICIES.proof.roles).toEqual(['eleve']);
    expect(FILE_POLICIES.report.roles).toEqual(['agent']);
  });
});
