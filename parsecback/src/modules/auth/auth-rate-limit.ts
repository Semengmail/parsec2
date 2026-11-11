import type { ThrottlerModuleOptions } from '@nestjs/throttler';

// Guards run before DTO validation; the incoming email can have any type.
export const AUTH_RATE_LIMITS: ThrottlerModuleOptions = {
  errorMessage: 'Слишком много запросов. Попробуйте позже.',
  throttlers: [
    { name: 'ip', ttl: 60_000, limit: 10 },
    {
      name: 'account',
      ttl: 3_600_000,
      limit: 30,
      getTracker: (request: { ip?: string; body?: { email?: unknown } }) => {
        const email = request.body?.email;
        return typeof email === 'string'
          ? email.trim().toLowerCase().slice(0, 320)
          : (request.ip ?? 'unknown');
      },
    },
  ],
};
