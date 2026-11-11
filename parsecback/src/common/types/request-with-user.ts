import type { Request } from 'express';
import type { User } from '@/modules/users/entities/user.entity';

/**
 * Express Request с типизированным `user`, который добавляется JwtCookieGuard-ом.
 * Используется в контроллерах.
 */
export type RequestWithUser = Request & { user: User };
