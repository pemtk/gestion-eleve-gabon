import { type SessionUser } from '@sge/shared';

export type Session = { accessToken: string; refreshToken: string; user: SessionUser };
