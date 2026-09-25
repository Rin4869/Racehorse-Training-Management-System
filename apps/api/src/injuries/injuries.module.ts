import { Module } from '@nestjs/common';
import {
  HealthRecordInjuryLocationsController,
  IncidentInjuryLocationsController,
} from './injuries.controller';
import { InjuriesService } from './injuries.service';

@Module({
  controllers: [
    IncidentInjuryLocationsController,
    HealthRecordInjuryLocationsController,
  ],
  providers: [InjuriesService],
})
export class InjuriesModule {}
