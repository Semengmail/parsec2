// src/shared/alerting/alerting.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { TelegramService } from '@/modules/telegram/telegram.service';
import { MailService } from '@/modules/mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { fireAndForget } from '@/shared/utils/fire-and-forget';
import { isStubMode } from '@/common/stub-mode';

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);

  private readonly alertEmail: string;
  private readonly criticalEmail: string;

  constructor(
    private readonly telegram: TelegramService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {
    this.alertEmail = this.config.get<string>('ALERT_EMAIL')!;
    this.criticalEmail = this.config.get<string>('CRITICAL_EMAIL')!;

    if (!isStubMode(this.config) && (!this.alertEmail || !this.criticalEmail)) {
      throw new Error('Alerting emails not configured');
    }
  }

  // =====================================================
  // NOTIFICATION (обычные)
  // =====================================================
  notify(message: string): void {
    if (isStubMode(this.config)) {
      this.logger.warn(`[STUB_MODE][Notification suppressed] ${message}`);
      return;
    }
    this.telegram.sendMessage(message);
  }

  // =====================================================
  // ALERT (warning)
  // =====================================================
  alert(title: string, message: string): void {
    if (isStubMode(this.config)) {
      this.logger.warn(`[STUB_MODE][Alert suppressed] ${title}: ${message}`);
      return;
    }
    const text = `⚠️ ${title}\n\n${message}`;

    // Telegram
    this.telegram.sendAlert(text);

    // Email
    this.mail.sendAlert({
      to: this.alertEmail,
      title,
      text: message,
    });
  }

  // =====================================================
  // CRITICAL
  // =====================================================
  critical(title: string, message: string): void {
    if (isStubMode(this.config)) {
      this.logger.warn(`[STUB_MODE][Critical suppressed] ${title}: ${message}`);
      return;
    }
    const text = `🔥 ${title}\n\n${message}`;

    // Telegram (всегда)
    this.telegram.sendAlert(text);

    // Email (другой ящик)
    this.mail.sendCritical({
      to: this.criticalEmail,
      title,
      text: message,
    });
  }

  // =====================================================
  // SAFE WRAPPER
  // =====================================================
  safeCritical(title: string, message: string): void {
    fireAndForget(
      Promise.resolve().then(() => this.critical(title, message)),
      'AlertingService.safeCritical',
    );
  }
}
