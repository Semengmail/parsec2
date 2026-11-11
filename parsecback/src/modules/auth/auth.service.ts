import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign, verify, type VerifyOptions } from 'jsonwebtoken';
import { UsersService } from '../users/users.service';
import type { JwtSubPayload } from './types';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { MailService } from '../mail/mail.service';
import { resetPasswordTemplate } from './emails/resetPasswordTemplate';
import { extractUserIdFromJwt } from '@/shared/helpers/extractUserIdFromJwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly cfg: ConfigService,
    private readonly mail: MailService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async validate(email: string, password: string) {
    const user = await this.users.findByEmailWithPassword(email);
    if (!user) throw new UnauthorizedException('Пользователь не найден');
    const ok = await this.users.validatePassword(user, password);
    if (!ok) throw new UnauthorizedException('Неверный пароль');

    await this.users.incrementAuthCount(user.id);

    return user;
  }

  async findUserById(id: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  signToken(userId: number): string {
    const secret = this.cfg.get<string>('JWT_SECRET') ?? 'dev_secret';
    if (
      process.env.NODE_ENV === 'production' &&
      !this.cfg.get<string>('JWT_SECRET')
    ) {
      throw new Error('JWT_SECRET is required in production');
    }
    // sub сохраняем строкой (JWT стандарт), читаем как число
    return sign({ sub: String(userId) }, secret, {
      expiresIn: '180d',
      algorithm: 'HS256',
    });
  }

  verifyToken(token: string): JwtSubPayload {
    const secret = this.cfg.get<string>('JWT_SECRET') ?? 'dev_secret';
    const options: VerifyOptions = { algorithms: ['HS256'] };

    let decoded: unknown;

    try {
      decoded = verify(token, secret, options);
    } catch {
      throw new UnauthorizedException('invalid_token');
    }

    const userId = extractUserIdFromJwt(decoded);
    if (!userId) {
      throw new UnauthorizedException('invalid_sub');
    }

    return { sub: userId };
  }

  async forgotPassword(email: string) {
    const user = await this.users.findByEmail(email);
    if (!user) {
      // ⚠️ ВАЖНО: не палим, существует email или нет
      return { ok: true };
    }

    const secret = this.cfg.get<string>('RESET_PASSWORD_SECRET');
    if (!secret) throw new Error('RESET_PASSWORD_SECRET missing');

    const token = sign({ sub: user.id }, secret, { expiresIn: '1h' });

    const frontend = this.cfg.get<string>('FRONTEND_URL');
    const resetUrl = `${frontend}/reset-password?token=${token}`;

    const msg = this.mail.createMessage();
    msg.to = user.email;
    msg.subject = 'Восстановление пароля';
    msg.html = resetPasswordTemplate({
      resetUrl,
      supportEmail: this.cfg.get('SUPPORT_EMAIL') || '',
    });

    this.mail.sendEmail(msg);

    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const secret = this.cfg.get<string>('RESET_PASSWORD_SECRET');
    if (!secret) throw new Error('RESET_PASSWORD_SECRET missing');

    let decoded: unknown;

    try {
      decoded = verify(token, secret);
    } catch {
      throw new BadRequestException('Токен недействителен или истёк');
    }

    if (typeof decoded !== 'object' || decoded === null) {
      throw new BadRequestException('Некорректный токен');
    }

    const userId = extractUserIdFromJwt(decoded);
    if (!userId) throw new BadRequestException('Некорректный токен');

    await this.users.setNewPassword(userId, newPassword);

    return { ok: true };
  }
}
