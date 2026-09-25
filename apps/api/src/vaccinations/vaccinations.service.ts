import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app-exception';
import type { Paginated } from '../horses/horses.service';
import {
  CreateVaccinationDto,
  ListUpcomingVaccinationsQueryDto,
  ListVaccinationsQueryDto,
} from './dto/vaccinations.dto';

const UPCOMING_WINDOW_DAYS = 30;

@Injectable()
export class VaccinationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(horseId: string, dto: CreateVaccinationDto) {
    const horse = await this.prisma.horse.findFirst({
      where: { id: horseId, deletedAt: null },
      select: { id: true },
    });
    if (!horse) throw new AppException('NOT_FOUND', 'Horse not found');

    return this.prisma.vaccination.create({
      data: {
        horseId,
        vaccineName: dto.vaccineName.trim(),
        date: new Date(dto.date),
        nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : null,
      },
    });
  }

  async listByHorse(horseId: string, q: ListVaccinationsQueryDto) {
    const where: Prisma.VaccinationWhereInput = { horseId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.vaccination.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.vaccination.count({ where }),
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total } };
  }

  /** Club-wide view (UC-18) — no per-horse ownership; OWNER is blocked at the route. */
  async listUpcoming(
    q: ListUpcomingVaccinationsQueryDto,
  ): Promise<Paginated<Prisma.VaccinationGetPayload<object>>> {
    const where: Prisma.VaccinationWhereInput = {};
    if (q.upcoming) {
      const now = new Date();
      const until = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * 86_400_000);
      where.nextDueDate = { gte: now, lte: until };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.vaccination.findMany({
        where,
        orderBy: { nextDueDate: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.vaccination.count({ where }),
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total } };
  }
}
