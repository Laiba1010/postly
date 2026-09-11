import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
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
  constructor(
    @InjectModel(Media.name) private readonly mediaModel: Model<MediaDocument>,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /**
   * Validates file signature, extracts image metadata, persists file to storage provider,
   * and saves media metadata document in MongoDB.
   */
  async upload(params: {
    workspaceId: string;
    userId: string;
    file: Express.Multer.File;
  }): Promise<MediaSummary> {
    if (!params.file || !params.file.buffer) {
      throw new BadRequestException({
        code: 'INVALID_FILE',
        message: 'No file buffer provided for upload',
      });
    }

    // 1. Magic-byte MIME type validation
    const detectedMime = detectMimeFromBuffer(params.file.buffer);

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

    // 2. Size limit checks
    const maxSize = isImage
      ? MEDIA_LIMITS.MAX_IMAGE_SIZE_BYTES
      : MEDIA_LIMITS.MAX_VIDEO_SIZE_BYTES;
    if (params.file.size > maxSize) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `File exceeds the maximum allowed size of ${Math.round(maxSize / (1024 * 1024))}MB`,
      });
    }

    // 3. Extract Image Metadata (width, height, aspectRatio)
    let metadata:
      { width?: number; height?: number; aspectRatio?: number } | undefined =
      undefined;
    if (isImage) {
      try {
        const imgMeta = await sharp(params.file.buffer).metadata();
        if (imgMeta.width && imgMeta.height) {
          metadata = {
            width: imgMeta.width,
            height: imgMeta.height,
            aspectRatio: Number((imgMeta.width / imgMeta.height).toFixed(2)),
          };
        }
      } catch {
        // Fall back gracefully if sharp fails to parse corrupt image streams
      }
    }

    // 4. Save to Storage Provider
    const generatedFilename = `${randomUUID()}${extensionForMimeType(detectedMime)}`;
    const { storageKey } = await this.storage.save({
      workspaceId: params.workspaceId,
      filename: generatedFilename,
      buffer: params.file.buffer,
    });

    // 5. Create Database Record
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
  }

  /**
   * Retrieves raw file buffer and headers for stream/download handlers.
   */
  async getFileForDownload(
    workspaceId: string,
    mediaId: string,
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
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

    const buffer = await this.storage.read(media.storageKey);
    return { buffer, mimeType: media.mimeType, filename: media.originalName };
  }

  /**
   * User-facing media deletion. Blocks deletion if media is currently attached to a saved post.
   */
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

    await this.storage.delete(media.storageKey);
    await media.deleteOne();
  }

  /**
   * System helper used by PostsService (on draft deletion) and MediaCleanupService (on orphan sweep)
   * to delete physical files directly from storage.
   */
  async deleteFileByStorageKey(storageKey: string): Promise<void> {
    await this.storage.delete(storageKey);
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
