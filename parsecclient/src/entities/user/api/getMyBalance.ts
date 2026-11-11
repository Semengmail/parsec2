// src/entities/user/api/getMyBalance.ts
import { apiRoutes } from '@/shared/api/apiRoutes';
import { apiFetch } from '@/shared/lib/api/api-fetch';

export type BalanceDto = { balance: string }; // тысячные рубля

export function getMyBalance() {
  return apiFetch<BalanceDto>(apiRoutes.balance.getMyBalance);
}
