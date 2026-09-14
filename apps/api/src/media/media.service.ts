import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { open, unlink } from 'fs/promises';
import sharp from 'sharp';
import { Readable } from 'stream';
import { Media, MediaDocument } from './schemas/media.schema';
import { MediaType } from './enums/media-type.enum';
import { MEDIA_LIMITS, extensionForMimeType } from './constants/media-limits';
import { detectMimeFromBuffer } from './utils/file-signature';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from './storage/storage-provider.interface';

export interface MediaSummary {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  mediaType: MediaType;
  createdAt: Date;
  metadata?: {
    width?: number;
    height?: number;
    aspectRatio?: number;
  };
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectModel(Media.name) private readonly mediaModel: Model<MediaDocument>,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async upload(params: {
    workspaceId: string;
    userId: string;
    file: Express.Multer.File;
  }): Promise<MediaSummary> {
    const filePath = params.file?.path;
    const hasBuffer = Boolean(params.file?.buffer);

    if (!params.file || (!filePath && !hasBuffer)) {
      throw new BadRequestException({
        code: 'INVALID_FILE',
        message: 'No upload data was provided',
      });
    }

    const detectedMime = await this.detectMime(params.file);

    if (!detectedMime) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'This file type is not recognized or supported',
      });
    }

    const isImage = (
      MEDIA_LIMITS.ALLOWED_IMAGE_TYPES as readonly string[]
    ).includes(detectedMime);
    const isVideo = (
      MEDIA_LIMITS.ALLOWED_VIDEO_TYPES as readonly string[]
    ).includes(detectedMime);

    if (!isImage && !isVideo) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: `${detectedMime} is not a supported media type`,
      });
    }

    const maxSize = isImage
      ? MEDIA_LIMITS.MAX_IMAGE_SIZE_BYTES
      : MEDIA_LIMITS.MAX_VIDEO_SIZE_BYTES;

    if (params.file.size > maxSize) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `File exceeds the maximum allowed size of ${Math.round(maxSize / (1024 * 1024))}MB`,
      });
    }

    let metadata:
      { width?: number; height?: number; aspectRatio?: number } | undefined;

    if (isImage) {
      try {
        const image = filePath ? sharp(filePath) : sharp(params.file.buffer);
        const imgMeta = await image.metadata();

        if (imgMeta.width && imgMeta.height) {
          metadata = {
            width: imgMeta.width,
            height: imgMeta.height,
            aspectRatio: Number((imgMeta.width / imgMeta.height).toFixed(2)),
          };
        }
      } catch {
        throw new BadRequestException({
          code: 'INVALID_MEDIA_CONTENT',
          message: 'The uploaded image could not be decoded',
        });
      }
    }

    const generatedFilename = `${randomUUID()}${extensionForMimeType(detectedMime)}`;
    let storageKey: string | undefined;

    try {
      const saved = filePath
        ? await this.storage.saveFromFile({
            workspaceId: params.workspaceId,
            filename: generatedFilename,
            filePath,
          })
        : await this.storage.save({
            workspaceId: params.workspaceId,
            filename: generatedFilename,
            buffer: params.file.buffer,
          });

      storageKey = saved.storageKey;

      const media = await this.mediaModel.create({
        workspaceId: new Types.ObjectId(params.workspaceId),
        uploadedBy: new Types.ObjectId(params.userId),
        originalName: params.file.originalname,
        mimeType: detectedMime,
        size: params.file.size,
        storageKey,
        mediaType: isImage ? MediaType.IMAGE : MediaType.VIDEO,
        postId: null,
        metadata,
      });

      return this.toSummary(media);
    } catch (err) {
      if (storageKey) {
        try {
          await this.storage.delete(storageKey);
        } catch {
          // Preserve the original failure. Cleanup sweep cannot recover a
          // file without a Mongo document, so best-effort cleanup is explicit.
        }
      }
      throw err;
    } finally {
      if (filePath) {
        await unlink(filePath).catch(() => undefined);
      }
    }
  }

  async getFileForDownload(
    workspaceId: string,
    mediaId: string,
  ): Promise<{ stream: Readable; mimeType: string; filename: string }> {
    if (!Types.ObjectId.isValid(mediaId)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid media ID format',
      });
    }

    const media = await this.mediaModel.findOne({
      _id: new Types.ObjectId(mediaId),
      workspaceId: new Types.ObjectId(workspaceId),
    });

    if (!media) {
      throw new NotFoundException({
        code: 'MEDIA_NOT_FOUND',
        message: 'Media not found',
      });
    }

    return {
      stream: this.storage.createReadStream(media.storageKey),
      mimeType: media.mimeType,
      filename: media.originalName,
    };
  }

  async delete(workspaceId: string, mediaId: string): Promise<void> {
    if (!Types.ObjectId.isValid(mediaId)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid media ID format',
      });
    }

    const media = await this.mediaModel.findOne({
      _id: new Types.ObjectId(mediaId),
      workspaceId: new Types.ObjectId(workspaceId),
    });

    if (!media) {
      throw new NotFoundException({
        code: 'MEDIA_NOT_FOUND',
        message: 'Media not found',
      });
    }

    if (media.postId) {
      throw new ForbiddenException({
        code: 'MEDIA_ATTACHED',
        message:
          'This media is attached to a post and cannot be deleted directly',
      });
    }

    const deleted = await this.mediaModel.findOneAndDelete({
      _id: media._id,
      workspaceId: new Types.ObjectId(workspaceId),
      postId: null,
    });

    if (!deleted) {
      throw new ForbiddenException({
        code: 'MEDIA_CHANGED',
        message: 'Media changed before it could be deleted',
      });
    }

    try {
      await this.storage.delete(deleted.storageKey);
    } catch (err) {
      // The DB deletion is durable. Do not restore the record because that
      // would reintroduce an attachment race. Storage cleanup is best-effort.
      this.logger.error(
        `Failed to delete media file mediaId=${deleted._id.toString()} storageKey=${deleted.storageKey}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async deleteFileByStorageKey(storageKey: string): Promise<void> {
    await this.storage.delete(storageKey);
  }

  private async detectMime(file: Express.Multer.File): Promise<string | null> {
    if (file.path) {
      const handle = await open(file.path, 'r');
      try {
        const header = Buffer.alloc(12);
        const { bytesRead } = await handle.read(header, 0, 12, 0);
        return detectMimeFromBuffer(header.subarray(0, bytesRead));
      } finally {
        await handle.close();
      }
    }

    return detectMimeFromBuffer(file.buffer);
  }

  private toSummary(m: MediaDocument): MediaSummary {
    return {
      id: m._id.toString(),
      originalName: m.originalName,
      mimeType: m.mimeType,
      size: m.size,
      mediaType: m.mediaType,
      createdAt: m.createdAt,
      metadata: m.metadata,
    };
  }
}
