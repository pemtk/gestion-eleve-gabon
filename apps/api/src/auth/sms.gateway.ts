import { Injectable, Logger } from '@nestjs/common';

/** Point d'extension : brancher ici l'opérateur SMS (OTP, alertes, invitations). */
@Injectable()
export class SmsGateway {
  private readonly logger = new Logger('SMS');
  send(phone: string, message: string): void {
    this.logger.log(`→ +241 ${phone} : ${message}`);
  }
}
