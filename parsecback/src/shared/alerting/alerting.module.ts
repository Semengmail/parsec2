// src/shared/alerting/alerting.module.ts
import { Module } from '@nestjs/common';
import { TelegramModule } from '@/modules/telegram/telegram.module';
import { MailModule } from '@/modules/mail/mail.module';
import { AlertingService } from './alerting.service';

@Module({
  imports: [TelegramModule, MailModule],
  providers: [AlertingService],
  exports: [AlertingService],
})
export class AlertingModule {}
