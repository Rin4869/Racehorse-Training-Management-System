import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Role, UserStatus } from '@prisma/client';

/** Shape attached to `req.user` by JwtAuthGuard. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role | null;
  status: UserStatus;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    return req.user;
  },
);
