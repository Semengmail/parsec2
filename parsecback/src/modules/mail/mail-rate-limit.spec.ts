import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Server } from 'node:http';
import request from 'supertest';
import { AUTH_RATE_LIMITS } from '../auth/auth-rate-limit';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

describe('Import mail rate limits', () => {
  let app: INestApplication;
  const send = jest.fn();

  beforeEach(async () => {
    send.mockClear();
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(AUTH_RATE_LIMITS)],
      controllers: [MailController],
      providers: [
        { provide: MailService, useValue: { sendImportRequest: send } },
      ],
    }).compile();
    app = module.createNestApplication();
    const express = app.getHttpAdapter().getInstance() as {
      set: (name: string, value: number) => void;
    };
    express.set('trust proxy', 1);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows three requests, blocks the fourth before SMTP', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer() as Server)
        .post('/mail/import-request')
        .send({ contact: 'local test' })
        .expect(201);
    }
    const blocked = await request(app.getHttpServer() as Server)
      .post('/mail/import-request')
      .send({ contact: 'blocked' })
      .expect(429);
    expect(blocked.body.message).toBe(
      'Слишком много запросов. Попробуйте позже.',
    );
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('caps the recipient mailbox even when source IP and contact change', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer() as Server)
        .post('/mail/import-request')
        .set('X-Forwarded-For', `198.51.100.${i + 1}`)
        .send({ contact: `test-${i}` })
        .expect(201);
    }
    await request(app.getHttpServer() as Server)
      .post('/mail/import-request')
      .set('X-Forwarded-For', '198.51.100.99')
      .send({ contact: 'blocked' })
      .expect(429);
    expect(send).toHaveBeenCalledTimes(10);
  });
});
