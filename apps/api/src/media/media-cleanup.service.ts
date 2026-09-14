import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { readdir, stat, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Media, MediaDocument } from './schemas/media.schema';
import { MEDIA_LIMITS } from './constants/media-limits';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from './storage/storage-provider.interface';

/**
 * Removes media that was uploaded but never attached to a saved draft.
 * This is intentionally a simple scheduled sweep, not a queue-based job —
 * BullMQ (Phase 8) is for publishing infrastructure, a different concern.
 * Orphan cleanup has no retry/backoff requirements, so a lightweight
 * @nestjs/schedule cron is the right-sized tool here.
 */
@Injectable()
export class MediaCleanupService {
  private readonly logger = new Logger(MediaCleanupService.name);

  constructor(
    @InjectModel(Media.name) private readonly mediaModel: Model<MediaDocument>,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOrphans(): Promise<void> {
    const cutoff = new Date(
      Date.now() - MEDIA_LIMITS.ORPHAN_TTL_HOURS * 60 * 60 * 1000,
    );

    const orphans = await this.mediaModel.find({
      postId: null,
      createdAt: { $lt: cutoff },
    });

    for (const orphan of orphans) {
      const deleted = await this.mediaModel.findOneAndDelete({
        _id: orphan._id,
        postId: null,
      });

      if (!deleted) continue;

      try {
        await this.storage.delete(deleted.storageKey);
      } catch (err) {
        this.logger.error(
          `Failed to delete orphan media file mediaId=${deleted._id.toString()} storageKey=${deleted.storageKey}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (orphans.length > 0) {
      this.logger.log(`Cleaned up ${orphans.length} orphaned media file(s)`);
    }

    await this.cleanupUploadTempFiles();
  }

  private async cleanupUploadTempFiles(): Promise<void> {
    const now = Date.now();
    const tempDirectory = tmpdir();

    try {
      const entries = await readdir(tempDirectory);

      for (const entry of entries) {
        if (!entry.startsWith('postly-')) continue;

        const fullPath = join(tempDirectory, entry);
        try {
          const info = await stat(fullPath);
          if (now - info.mtimeMs > 60 * 60 * 1000) {
            await unlink(fullPath).catch(() => undefined);
          }
        } catch {
          // The file may have been removed by a completed upload concurrently.
        }
      }
    } catch (err) {
      this.logger.error(
        `Failed to clean upload temp files: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
