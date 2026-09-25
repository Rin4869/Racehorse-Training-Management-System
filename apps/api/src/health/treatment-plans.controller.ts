import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { TreatmentPlansService } from './treatment-plans.service';
import {
  CreateMedicationDto,
  CreateTreatmentPlanDto,
} from './dto/treatment-plans.dto';

@ApiTags('health')
@ApiBearerAuth()
@Controller('health-records/:id/treatment-plans')
export class HealthRecordTreatmentPlansController {
  constructor(private readonly plans: TreatmentPlansService) {}

  @Post()
  @Roles(Role.VET)
  create(
    @Param('id', ParseUUIDPipe) healthRecordId: string,
    @Body() dto: CreateTreatmentPlanDto,
  ) {
    return this.plans.createForHealthRecord(healthRecordId, dto);
  }

  @Get()
  list(
    @Param('id', ParseUUIDPipe) healthRecordId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.plans.listForHealthRecord(healthRecordId, user);
  }
}

@ApiTags('health')
@ApiBearerAuth()
@Controller('treatment-plans/:id/medications')
export class TreatmentPlanMedicationsController {
  constructor(private readonly plans: TreatmentPlansService) {}

  @Post()
  @Roles(Role.VET)
  create(
    @Param('id', ParseUUIDPipe) planId: string,
    @Body() dto: CreateMedicationDto,
  ) {
    return this.plans.createMedication(planId, dto);
  }

  @Get()
  list(
    @Param('id', ParseUUIDPipe) planId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.plans.listMedications(planId, user);
  }
}
