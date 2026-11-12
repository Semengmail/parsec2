import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import type { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Tariff } from '../tariffs/entities/tariff.entity';
import { ReferralService } from '../referral/referral.service';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';

describe('lastSeenAt', () => {
  afterEach(() => jest.restoreAllMocks());

  function createService(query: jest.Mock) {
    const repo = { query, metadata: { tablePath: 'users' } };
    return new UsersService(
      repo as unknown as Repository<User>,
      {} as Repository<Tariff>,
      {} as ReferralService,
      {} as Cache,
    );
  }

  it('updates the visit mark at most once per 5 minutes and keeps updatedAt', async () => {
    const query = jest.fn().mockResolvedValue([]);
    await createService(query).touchLastSeen(42);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([42]);
    expect(sql).toContain('UPDATE users');
    expect(sql).toContain('"lastSeenAt" = NOW()');
    expect(sql).toContain("INTERVAL '5 minutes'");
    expect(sql).not.toContain('updatedAt');
  });

  it('never fails the request when the statistic cannot be written', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const query = jest.fn().mockRejectedValue(new Error('column missing'));
    await expect(
      createService(query).touchLastSeen(1),
    ).resolves.toBeUndefined();
  });

  it('marks a visit on /auth/me for a valid session only', async () => {
    const touchLastSeen = jest.fn().mockResolvedValue(undefined);
    const getUserById = jest
      .fn()
      .mockResolvedValue({ id: 7, email: 'user@example.invalid' });
    const verifyToken = jest.fn().mockReturnValue({ sub: 7 });
    const controller = new AuthController(
      { verifyToken } as unknown as AuthService,
      { getUserById, touchLastSeen } as unknown as UsersService,
      new ConfigService({ COOKIE_NAME: 'psk.sid' }),
    );
    type MeRequest = Parameters<AuthController['me']>[0];

    const result = await controller.me({
      cookies: { 'psk.sid': 'token' },
    } as unknown as MeRequest);
    expect(result.user.id).toBe(7);
    expect(touchLastSeen).toHaveBeenCalledWith(7);

    touchLastSeen.mockClear();
    await expect(
      controller.me({ cookies: {} } as unknown as MeRequest),
    ).rejects.toThrow('no_token');
    expect(touchLastSeen).not.toHaveBeenCalled();
  });
});
