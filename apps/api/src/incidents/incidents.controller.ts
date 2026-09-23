import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import { IncidentsService } from './incidents.service';
import {
  CreateIncidentDto,
  ListIncidentsQueryDto,
  UpdateIncidentDto,
} from './dto/incidents.dto';

@ApiTags('incidents')
@ApiBearerAuth()
@Controller('horses/:id/incidents')
@UseGuards(HorseOwnershipGuard)
export class HorseIncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Post()
  @Roles(Role.GROOM)
  create(
    @Param('id', ParseUUIDPipe) horseId: string,
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.incidents.create(horseId, dto, user);
  }

  @Get()
  list(
    @Param('id', ParseUUIDPipe) horseId: string,
    @Query() q: ListIncidentsQueryDto,
  ) {
    return this.incidents.listByHorse(horseId, q);
  }
}

@ApiTags('incidents')
@ApiBearerAuth()
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.incidents.get(id, user);
  }

  @Patch(':id')
  @Roles(Role.VET)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIncidentDto,
  ) {
    return this.incidents.update(id, dto);
  }
}
