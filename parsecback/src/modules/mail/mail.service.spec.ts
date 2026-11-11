import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { fireAndForget } from '@/shared/utils/fire-and-forget';
import { MailService } from './mail.service';

const mockSendMail = jest.fn();
const mockFireAndForget = jest.mocked(fireAndForget);

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(),
  },
}));

jest.mock('@/shared/utils/fire-and-forget', () => ({
  fireAndForget: jest.fn(),
}));

describe('MailService smoke', () => {
  const baseConfig = {
    NODE_ENV: 'test',
    SUPPORT_EMAIL_HOST: 'smtp.example.com',
    SUPPORT_EMAIL_USER: 'mailer',
    SUPPORT_EMAIL_PASSWORD: 'secret',
    SUPPORT_EMAIL: 'noreply@example.com',
  } as const;

  let config: ConfigService;
  let service: MailService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(nodemailer.createTransport).mockReturnValue({
      sendMail: mockSendMail,
    } as never);

    config = {
      get: jest.fn((key: string, defaultValue?: string) =>
        key in baseConfig
          ? baseConfig[key as keyof typeof baseConfig]
          : defaultValue,
      ),
    } as unknown as ConfigService;

    service = new MailService(config);
  });

  it('creates SMTP transport with configured credentials', () => {
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: {
        user: 'mailer',
        pass: 'secret',
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });
  });

  it('sends an email with text, html, cc, bcc and attachments', () => {
    const message = service.createMessage();
    message.to = 'user@example.com';
    message.subject = 'Smoke test';
    message.text = 'Hello';
    message.html = '<b>Hello</b>';
    message.addCc('copy@example.com');
    message.addBcc(['audit@example.com']);
    message.addAttachments([
      { filename: 'report.txt', path: 'C:\\tmp\\report.txt' },
    ]);

    const sendMailPromise = Promise.resolve({ messageId: 'smoke-1' });
    mockSendMail.mockReturnValue(sendMailPromise);

    service.sendEmail(message);

    expect(mockSendMail).toHaveBeenCalledWith({
      from: '"No Reply" <noreply@example.com>',
      to: 'user@example.com',
      subject: 'Smoke test',
      text: 'Hello',
      html: '<b>Hello</b>',
      attachments: [{ filename: 'report.txt', path: 'C:\\tmp\\report.txt' }],
      bcc: ['audit@example.com'],
      cc: ['copy@example.com'],
    });
    expect(mockFireAndForget).toHaveBeenCalledWith(
      sendMailPromise,
      'MailService.sendEmail',
    );
  });

  it('builds the import request message and queues sending', () => {
    const sendMailPromise = Promise.resolve({ messageId: 'smoke-2' });
    mockSendMail.mockReturnValue(sendMailPromise);

    service.sendImportRequest('+90 555 000 00 00');

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'omi4sem@mail.ru',
        subject: 'Новая заявка на импорт проекта',
        html: '<p><b>Контакт клиента:</b> +90 555 000 00 00</p>',
      }),
    );
    expect(mockFireAndForget).toHaveBeenCalledWith(
      sendMailPromise,
      'MailService.sendEmail',
    );
  });
});
