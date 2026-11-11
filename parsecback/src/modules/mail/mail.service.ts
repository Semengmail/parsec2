// src/modules/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { fireAndForget } from '@/shared/utils/fire-and-forget';

export interface EmailAttachment {
  filename: string;
  path: string;
}

export class EmailMessage {
  to!: string;
  from?: string;
  subject!: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  bcc?: string[];
  cc?: string[];

  addAttachments(attachments: EmailAttachment[]): this {
    this.attachments = [...(this.attachments ?? []), ...attachments];
    return this;
  }

  addBcc(bcc: string | string[]): this {
    const arr = Array.isArray(bcc) ? bcc : [bcc];
    this.bcc = [...(this.bcc ?? []), ...arr];
    return this;
  }

  addCc(cc: string | string[]): this {
    const arr = Array.isArray(cc) ? cc : [cc];
    this.cc = [...(this.cc ?? []), ...arr];
    return this;
  }
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly defaultFrom: string;
  private readonly env: string;

  constructor(private readonly config: ConfigService) {
    this.env = this.config.get<string>('NODE_ENV', 'development');

    const host = this.config.get<string>('SUPPORT_EMAIL_HOST');
    const user = this.config.get<string>('SUPPORT_EMAIL_USER');
    const pass = this.config.get<string>('SUPPORT_EMAIL_PASSWORD');
    const from = this.config.get<string>('SUPPORT_EMAIL');

    if (!host || !user || !pass || !from) {
      throw new Error('Mail config is not fully defined');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: 465,
      secure: true,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });

    this.defaultFrom = `"No Reply" <${from}>`;
  }

  createMessage(): EmailMessage {
    return new EmailMessage();
  }

  sendEmail(message: EmailMessage): void {
    const previewText =
      message.text?.slice(0, 500) ??
      message.html?.replace(/<[^>]+>/g, '').slice(0, 500) ??
      '';

    const logPayload = {
      to: message.to,
      subject: message.subject,
      textPreview: previewText,
      hasHtml: Boolean(message.html),
      hasAttachments: Boolean(message.attachments?.length),
    };

    if (this.env === 'development!') {
      this.logger.warn(
        `[DEV][Email suppressed] ${JSON.stringify(logPayload, null, 2)}`,
      );
      return;
    }

    // 👇 лог перед отправкой
    this.logger.log(`[EMAIL SEND] ${JSON.stringify(logPayload, null, 2)}`);

    fireAndForget(
      this.transporter.sendMail({
        from: message.from ?? this.defaultFrom,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments,
        bcc: message.bcc,
        cc: message.cc,
      }),
      'MailService.sendEmail',
    );
  }

  // =========================
  // ALERT
  // =========================
  sendAlert(params: { to: string; title: string; text: string }): void {
    const message = this.createMessage();
    message.to = params.to;
    message.subject = `⚠️ ALERT: ${params.title}`;
    message.text = params.text;

    this.sendEmail(message);
  }

  // =========================
  // CRITICAL
  // =========================
  sendCritical(params: { to: string; title: string; text: string }): void {
    const message = this.createMessage();
    message.to = params.to;
    message.subject = `🔥 CRITICAL: ${params.title}`;
    message.text = params.text;

    this.sendEmail(message);
  }

  // =========================
  // NOTIFICATION
  // =========================
  sendNotification(params: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): void {
    const message = this.createMessage();
    message.to = params.to;
    message.subject = params.subject;

    if (params.text) message.text = params.text;
    if (params.html) message.html = params.html;

    this.sendEmail(message);
  }

  // =========================
  // legacy
  // =========================
  sendImportRequest(contact: string): void {
    const message = this.createMessage();
    message.to = 'omi4sem@mail.ru';
    message.subject = 'Новая заявка на импорт проекта';
    message.html = `<p><b>Контакт клиента:</b> ${contact}</p>`;

    this.sendEmail(message);
  }
}
