import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserRoles = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string[] => {
    const req = ctx.switchToHttp().getRequest<{ userRoles?: string[] }>();
    return Array.isArray(req.userRoles) ? req.userRoles : [];
  },
);
