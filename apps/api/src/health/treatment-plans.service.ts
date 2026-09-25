import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app-exception';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  CreateMedicationDto,
  CreateTreatmentPlanDto,
} from './dto/treatment-plans.dto';

@Injectable()
export class TreatmentPlansService {
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

  async createForHealthRecord(
    healthRecordId: string,
    dto: CreateTreatmentPlanDto,
  ) {
    const record = await this.prisma.healthRecord.findUnique({
      where: { id: healthRecordId },
      select: { id: true },
    });
    if (!record) {
      throw new AppException('NOT_FOUND', 'Health record not found');
    }

    return this.prisma.treatmentPlan.create({
      data: {
        healthRecordId,
        description: dto.description.trim(),
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
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

    return this.prisma.treatmentPlan.findMany({
      where: { healthRecordId },
      orderBy: { startDate: 'desc' },
    });
  }

  async createMedication(planId: string, dto: CreateMedicationDto) {
    const plan = await this.prisma.treatmentPlan.findUnique({
      where: { id: planId },
      select: { healthRecordId: true },
    });
    if (!plan) throw new AppException('NOT_FOUND', 'Treatment plan not found');

    return this.prisma.medication.create({
      data: {
        healthRecordId: plan.healthRecordId,
        treatmentPlanId: planId,
        name: dto.name.trim(),
        dosage: dto.dosage?.trim() ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async listMedications(planId: string, user: AuthUser) {
    const plan = await this.prisma.treatmentPlan.findUnique({
      where: { id: planId },
      select: {
        healthRecord: { select: { horse: { select: { ownerId: true } } } },
      },
    });
    if (!plan) throw new AppException('NOT_FOUND', 'Treatment plan not found');
    this.assertHorseVisible(plan.healthRecord.horse, user);

    return this.prisma.medication.findMany({
      where: { treatmentPlanId: planId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
