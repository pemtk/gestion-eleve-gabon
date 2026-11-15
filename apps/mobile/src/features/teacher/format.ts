import { ApiError } from '@/lib/api';

export const errorMessage = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;
