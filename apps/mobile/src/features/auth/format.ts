import { ApiError } from '@/lib/api';

export const errorMessage = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Connexion impossible. Vérifiez le réseau.';
