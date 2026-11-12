import {
  CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable,
  SetMetadata, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@sge/shared';

export interface AuthUser { sub: string; role: Role; name: string; phone: string }

const PUBLIC = 'isPublic';
const ROLES = 'roles';
export const Public = () => SetMetadata(PUBLIC, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

/** Jeton Bearer obligatoire, sauf routes marquées @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Connexion requise.');
    try {
      req.user = await this.jwt.verifyAsync<AuthUser>(token);
    } catch {
      throw new UnauthorizedException('Session expirée, reconnectez-vous.');
    }
    return true;
  }
}

/** Restreint une route aux profils listés par @Roles(). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!roles) return true;
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('Ce profil n’a pas accès à cette ressource.');
    return true;
  }
}
