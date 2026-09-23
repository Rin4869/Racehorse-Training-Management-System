import { Module } from '@nestjs/common';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import {
  HorseRaceEntriesController,
  RaceEntriesController,
  RacesController,
} from './races.controller';
import { RacesService } from './races.service';

@Module({
  controllers: [
    RacesController,
    HorseRaceEntriesController,
    RaceEntriesController,
  ],
  providers: [RacesService, HorseOwnershipGuard],
})
export class RacesModule {}
