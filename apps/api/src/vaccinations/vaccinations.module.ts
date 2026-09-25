import { Module } from '@nestjs/common';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import {
  HorseVaccinationsController,
  VaccinationsController,
} from './vaccinations.controller';
import { VaccinationsService } from './vaccinations.service';

@Module({
  controllers: [HorseVaccinationsController, VaccinationsController],
  providers: [VaccinationsService, HorseOwnershipGuard],
})
export class VaccinationsModule {}
