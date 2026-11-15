import { Body, Catch, Controller, Delete, Get, HttpCode, Ip, Param, Post, Query, StreamableFile, UploadedFile, UseInterceptors, type ArgumentsHost, type ExceptionFilter, PayloadTooLargeException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_UPLOAD_BYTES } from '@sge/shared';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser, Public, type AuthUser } from '../common/auth.js';
import { FilesService, toStored } from './files.service.js';

type Row = Awaited<ReturnType<FilesService['find']>>;

/** Les images s'affichent dans l'application ; les PDF se téléchargent (jamais exécutés dans le navigateur). */
function serve(row: Row, body: Buffer): StreamableFile {
  const disposition = row.contentType === 'application/pdf' ? 'attachment' : 'inline';
  return new StreamableFile(body, { type: row.contentType, length: body.length, disposition: `${disposition}; filename="${row.name.replace(/"/g, '')}"` });
}

/** Message de l'intercepteur d'envoi (multer) traduit : plafond absolu de taille atteint avant même de connaître l'usage. */
@Catch(PayloadTooLargeException)
export class PayloadTooLargeFilter implements ExceptionFilter {
  catch(e: PayloadTooLargeException, host: ArgumentsHost) {
    const message = e.message === 'File too large' ? 'Fichier trop volumineux.' : e.message;
    host.switchToHttp().getResponse<Response>().status(413).json({ statusCode: 413, error: 'Payload Too Large', message });
  }
}

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  /** Envoi : `multipart/form-data` avec `kind` (usage) et `file`. Le fichier reste « en attente » jusqu'à ce qu'un objet le réclame. */
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES + 1, files: 1, fields: 4, parts: 6 } }))
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File | undefined, @Body() body: { kind?: string } | undefined) {
    return this.files.upload(user, body?.kind, file);
  }

  /** Lecture avec la session : seuls ceux que l'objet rattaché autorise (sinon 404). */
  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string, @Ip() ip: string) {
    const row = await this.files.find(user, id, ip);
    return serve(row, await this.files.content(row));
  }

  /** Lien temporaire (5 minutes) pour afficher le fichier sans en-tête d'authentification. */
  @Get(':id/url')
  async url(@CurrentUser() user: AuthUser, @Param('id') id: string, @Ip() ip: string) {
    return this.files.link(await this.files.find(user, id, ip));
  }

  /** Lecture par lien signé (sans session) : valable pour ce fichier seulement, jusqu'à l'échéance. */
  @Public() @Get(':id/content')
  async signed(@Param('id') id: string, @Query('exp') exp: string, @Query('sig') sig: string) {
    const row = await this.files.bySignature(id, Number(exp), sig ?? '');
    return serve(row, await this.files.content(row));
  }

  /** Supprime un fichier envoyé mais pas encore utilisé. */
  @Delete(':id') @HttpCode(200)
  async discard(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.files.discard(user, id);
    return { ok: true };
  }
}

export { toStored };
