import { Module } from '@nestjs/common';
import { HorsesModule } from '../horses/horses.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import {
  HorseIncidentsController,
  IncidentsController,
} from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [HorsesModule, NotificationsModule],
  controllers: [HorseIncidentsController, IncidentsController],
  providers: [IncidentsService, HorseOwnershipGuard],
})
export class IncidentsModule {}
