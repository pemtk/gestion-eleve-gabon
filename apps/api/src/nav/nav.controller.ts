import { Controller, Get } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.js';
import { NavService } from './nav.service.js';

/** Menu de l'espace web de l'utilisateur connecté, avec ses pastilles. */
@Roles('etablissement', 'agent', 'partenaire', 'admin')
@Controller('nav')
export class NavController {
  constructor(private readonly nav: NavService) {}

  @Get()
  forUser(@CurrentUser() user: AuthUser) {
    return this.nav.forUser(user);
  }
}
