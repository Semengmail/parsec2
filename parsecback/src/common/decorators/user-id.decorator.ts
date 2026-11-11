// src/common/decorators/user-id.decorator.ts
import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const req = ctx.switchToHttp().getRequest<{ userId?: number }>();
    const sub = req.userId;
    if (typeof sub !== 'number' || !Number.isInteger(sub)) {
      throw new UnauthorizedException('invalid_user_id');
    }
    return sub;
  },
);
