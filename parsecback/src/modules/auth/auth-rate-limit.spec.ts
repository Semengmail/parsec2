import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AUTH_RATE_LIMITS } from './auth-rate-limit';
import type { Server } from 'node:http';

describe('Auth rate limits over HTTP', () => {
  let app: INestApplication;
  const forgotPassword = jest.fn().mockResolvedValue({ ok: true });

  beforeEach(async () => {
    forgotPassword.mockClear();
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(AUTH_RATE_LIMITS)],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            forgotPassword,
            validate: jest.fn().mockResolvedValue({ id: 1 }),
            signToken: jest.fn().mockReturnValue('local-test-token'),
          },
        },
        { provide: UsersService, useValue: {} },
        { provide: ConfigService, useValue: new ConfigService() },
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

  it('blocks the fourth reset from an IP even with different emails', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer() as Server)
        .post('/auth/forgot-password')
        .send({ email: `test-${i}@example.invalid` })
        .expect(201);
    }
    const blocked = await request(app.getHttpServer() as Server)
      .post('/auth/forgot-password')
      .send({ email: 'another@example.invalid' })
      .expect(429);
    expect(blocked.body.message).toBe(
      'Слишком много запросов. Попробуйте позже.',
    );
    expect(forgotPassword).toHaveBeenCalledTimes(3);
  });

  it('blocks the fourth reset of an account even from different IPs/casing', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer() as Server)
        .post('/auth/forgot-password')
        .set('X-Forwarded-For', `198.51.100.${i + 1}`)
        .send({
          email: i % 2 ? ' TEST@example.invalid ' : 'test@example.invalid',
        })
        .expect(201);
    }
    await request(app.getHttpServer() as Server)
      .post('/auth/forgot-password')
      .set('X-Forwarded-For', '198.51.100.99')
      .send({ email: 'test@example.invalid' })
      .expect(429);
    expect(forgotPassword).toHaveBeenCalledTimes(3);
  });

  it('does not let other IPs lock out login by exhausting an email counter', async () => {
    for (let i = 0; i < 31; i++) {
      await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .set('X-Forwarded-For', `198.51.100.${i + 1}`)
        .send({ email: 'same@example.invalid', password: 'local-password' })
        .expect(201);
    }
  });

  it('still blocks the eleventh login attempt from one IP', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer() as Server)
        .post('/auth/login')
        .send({
          email: `user-${i}@example.invalid`,
          password: 'local-password',
        })
        .expect(201);
    }
    await request(app.getHttpServer() as Server)
      .post('/auth/login')
      .send({ email: 'last@example.invalid', password: 'local-password' })
      .expect(429);
  });
});
