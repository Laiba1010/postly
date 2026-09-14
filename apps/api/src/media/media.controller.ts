import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { basename } from 'path';
import type { Response } from 'express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { PublicUser } from '../auth/auth.service';
import { MediaService } from './media.service';
import { MEDIA_LIMITS } from './constants/media-limits';

@Controller('workspaces/:workspaceId/media')
@UseGuards(AuthGuard, WorkspaceGuard, RolesGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @Roles(Role.OWNER, Role.EDITOR)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: tmpdir(),
        filename: (_req, file, cb) => {
          cb(null, `postly-${randomUUID()}-${basename(file.originalname)}`);
        },
      }),
      limits: { fileSize: MEDIA_LIMITS.MAX_VIDEO_SIZE_BYTES },
    }),
  )
  async upload(
    @Param('workspaceId') workspaceId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: PublicUser,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'MISSING_FILE',
        message: 'No file was uploaded',
      });
    }

    const media = await this.mediaService.upload({
      workspaceId,
      userId: user.id,
      file,
    });
    return { media };
  }

  @Get(':mediaId/file')
  @Roles(Role.OWNER, Role.EDITOR, Role.VIEWER)
  async getFile(
    @Param('workspaceId') workspaceId: string,
    @Param('mediaId') mediaId: string,
    @Res() res: Response,
  ) {
    const { stream, mimeType, filename } =
      await this.mediaService.getFileForDownload(workspaceId, mediaId);

    const safeFilename = basename(filename).replace(/[\r\n"\\]/g, '_');
    const asciiFilename = safeFilename.replace(/[^\x20-\x7E]/g, '_');
    const encodedFilename = encodeURIComponent(safeFilename);

    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
    );
    res.setHeader('Cache-Control', 'private, max-age=3600');
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(HttpStatus.NOT_FOUND).end();
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  }

  @Delete(':mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.OWNER, Role.EDITOR)
  async remove(
    @Param('workspaceId') workspaceId: string,
    @Param('mediaId') mediaId: string,
  ) {
    await this.mediaService.delete(workspaceId, mediaId);
  }
}
