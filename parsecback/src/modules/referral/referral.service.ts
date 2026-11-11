// src/modules/referral/referral.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Referral } from './entities/referral.entity';
import { cyrillicToLatin, maskLogin } from '@/shared/utils/format';

@Injectable()
export class ReferralService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Referral) private refRepo: Repository<Referral>,
  ) {}

  /**
   * Приватный метод — нормализует email/строку для генерации кода.
   * Использует глобальную утилиту cyrillicToLatin().
   */
  private _normalizeBaseEmail(email: string): string {
    if (!email) return 'referral';

    let base: string | null = email.split('@')[0].trim();

    // Преобразуем кириллицу в латиницу через готовую утилиту
    base = cyrillicToLatin(base);

    // Удаляем всё, кроме латинских букв и цифр
    base = base && base.replace(/[^a-zA-Z0-9]/g, '');

    // Если пусто или только цифры — добавляем префикс referral
    if (!base || /^\d+$/.test(base)) {
      base = `referral${base}`;
    }

    // ✅ теперь всё в нижнем регистре
    return base.toLowerCase();
  }

  /** Генерирует уникальный реферальный код */
  async generateReferralCode(email: string): Promise<string> {
    const clean = this._normalizeBaseEmail(email);

    let code = clean;
    let counter = 1;

    // теперь сравнение регистрозависимое → обычное where: { referralCode: code }
    while (await this.userRepo.findOne({ where: { referralCode: code } })) {
      code = `${clean}${counter++}`;
    }

    return code;
  }

  /** Сгенерировать коды для всех пользователей без referralCode */
  async createCodeForAllUsers() {
    const users = await this.userRepo.find();
    for (const u of users) {
      if (!u.referralCode) {
        u.referralCode = await this.generateReferralCode(u.email);
        await this.userRepo.save(u);
      }
    }
  }

  async validateCode(code: string): Promise<boolean> {
    return !!(await this.userRepo.findOne({
      where: { referralCode: code },
    }));
  }

  async getMyInvitees(referrerId: number) {
    const referrals = await this.refRepo.find({
      where: {
        referrer: { id: referrerId },
      },
      order: {
        createdAt: 'DESC',
      },
      relations: ['invitee'],
    });

    const list = referrals.map((r) => ({
      email: maskLogin(r.inviteeEmail ?? r.invitee?.email),
      registeredAt: r.createdAt.toISOString(),
      bonusGiven: r.bonusGiven,
      bonusAmount: r.bonusAmount ? Number(r.bonusAmount) : null,
    }));

    const withPayment = referrals.filter((r) => r.bonusGiven).length;
    const withoutPayment = referrals.length - withPayment;

    return {
      total: referrals.length,
      withPayment,
      withoutPayment,
      list,
    };
  }

  async getReferrerBonuses(referrerId: number) {
    const list = await this.refRepo.find({
      where: { referrer: { id: referrerId }, bonusGiven: true },
      order: { bonusGivenAt: 'DESC' },
    });

    const total = list.reduce((sum, r) => sum + Number(r.bonusAmount || 0), 0);

    return { total, list };
  }

  async attachReferralCode(
    userId: number,
    code: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, message: 'Пользователь не найден' };
    }

    if (user.authCount > 1) {
      return {
        success: false,
        message: 'Реферальный код можно применить только при регистрации',
      };
    }

    // Проверяем, не был ли уже кто-то привязан
    const existingReferral = await this.refRepo.findOne({
      where: [{ invitee: { id: userId } }, { inviteeEmail: user.email }],
    });

    if (existingReferral) {
      return {
        success: false,
        message: 'Реферальный код уже был использован',
      };
    }

    // Находим пригласившего (регистронезависимо)
    const referrer = await this.userRepo.findOne({
      where: { referralCode: ILike(code) },
    });

    if (!referrer) {
      return { success: false, message: 'Неверный реферальный код' };
    }

    // Нельзя указать свой же код
    if (referrer.id === user.id) {
      return {
        success: false,
        message: 'Нельзя использовать свой собственный код',
      };
    }

    // Создаём запись в referrals
    const referral = this.refRepo.create({
      referrer,
      invitee: user,
      referralCode: code,
      inviteeEmail: user.email,
    });

    await this.refRepo.save(referral);

    return {
      success: true,
      message: 'Реферальный код успешно привязан',
    };
  }
}
