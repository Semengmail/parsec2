// src/modules/users/users.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  encryptWithMaster,
  generateShortApiKey,
  sha256Hex,
  decryptWithMaster,
} from 'src/shared/utils/crypto';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Tariff } from '../tariffs/entities/tariff.entity';
import { ReferralService } from '../referral/referral.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(Tariff) private readonly tariffRepo: Repository<Tariff>,
    private readonly referralService: ReferralService,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

  async incrementAuthCount(userId: number): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(User)
      .set({
        authCount: () => '"authCount" + 1',
        lastLoginAt: () => 'NOW()',
      })
      .where('id = :id', { id: userId })
      .execute();
  }

  async create(dto: CreateUserDto): Promise<{ user: User; apiKey: string }> {
    const exists = await this.repo.findOne({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('email_taken');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const rawKey = generateShortApiKey();
    const apiKeyHash = sha256Hex(rawKey);
    const apiKeyEnc = encryptWithMaster(rawKey);

    // хотим по умолчанию привязать тариф NONE
    const base = await this.tariffRepo.findOne({
      where: { code: 'NONE', isActive: true },
    });

    const referralCode = await this.referralService.generateReferralCode(
      dto.email,
    );

    const draft: DeepPartial<User> = {
      email: dto.email,
      passwordHash,
      name: dto.name ?? null,
      company: dto.company ?? null,
      balance: '6000', // стартовый баланс: 6 рублей (в тысячных долях)
      role: ['user'],
      tariffId: base ? base.id : null,
      status: 'active',
      apiKeyHash,
      apiKeyEnc,
      referralCode,
    };

    const entity = this.repo.create(draft);
    const saved = await this.repo.save(entity);

    if (dto.referralCode) {
      try {
        const result = await this.referralService.attachReferralCode(
          saved.id,
          dto.referralCode,
        );

        if (!result.success) {
          console.warn(
            `[REFERRAL] attach failed for user=${saved.id}, code=${dto.referralCode}: ${result.message}`,
          );
        }
      } catch (e) {
        console.error(
          `[REFERRAL] attach crashed for user=${saved.id}, code=${dto.referralCode}`,
          e,
        );
      }
    }

    const where: FindOptionsWhere<User> = { id: saved.id };
    const clean = await this.repo.findOne({ where });
    if (!clean) throw new NotFoundException('user_not_found_after_create');

    return { user: clean, apiKey: rawKey };
  }

  /** Ротация API-ключа: обновляем hash+enc и возвращаем сырой ключ. */
  async rotateApiKey(userId: number): Promise<{ apiKey: string }> {
    const user = await this.repo
      .createQueryBuilder('u')
      .addSelect(['u.apiKeyHash'])
      .where('u.id = :id', { id: userId })
      .getOne();
    if (!user) throw new NotFoundException('user_not_found');

    const oldApiKeyHash = user.apiKeyHash;
    const raw = generateShortApiKey();
    user.apiKeyHash = sha256Hex(raw);
    user.apiKeyEnc = encryptWithMaster(raw);
    await this.repo.save(user);
    await this.clearPublicApiKeyCache(userId, oldApiKeyHash);

    return { apiKey: raw };
  }

  async findByApiKey(
    rawKey: string,
  ): Promise<{ userId: number; roles: string[] } | null> {
    const hash = sha256Hex(rawKey);

    const u = await this.repo
      .createQueryBuilder('u')
      .addSelect(['u.apiKeyHash']) // на случай select: false в entity
      .where('u.apiKeyHash = :hash', { hash })
      .getOne();

    if (!u) return null;
    return { userId: u.id, roles: Array.isArray(u.role) ? u.role : [] };
  }

  /** Профиль + «сырой» API-ключ (дешифруем для отображения в кабинете). */
  async getProfileWithApiKey(
    userId: number,
  ): Promise<User & { apiKey: string }> {
    // 1) тянем apiKeyEnc через addSelect
    const withKey = await this.repo
      .createQueryBuilder('u')
      .addSelect(['u.apiKeyEnc'])
      .where('u.id = :id', { id: userId })
      .getOne();

    if (!withKey) throw new NotFoundException('user_not_found');

    const rawKey = decryptWithMaster(withKey.apiKeyEnc);

    // 2) берём «чистого» пользователя для ответа
    const clean = await this.repo.findOne({ where: { id: userId } });
    if (!clean) throw new NotFoundException('user_not_found');

    return Object.assign(clean, { apiKey: rawKey });
  }

  /** Общий поиск по email (без секретов). Подходит для большинства кейсов. */
  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  /** Поиск по email с паролем (нужно для логина). */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .addSelect(['u.passwordHash'])
      .where('u.email = :email', { email })
      .getOne();
  }

  /** Сравнение пароля. На вход — пользователь, у которого выбран passwordHash. */
  validatePassword(
    userWithPassword: Pick<User, 'passwordHash'>,
    password: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, userWithPassword.passwordHash);
  }

  /** Обновление профиля. Возвращаем «чистого» пользователя. */
  async update(userId: number, dto: UpdateUserDto): Promise<User> {
    const partial = dto as QueryDeepPartialEntity<User>;
    await this.repo.update({ id: userId }, partial);
    const fresh = await this.repo.findOne({ where: { id: userId } });
    if (!fresh) throw new NotFoundException('user_not_found');
    return fresh;
  }

  /** Получение пользователя по id (без секретов). */
  async getUserById(userId: number): Promise<User> {
    const u = await this.repo.findOne({ where: { id: userId } });
    if (!u) throw new NotFoundException('user_not_found');
    return u;
  }

  async getAdminUsers(params: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<{
    items: Array<Pick<User, 'id' | 'name' | 'email' | 'balance'>>;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, Math.floor(params.page));
    const limit = Math.min(300, Math.max(1, Math.floor(params.limit)));
    const search = params.search?.trim();
    const qb = this.repo
      .createQueryBuilder('u')
      .select(['u.id', 'u.name', 'u.email', 'u.balance'])
      .orderBy('u.id', 'ASC');

    if (search) {
      if (/^\d+$/.test(search)) {
        qb.where('u.id = :id OR u.email ILIKE :email', {
          id: Number(search),
          email: `%${search}%`,
        });
      } else {
        qb.where('u.email ILIKE :email', { email: `%${search}%` });
      }
    }

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items, total, page, limit };
  }

  async clearAdminUserBalance(userId: number): Promise<{
    id: number;
    email: string;
    previousBalance: string;
    balance: string;
  }> {
    return this.repo.manager.transaction(async (manager) => {
      const user = await manager
        .getRepository(User)
        .createQueryBuilder('u')
        .setLock('pessimistic_write')
        .where('u.id = :id', { id: userId })
        .getOne();
      if (!user) throw new NotFoundException('user_not_found');

      const previousBalance = user.balance;
      user.balance = '0';
      await manager.getRepository(User).save(user);

      return {
        id: user.id,
        email: user.email,
        previousBalance,
        balance: user.balance,
      };
    });
  }

  async validateApiKey(userId: number, rawKey: string): Promise<boolean> {
    return Boolean(await this.validatePublicApiKey(userId, rawKey));
  }

  async validatePublicApiKey(
    userId: number,
    rawKey: string,
  ): Promise<{ ok: true; roles: string[] } | null> {
    const hash = sha256Hex(rawKey);
    const row = await this.repo
      .createQueryBuilder('u')
      .select('u.role', 'roles')
      .where('u.id = :id', { id: userId })
      .andWhere('u.apiKeyHash = :hash', { hash })
      .limit(1)
      .getRawOne<{ roles?: unknown }>();

    if (!row) return null;
    const roles = Array.isArray(row.roles)
      ? row.roles.filter((role): role is string => typeof role === 'string')
      : [];
    return { ok: true, roles };
  }

  private async clearPublicApiKeyCache(
    userId: number,
    apiKeyHash: string | null | undefined,
  ): Promise<void> {
    if (!apiKeyHash) return;
    try {
      await this.cache.del(`public-api-key:v1:${userId}:${apiKeyHash}`);
    } catch {
      // The guard cache has a short TTL, so failed invalidation is non-fatal.
    }
  }

  async setNewPassword(userId: number, password: string): Promise<void> {
    const user = await this.repo.findOne({
      where: { id: userId },
      select: ['id', 'passwordHash'],
    });

    if (!user) {
      throw new BadRequestException('user_not_found');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    user.passwordHash = passwordHash;
    await this.repo.save(user);
  }
}
