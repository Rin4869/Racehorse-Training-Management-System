import { Module } from '@nestjs/common';
import { HorsesModule } from '../horses/horses.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FilesModule } from '../files/files.module';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import {
  HorseIncidentsController,
  IncidentFilesController,
  IncidentsController,
} from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [HorsesModule, NotificationsModule, FilesModule],
  controllers: [
    HorseIncidentsController,
    IncidentsController,
    IncidentFilesController,
  ],
  providers: [IncidentsService, HorseOwnershipGuard],
})
export class IncidentsModule {}
