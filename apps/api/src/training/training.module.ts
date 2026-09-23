import { Module } from '@nestjs/common';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import {
  HorseSessionsController,
  HorseTrainingPlansController,
  SessionsController,
  TrainingPlansController,
} from './training.controller';
import { TrainingService } from './training.service';

@Module({
  controllers: [
    HorseSessionsController,
    SessionsController,
    HorseTrainingPlansController,
    TrainingPlansController,
  ],
  providers: [TrainingService, HorseOwnershipGuard],
})
export class TrainingModule {}
