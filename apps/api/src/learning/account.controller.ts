import { Body, Controller, Put } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../common/auth.js';
import { StoreService } from '../common/store.service.js';

const profileSchema = z.object({
  firstName: z.string().trim().min(1), lastName: z.string().trim().min(1),
  photoVisibility: z.enum(['school', 'teachers', 'private']).default('school'),
});

/** §3.4 — Mon compte : nom, photo (et qui la voit). Le téléphone n'est modifiable que par l'école. */
@Roles('eleve', 'parent', 'enseignant')
@Controller('me')
export class AccountController {
  constructor(private readonly store: StoreService) {}

  @Put('profile')
  profile(@Body({ schema: profileSchema }) body: z.infer<typeof profileSchema>) {
    this.store.photoVisibility = body.photoVisibility;
    return { ok: true, name: `${body.firstName} ${body.lastName}`, photoVisibility: body.photoVisibility };
  }
}
