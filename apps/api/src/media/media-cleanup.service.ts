import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
      await this.storage.delete(orphan.storageKey);
      await orphan.deleteOne();
    }

    if (orphans.length > 0) {
      this.logger.log(`Cleaned up ${orphans.length} orphaned media file(s)`);
    }
  }
}
