import { apiFetch } from '@/shared/lib/api/api-fetch';
import type { AuthUser } from '../model/use-auth-store';
import { apiRoutes } from '@/shared/api/apiRoutes';

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string | null;
  referralCode?: string;
}

export interface RegisterResponse {
  user: AuthUser & { name?: string | null };
  apiKey: string;
}

export async function apiRegister(
  payload: RegisterRequest,
): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>(apiRoutes.auth.register, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiLogin(
  email: string,
  password: string,
): Promise<{ ok: true }> {
  return apiFetch(apiRoutes.auth.login, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function apiLogout(): Promise<{ ok: true }> {
  return apiFetch(apiRoutes.auth.logout, { method: 'POST' });
}

export async function apiMe(): Promise<{ user: AuthUser }> {
  return apiFetch(apiRoutes.auth.me);
}

export async function apiForgotPassword(email: string): Promise<{ ok: true }> {
  return apiFetch(apiRoutes.auth.forgotPassword, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function apiResetPassword(
  token: string,
  newPassword: string,
): Promise<{ ok: true }> {
  return apiFetch(apiRoutes.auth.resetPassword, {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}
