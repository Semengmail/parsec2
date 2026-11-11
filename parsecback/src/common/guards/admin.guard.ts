import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtCookieGuard } from './jwt-cookie.guard';
import type { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly session: JwtCookieGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!(await this.session.canActivate(context))) return false;
    const { user } = context.switchToHttp().getRequest<{ user?: User }>();
    if (!user) throw new UnauthorizedException('user_not_found');
    if (!Array.isArray(user.role) || !user.role.includes('admin')) {
      throw new ForbiddenException('admin_only');
    }
    return true;
  }
}
