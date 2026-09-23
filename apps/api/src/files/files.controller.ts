import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { AppException } from '../common/app-exception';
import { HorsesService } from '../horses/horses.service';
import { FileStorageService } from './file-storage.service';
import { HORSE_PHOTO_KIND, SAFE_FILENAME } from './upload';

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(
    private readonly horses: HorsesService,
    private readonly storage: FileStorageService,
  ) {}

  @Get('horse-photos/:filename')
  async horsePhoto(
    @Param('filename') filename: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    if (!SAFE_FILENAME.test(filename)) {
      throw new AppException('NOT_FOUND', 'File not found');
    }
    const horse = await this.horses.findByPhotoPath(
      `${HORSE_PHOTO_KIND}/${filename}`,
    );
    if (!horse || !this.storage.exists(HORSE_PHOTO_KIND, filename)) {
      throw new AppException('NOT_FOUND', 'File not found');
    }
    if (user.role === Role.OWNER && horse.ownerId !== user.id) {
      throw new AppException('FORBIDDEN', 'This file belongs to another owner');
    }
    res.sendFile(this.storage.absolutePath(HORSE_PHOTO_KIND, filename));
  }
}
