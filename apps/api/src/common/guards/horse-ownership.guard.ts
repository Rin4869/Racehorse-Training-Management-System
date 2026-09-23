import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { Horse, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../app-exception';
import type { AuthUser } from '../decorators/current-user.decorator';

/**
 * Guards routes that carry a horse id in `:id`. Loads the (non-deleted) horse,
 * 404s if missing, and 403s when an OWNER targets a horse they do not own.
 * Other roles pass. Attaches `req.horse` so handlers can reuse it.
 *
 * Reused by Phase 3 (training sessions) and Phase 4 (health records).
 */
@Injectable()
export class HorseOwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user: AuthUser; horse?: Horse }>();

    const horseId = req.params.id;
    if (!horseId || typeof horseId !== 'string') return true;

    const horse = await this.prisma.horse.findFirst({
      where: { id: horseId, deletedAt: null },
    });
    if (!horse) {
      throw new AppException('NOT_FOUND', 'Horse not found');
    }
    if (req.user.role === Role.OWNER && horse.ownerId !== req.user.id) {
      throw new AppException(
        'FORBIDDEN',
        'This horse belongs to another owner',
      );
    }

    req.horse = horse;
    return true;
  }
}
