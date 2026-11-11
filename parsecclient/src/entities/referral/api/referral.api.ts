// src/entities/referral/api/referral.api.ts

import { apiFetch } from '@/shared/lib/api/api-fetch';
import type {
  ValidateCodeResponse,
  MyInviteesResponse,
  ReferrerBonusesResponse,
  AttachReferralResponse,
} from './types';

/**
 * Проверка реферального кода (публичный)
 * GET /referral/validate/:code
 */
export function validateReferralCode(
  code: string,
): Promise<ValidateCodeResponse> {
  return apiFetch(`/referral/validate/${encodeURIComponent(code)}`);
}

/**
 * Список приглашённых пользователей
 * GET /referral/my-invitees
 * auth: cookie (AccessTokenGuard)
 */
export function getMyInvitees(): Promise<MyInviteesResponse> {
  return apiFetch('/referral/my-invitees');
}

/**
 * Мои начисленные реферальные бонусы
 * GET /referral/my-bonuses
 * auth: cookie (AccessTokenGuard)
 */
export function getMyReferralBonuses(): Promise<ReferrerBonusesResponse> {
  return apiFetch('/referral/my-bonuses');
}

/**
 * Привязка реферального кода к текущему пользователю
 * POST /referral/attach/:code
 * auth: cookie (AccessTokenGuard)
 */
export function attachReferralCode(
  code: string,
): Promise<AttachReferralResponse> {
  return apiFetch(`/referral/attach/${encodeURIComponent(code)}`, {
    method: 'POST',
  });
}
