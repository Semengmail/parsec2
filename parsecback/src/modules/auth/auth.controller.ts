import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Response, CookieOptions } from 'express';
import type { Request as ExpressRequest } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

type RegisterResponse = { user: User; apiKey: string };
type OkResponse = { ok: true };

type SafeRequest = ExpressRequest<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  Record<string, unknown>
> & {
  cookies: Record<string, string | undefined>;
};

function parseSameSite(v: string | undefined): CookieOptions['sameSite'] {
  const s = (v ?? 'Lax').toLowerCase();
  if (s === 'strict' || s === 'none') return s;
  return 'lax';
}

// Узкий тайпгард, чтобы не пускать any дальше по коду
function isUserLike(x: unknown): x is User {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  const idOk = typeof o.id === 'number' && Number.isInteger(o.id);
  const emailOk = typeof o.email === 'string';
  // name опционален/nullable — не навязываем
  return idOk && emailOk;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly cfg: ConfigService,
  ) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ ip: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: CreateUserDto): Promise<RegisterResponse> {
    return this.users.create(dto);
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ account: true })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OkResponse> {
    const user = await this.auth.validate(body.email, body.password);
    const token = this.auth.signToken(user.id);

    const cookieName = this.cfg.get<string>('COOKIE_NAME', 'psk.sid');
    const domain = this.cfg.get<string>('COOKIE_DOMAIN') ?? undefined; // .toolzar.local / .toolzar.ru
    const secure = this.cfg.get<string>('COOKIE_SECURE', 'false') === 'true';
    const sameSite = parseSameSite(this.cfg.get<string>('COOKIE_SAMESITE'));

    res.cookie(cookieName, token, {
      httpOnly: true,
      secure,
      sameSite,
      domain,
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 180, // 180 дней
    });

    return { ok: true };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): OkResponse {
    const cookieName = this.cfg.get<string>('COOKIE_NAME', 'psk.sid');
    const domain = this.cfg.get<string>('COOKIE_DOMAIN') ?? undefined;
    const secure = this.cfg.get<string>('COOKIE_SECURE', 'false') === 'true';
    const sameSite = parseSameSite(this.cfg.get<string>('COOKIE_SAMESITE'));

    // Совпадающие опции важны для гарантированного удаления
    res.clearCookie(cookieName, {
      domain,
      path: '/',
      httpOnly: true,
      secure,
      sameSite,
    });
    return { ok: true };
  }

  @Get('me')
  async me(@Req() req: SafeRequest): Promise<{
    user: Pick<
      User,
      | 'id'
      | 'email'
      | 'name'
      | 'balance'
      | 'role'
      | 'company'
      | 'tariffId'
      | 'lastLoginAt'
      | 'softId'
      | 'referralCode'
    >;
  }> {
    const cookieName = this.cfg.get<string>('COOKIE_NAME', 'psk.sid');
    const token = req.cookies[cookieName] as string | undefined;
    if (!token) throw new UnauthorizedException('no_token');

    const { sub } = this.auth.verifyToken(token);

    const candidate: User | null = await this.users.getUserById(sub);
    if (!isUserLike(candidate)) {
      throw new UnauthorizedException('user_not_found');
    }
    // Клиент вызывает /auth/me при каждой загрузке страницы: это отметка визита.
    void this.users.touchLastSeen(candidate.id);

    const {
      id,
      email,
      name,
      balance,
      role,
      company,
      tariffId,
      lastLoginAt,
      softId,
      referralCode,
    } = candidate;
    return {
      user: {
        id,
        email,
        name,
        balance,
        role,
        company,
        tariffId,
        lastLoginAt,
        softId,
        referralCode,
      },
    };
  }

  @Post('forgot-password')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    ip: { limit: 3, ttl: 60_000 },
    account: { limit: 3, ttl: 3_600_000 },
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @UseGuards(ThrottlerGuard)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }
}
