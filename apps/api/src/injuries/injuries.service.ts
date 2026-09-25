import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app-exception';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateInjuryLocationDto } from './dto/injuries.dto';

@Injectable()
export class InjuriesService {
  constructor(private readonly prisma: PrismaService) {}

  private assertHorseVisible(
    horse: { ownerId: string } | null | undefined,
    user: AuthUser,
  ): void {
    if (!horse) throw new AppException('NOT_FOUND', 'Horse not found');
    if (user.role === Role.OWNER && horse.ownerId !== user.id) {
      throw new AppException(
        'FORBIDDEN',
        'This horse belongs to another owner',
      );
    }
  }

  async createForIncident(incidentId: string, dto: CreateInjuryLocationDto) {
    const incident = await this.prisma.incidentReport.findUnique({
      where: { id: incidentId },
      select: { id: true },
    });
    if (!incident) throw new AppException('NOT_FOUND', 'Incident not found');

    return this.prisma.injuryLocation.create({
      data: {
        incidentReportId: incidentId,
        bodyRegion: dto.bodyRegion.trim(),
        side: dto.side?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
      },
    });
  }

  async listForIncident(incidentId: string, user: AuthUser) {
    const incident = await this.prisma.incidentReport.findUnique({
      where: { id: incidentId },
      select: { horse: { select: { ownerId: true } } },
    });
    if (!incident) throw new AppException('NOT_FOUND', 'Incident not found');
    this.assertHorseVisible(incident.horse, user);

    return this.prisma.injuryLocation.findMany({
      where: { incidentReportId: incidentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createForHealthRecord(
    healthRecordId: string,
    dto: CreateInjuryLocationDto,
  ) {
    const record = await this.prisma.healthRecord.findUnique({
      where: { id: healthRecordId },
      select: { id: true },
    });
    if (!record) {
      throw new AppException('NOT_FOUND', 'Health record not found');
    }

    return this.prisma.injuryLocation.create({
      data: {
        healthRecordId,
        bodyRegion: dto.bodyRegion.trim(),
        side: dto.side?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
      },
    });
  }

  async listForHealthRecord(healthRecordId: string, user: AuthUser) {
    const record = await this.prisma.healthRecord.findUnique({
      where: { id: healthRecordId },
      select: { horse: { select: { ownerId: true } } },
    });
    if (!record) {
      throw new AppException('NOT_FOUND', 'Health record not found');
    }
    this.assertHorseVisible(record.horse, user);

    return this.prisma.injuryLocation.findMany({
      where: { healthRecordId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
