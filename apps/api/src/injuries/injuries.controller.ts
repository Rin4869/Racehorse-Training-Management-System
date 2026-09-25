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
import { InjuriesService } from './injuries.service';
import { CreateInjuryLocationDto } from './dto/injuries.dto';

@ApiTags('injuries')
@ApiBearerAuth()
@Controller('incidents/:id/injury-locations')
export class IncidentInjuryLocationsController {
  constructor(private readonly injuries: InjuriesService) {}

  @Post()
  @Roles(Role.VET)
  create(
    @Param('id', ParseUUIDPipe) incidentId: string,
    @Body() dto: CreateInjuryLocationDto,
  ) {
    return this.injuries.createForIncident(incidentId, dto);
  }

  @Get()
  list(
    @Param('id', ParseUUIDPipe) incidentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.injuries.listForIncident(incidentId, user);
  }
}

@ApiTags('injuries')
@ApiBearerAuth()
@Controller('health-records/:id/injury-locations')
export class HealthRecordInjuryLocationsController {
  constructor(private readonly injuries: InjuriesService) {}

  @Post()
  @Roles(Role.VET)
  create(
    @Param('id', ParseUUIDPipe) healthRecordId: string,
    @Body() dto: CreateInjuryLocationDto,
  ) {
    return this.injuries.createForHealthRecord(healthRecordId, dto);
  }

  @Get()
  list(
    @Param('id', ParseUUIDPipe) healthRecordId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.injuries.listForHealthRecord(healthRecordId, user);
  }
}
