// src/modules/telegram/telegram.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { fireAndForget } from '@/shared/utils/fire-and-forget';
import { isStubMode } from '@/common/stub-mode';

export interface TelegramSendOptions {
  parseMode?: 'HTML' | 'MarkdownV2';
  disableNotification?: boolean;
}

@Injectable()
export class TelegramService {
  private readonly log = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly chatId: string;
  private readonly env: string;
  private readonly http: AxiosInstance;

  constructor(private readonly cfg: ConfigService) {
    this.botToken = this.cfg.get<string>('TELEGRAM_BOT_TOKEN', '');
    this.chatId = this.cfg.get<string>('TELEGRAM_CHAT_ID', '');
    this.env = this.cfg.get<string>('NODE_ENV', 'development');

    this.http = axios.create({
      baseURL: `https://api.telegram.org/bot${this.botToken}`,
      timeout: 5000, // важно — не висим
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!this.botToken || !this.chatId) {
      this.log.warn('TelegramService disabled: BOT_TOKEN or CHAT_ID missing');
    }
  }

  private sendTelegram(method: string, payload: Record<string, unknown>): void {
    if (!this.botToken || !this.chatId) return;

    fireAndForget(
      this.http.post(`/${method}`, payload),
      `TelegramService.${method}`,
    );
  }

  sendMessage(text: string, opts?: TelegramSendOptions): void {
    if (isStubMode(this.cfg)) {
      this.log.warn(`[STUB_MODE][Telegram suppressed]\n${text}`);
      return;
    }
    if (this.env === 'development') {
      this.log.warn(`[DEV][Telegram suppressed]\n${text}`);
      return;
    }

    this.sendTelegram('sendMessage', {
      chat_id: this.chatId,
      text,
      parse_mode: opts?.parseMode ?? 'HTML',
      disable_notification: opts?.disableNotification ?? false,
    });
  }

  sendAlert(text: string): void {
    this.sendMessage(`⚠️ <b>ALERT</b>\n${text}`);
  }

  sendTestBenchResult(text: string): void {
    this.sendMessage(`🧪 <b>Test Bench</b>\n${text}`);
  }
}
