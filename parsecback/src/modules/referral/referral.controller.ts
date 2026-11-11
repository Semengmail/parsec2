// src/modules/referral/referral.controller.ts
import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ReferralService } from './referral.service';
import { JwtCookieGuard } from '@/common/guards/jwt-cookie.guard';
import { UserId } from '@/common/decorators/user-id.decorator';
import { AdminGuard } from '@/common/guards/admin.guard';

// === DTOs для Swagger ===
class ValidateCodeResponseDto {
  /** Существует ли реферальный код */
  valid: boolean;
}

class ReferrerBonusItemDto {
  /** Сумма начисленного бонуса (₽) */
  bonusAmount: number;
  /** Email приглашённого пользователя */
  inviteeEmail: string;
  /** Дата начисления бонуса (ISO) */
  bonusGivenAt: string;
}

class ReferrerBonusesResponseDto {
  /** Итоговая сумма всех бонусов (₽) */
  total: number;
  /** Список выплат */
  list: ReferrerBonusItemDto[];
}

class AttachReferralResponseDto {
  /** Успешно ли привязан код */
  success: boolean;
  /** Сообщение о результате операции */
  message: string;
}

class InviteeItemDto {
  email: string;
  registeredAt: string;
  bonusGiven: boolean;
  bonusAmount: number | null;
}

class MyInviteesResponseDto {
  total: number;
  withPayment: number;
  withoutPayment: number;
  list: InviteeItemDto[];
}

@ApiTags('Referral')
@Controller('referral')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get('validate/:code')
  @ApiOperation({
    summary: 'Проверить валидность реферального кода',
    description:
      'Проверяет, существует ли указанный реферальный код в системе (регистронезависимо).',
  })
  @ApiParam({
    name: 'code',
    description: 'Реферальный код (например, IVANIVANOV или USER123)',
    example: 'IVANIVANOV',
  })
  @ApiOkResponse({
    description: 'Код проверен',
    type: ValidateCodeResponseDto,
    schema: {
      example: { valid: true },
    },
  })
  async validateCode(
    @Param('code') code: string,
  ): Promise<ValidateCodeResponseDto> {
    const exists = await this.referralService.validateCode(code);
    return { valid: exists };
  }

  @Get('my-invitees')
  @UseGuards(JwtCookieGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Получить всех приглашённых пользователей',
    description:
      'Возвращает список всех пользователей, зарегистрировавшихся по реферальной ссылке текущего пользователя, независимо от оплаты.',
  })
  async myInvitees(@UserId() userId: number): Promise<MyInviteesResponseDto> {
    if (!userId) throw new Error('Вы не авторизованы');

    return this.referralService.getMyInvitees(userId);
  }

  @Get('my-bonuses')
  @UseGuards(JwtCookieGuard)
  @ApiOperation({
    summary: 'Получить список своих реферальных бонусов',
    description:
      'Возвращает список зачисленных бонусов и их суммарное значение для текущего авторизованного пользователя (владельца кода).',
  })
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Список бонусов возвращён',
    type: ReferrerBonusesResponseDto,
    schema: {
      example: {
        total: 3250,
        list: [
          {
            bonusAmount: 1000,
            inviteeEmail: 'guest1@example.com',
            bonusGivenAt: '2025-10-29T09:15:31.000Z',
          },
          {
            bonusAmount: 750,
            inviteeEmail: 'guest2@example.com',
            bonusGivenAt: '2025-10-28T12:01:00.000Z',
          },
        ],
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' })
  async myBonuses(
    @UserId() userId: number,
  ): Promise<ReferrerBonusesResponseDto> {
    if (!userId) throw new Error('Вы не авторизованы');

    const { total, list } =
      await this.referralService.getReferrerBonuses(userId);

    // 🧩 Преобразуем Referral[] → DTO[]
    const formattedList = list.map((r) => ({
      bonusAmount: Number(r.bonusAmount || 0),
      inviteeEmail: r.inviteeEmail || '(неизвестно)',
      bonusGivenAt: r.bonusGivenAt?.toISOString() ?? '',
    }));

    return { total: Number(total), list: formattedList };
  }

  @Post('attach/:code')
  @UseGuards(JwtCookieGuard)
  @ApiOperation({
    summary: 'Привязать реферальный код к текущему пользователю',
    description:
      'Используется для пользователей, вошедших через соцсети: код считывается с фронта из кук и один раз привязывается к аккаунту. Нельзя привязать свой собственный код или повторно привязывать код.',
  })
  @ApiBearerAuth()
  @ApiParam({
    name: 'code',
    description: 'Реферальный код пригласившего',
    example: 'PETROV',
  })
  @ApiOkResponse({
    description: 'Код успешно привязан',
    type: AttachReferralResponseDto,
    schema: {
      example: { success: true, message: 'Реферальный код успешно привязан' },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Неверный код / попытка привязать свой же код / код уже привязан к этому пользователю',
  })
  @ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' })
  async attachReferral(
    @UserId() userId: number,
    @Param('code') code: string,
  ): Promise<AttachReferralResponseDto> {
    if (!userId) throw new Error('Вы не авторизованы');
    return await this.referralService.attachReferralCode(userId, code);
  }

  @Get('generate-codes')
  @UseGuards(AdminGuard)
  async generateCodes() {
    return await this.referralService.createCodeForAllUsers();
  }
}
