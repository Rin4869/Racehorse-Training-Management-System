import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import {
  HealthFilesController,
  HealthRecordsController,
  HorseHealthRecordsController,
} from './health-records.controller';
import { HealthRecordsService } from './health-records.service';

@Module({
  imports: [FilesModule],
  controllers: [
    HorseHealthRecordsController,
    HealthRecordsController,
    HealthFilesController,
  ],
  providers: [HealthRecordsService, HorseOwnershipGuard],
})
export class HealthRecordsModule {}
