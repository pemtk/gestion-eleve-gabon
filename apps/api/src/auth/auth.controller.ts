import { Body, Controller, Get, Headers, HttpCode, Ip, NotFoundException, Param, Post } from '@nestjs/common';
import {
  forgotSchema, loginSchema, otpVerifySchema, passwordChangeSchema, passwordSchema, passwordSetSchema, phoneSchema,
  ROLES, signupSchema, type Role,
} from '@sge/shared';
import { z } from 'zod';
import { CurrentUser, Public, type AuthUser } from '../common/auth.js';
import { AuthService } from './auth.service.js';

const refreshSchema = z.object({ refreshToken: z.string().min(10) });
const resetSchema = z.object({ phone: phoneSchema, code: z.string().regex(/^\d{6}$/), password: passwordSchema });

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Post('login')
  login(@Body({ schema: loginSchema }) body: z.infer<typeof loginSchema>, @Ip() ip: string) {
    return this.auth.login(body, ip);
  }

  @Public() @Post('otp/request')
  requestOtp(@Body({ schema: z.object({ phone: phoneSchema }) }) body: { phone: string }, @Ip() ip: string) {
    return this.auth.requestOtpIfAccount(body.phone, ip);
  }

  @Public() @Post('otp/verify')
  verify(@Body({ schema: otpVerifySchema }) body: z.infer<typeof otpVerifySchema>, @Ip() ip: string) {
    return this.auth.verifyOtp(body.phone, body.code, ip);
  }

  @Public() @Post('signup')
  signup(@Body({ schema: signupSchema }) body: z.infer<typeof signupSchema>, @Ip() ip: string) {
    return this.auth.signup(body, ip);
  }

  @Public() @Post('password/forgot')
  forgot(@Body({ schema: forgotSchema.pick({ phone: true }) }) body: { phone: string }, @Ip() ip: string) {
    return this.auth.forgot(body.phone, ip);
  }

  @Public() @Post('password/reset')
  reset(@Body({ schema: resetSchema }) body: z.infer<typeof resetSchema>, @Ip() ip: string) {
    return this.auth.reset(body.phone, body.code, body.password, ip);
  }

  @Post('password/change')
  change(@CurrentUser() user: AuthUser, @Body({ schema: passwordChangeSchema }) body: z.infer<typeof passwordChangeSchema>, @Headers('x-refresh-token') keep: string | undefined, @Ip() ip: string) {
    return this.auth.changePassword(user, body.current, body.next, keep, ip);
  }

  /** Renouvelle la session avec le jeton de renouvellement (rotation : l'ancien ne sert qu'une fois). */
  @Public() @Post('refresh') @HttpCode(200)
  renew(@Body({ schema: refreshSchema }) body: z.infer<typeof refreshSchema>, @Ip() ip: string) {
    return this.auth.renew(body.refreshToken, ip);
  }

  /** Déconnexion de cet appareil : le jeton de renouvellement est révoqué. */
  @Public() @Post('logout') @HttpCode(200)
  logout(@Body({ schema: refreshSchema }) body: z.infer<typeof refreshSchema>) {
    return this.auth.logout(body.refreshToken);
  }

  /** Déconnexion de tous les appareils. */
  @Post('logout-all') @HttpCode(200)
  logoutAll(@CurrentUser() user: AuthUser, @Ip() ip: string) {
    return this.auth.logoutAll(user, ip);
  }

  /** Premier mot de passe d'un compte qui n'en a pas (activé par code SMS). */
  @Post('password/set')
  set(@CurrentUser() user: AuthUser, @Body({ schema: passwordSetSchema }) body: z.infer<typeof passwordSetSchema>) {
    return this.auth.setPassword(user.phone, body.next);
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return { ...(await this.auth.me(user.phone)), hasPassword: await this.auth.hasPassword(user.phone) };
  }

  @Public() @Post('demo/:role')
  demo(@Param('role') role: string) {
    if (!(ROLES as readonly string[]).includes(role)) throw new NotFoundException();
    return this.auth.demo(role as Role);
  }
}
