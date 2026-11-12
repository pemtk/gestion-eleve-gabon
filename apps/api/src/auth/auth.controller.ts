import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import {
  forgotSchema, loginSchema, otpVerifySchema, passwordChangeSchema, passwordSchema, phoneSchema,
  ROLES, signupSchema, type Role,
} from '@sge/shared';
import { z } from 'zod';
import { CurrentUser, Public, type AuthUser } from '../common/auth.js';
import { AuthService } from './auth.service.js';

const resetSchema = z.object({ phone: phoneSchema, code: z.string().regex(/^\d{6}$/), password: passwordSchema });

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Post('login')
  login(@Body({ schema: loginSchema }) body: z.infer<typeof loginSchema>) {
    return this.auth.login(body);
  }

  @Public() @Post('otp/request')
  requestOtp(@Body({ schema: z.object({ phone: phoneSchema }) }) body: { phone: string }) {
    return this.auth.requestOtp(body.phone);
  }

  @Public() @Post('otp/verify')
  verify(@Body({ schema: otpVerifySchema }) body: z.infer<typeof otpVerifySchema>) {
    return this.auth.verifyOtp(body.phone, body.code);
  }

  @Public() @Post('signup')
  signup(@Body({ schema: signupSchema }) body: z.infer<typeof signupSchema>) {
    return this.auth.signup(body);
  }

  @Public() @Post('password/forgot')
  forgot(@Body({ schema: forgotSchema.pick({ phone: true }) }) body: { phone: string }) {
    return this.auth.forgot(body.phone);
  }

  @Public() @Post('password/reset')
  reset(@Body({ schema: resetSchema }) body: z.infer<typeof resetSchema>) {
    return this.auth.reset(body.phone, body.code, body.password);
  }

  @Post('password/change')
  change(@CurrentUser() user: AuthUser, @Body({ schema: passwordChangeSchema }) body: z.infer<typeof passwordChangeSchema>) {
    return this.auth.changePassword(user.phone, body.current, body.next);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.phone);
  }

  @Public() @Post('demo/:role')
  demo(@Param('role') role: string) {
    if (!(ROLES as readonly string[]).includes(role)) throw new NotFoundException();
    return this.auth.demo(role as Role);
  }
}
