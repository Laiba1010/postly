import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Post, PostDocument } from '../posts/schemas/post.schema';
import { PublishingAttemptStatus } from '../posts/enums/publishing-attempt-status.enum';
import {
  PostTarget,
  PostTargetDocument,
} from '../posts/schemas/post-target.schema';
import { PostStatus } from '../posts/enums/post-status.enum';
import { PostTargetStatus } from '../posts/enums/post-target-status.enum';
import {
  PublishingAttempt,
  PublishingAttemptDocument,
} from '../posts/schemas/publishing-attempt.schema';
import { QueueService } from './queue.service';

const RECONCILIATION_INTERVAL_MS = 5 * 60 * 1000;

const RECONCILIATION_BATCH_SIZE = 1_000;

const PUBLISHING_STALE_GRACE_MS = 10 * 60 * 1000;

@Injectable()
export class ReconciliationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ReconciliationService.name);

  private reconciliationRunning = false;

  constructor(
    @InjectModel(PostTarget.name)
    private readonly postTargetModel: Model<PostTargetDocument>,

    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,

    @InjectModel(PublishingAttempt.name)
    private readonly publishingAttemptModel: Model<PublishingAttemptDocument>,

    private readonly queueService: QueueService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ensurePhase10Defaults();
      await this.reconcile('startup');
    } catch (err) {
      /**
       * Application startup must not silently fail because Redis or
       * Mongo reconciliation temporarily failed.
       *
       * The next scheduled reconciliation remains available.
       */
      this.logger.error(
        `Initial reconciliation failed: ` + `${this.getErrorMessage(err)}`,
        this.getErrorStack(err),
      );
    }
  }

  /**
   * Compatibility backfill for documents created before Phase 10.
   *
   * This is intentionally idempotent. In a mature deployment this should
   * eventually become a versioned migration, but keeping it bounded to
   * missing fields prevents repeated rewriting of already-normalized data.
   */
  private async ensurePhase10Defaults(): Promise<void> {
    await this.postTargetModel.updateMany(
      {
        retryCount: {
          $exists: false,
        },
      },
      {
        $set: {
          retryCount: 0,
        },
      },
    );

    await this.postTargetModel.updateMany(
      {
        nextRetryAt: {
          $exists: false,
        },
      },
      {
        $set: {
          nextRetryAt: null,
        },
      },
    );

    await this.postTargetModel.updateMany(
      {
        externalPostId: {
          $exists: false,
        },
      },
      {
        $set: {
          externalPostId: null,
        },
      },
    );

    await this.publishingAttemptModel.updateMany(
      {
        errorCode: {
          $exists: false,
        },
      },
      {
        $set: {
          errorCode: null,
        },
      },
    );
  }

  @Interval(RECONCILIATION_INTERVAL_MS)
  async reconcilePeriodically(): Promise<void> {
    await this.reconcile('interval');
  }

  private async reconcile(trigger: 'startup' | 'interval'): Promise<void> {
    if (this.reconciliationRunning) {
      this.logger.warn(
        `Reconciliation skipped ` +
          `trigger=${trigger} ` +
          `reason=previous-run-still-active`,
      );

      return;
    }

    this.reconciliationRunning = true;

    try {
      const targets = await this.postTargetModel
        .find({
          status: {
            $in: [
              PostTargetStatus.SCHEDULED,
              PostTargetStatus.RETRYING,
              PostTargetStatus.PUBLISHING,
            ],
          },
        })
        .select(
          '_id postId workspaceId platform status scheduledAt nextRetryAt updatedAt',
        )
        .sort({
          updatedAt: 1,
          _id: 1,
        })
        .limit(RECONCILIATION_BATCH_SIZE)
        .lean()
        .exec();

      if (targets.length === 0) {
        return;
      }

      const postIds = [
        ...new Set(targets.map((target) => target.postId.toString())),
      ];

      const posts = await this.postModel
        .find({
          _id: {
            $in: postIds,
          },
          status: {
            $ne: PostStatus.CANCELLED,
          },
        })
        .select('_id status')
        .lean()
        .exec();

      const validPostIds = new Set(posts.map((post) => post._id.toString()));

      const activeJobIds = await this.queueService.getActiveJobIds();

      let repaired = 0;

      for (const target of targets) {
        const targetId = target._id.toString();

        /**
         * Never resurrect execution for a cancelled/deleted parent.
         */
        if (!validPostIds.has(target.postId.toString())) {
          continue;
        }

        /**
         * A queue job already represents this target.
         */
        if (activeJobIds.has(targetId)) {
          continue;
        }

        const data = {
          postTargetId: targetId,
          workspaceId: target.workspaceId.toString(),
          postId: target.postId.toString(),
          platform: target.platform,
        };

        if (target.status === PostTargetStatus.SCHEDULED) {
          const repairedJob = await this.queueService.scheduleJob(
            data,
            target.scheduledAt,
          );

          if (repairedJob) {
            repaired += 1;

            this.logger.warn(
              `Repaired scheduled job ` +
                `jobId=${targetId} ` +
                `postTargetId=${targetId}`,
            );
          }

          continue;
        }

        if (target.status === PostTargetStatus.RETRYING) {
          const delayMs = target.nextRetryAt
            ? Math.max(0, target.nextRetryAt.getTime() - Date.now())
            : 0;

          const repairedJob = await this.queueService.retryJob(data, delayMs);

          if (repairedJob) {
            repaired += 1;

            this.logger.warn(
              `Repaired retry job ` +
                `jobId=${targetId} ` +
                `postTargetId=${targetId} ` +
                `delayMs=${delayMs}`,
            );
          }

          continue;
        }

        if (target.status === PostTargetStatus.PUBLISHING) {
          /**
           * PUBLISHING requires extra caution.
           *
           * First verify that an open attempt exists. A target without
           * an open attempt is already an inconsistent state and the
           * worker itself has the defensive repair path for it.
           */
          const openAttempt = await this.publishingAttemptModel
            .findOne({
              postTargetId: target._id,
              status: PublishingAttemptStatus.PUBLISHING,
            })
            .select('attemptNumber startedAt')
            .sort({
              attemptNumber: -1,
            })
            .lean()
            .exec();

          const ageMs = Date.now() - target.updatedAt.getTime();

          if (!openAttempt) {
            this.logger.error(
              `PUBLISHING target has no open attempt ` +
                `jobId=${targetId} ` +
                `postTargetId=${targetId} ` +
                `ageMs=${ageMs}`,
            );
          } else {
            const stale = ageMs >= PUBLISHING_STALE_GRACE_MS;

            const logMethod = stale ? 'error' : 'warn';

            this.logger[logMethod](
              `PUBLISHING target missing BullMQ job ` +
                `jobId=${targetId} ` +
                `postTargetId=${targetId} ` +
                `attemptNumber=${openAttempt.attemptNumber} ` +
                `ageMs=${ageMs}`,
            );
          }

          /**
           * We still reconstruct the deterministic job. The worker will
           * resume the existing open attempt rather than creating another
           * attempt.
           */
          const repairedJob = await this.queueService.retryJob(data, 0);

          if (repairedJob) {
            repaired += 1;
          }
        }
      }

      this.logger.log(
        `Reconciliation completed ` +
          `trigger=${trigger} ` +
          `scanned=${targets.length} ` +
          `repaired=${repaired}`,
      );
    } catch (err) {
      this.logger.error(
        `Reconciliation failed ` +
          `trigger=${trigger}: ` +
          `${this.getErrorMessage(err)}`,
        this.getErrorStack(err),
      );
    } finally {
      this.reconciliationRunning = false;
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private getErrorStack(error: unknown): string | undefined {
    return error instanceof Error ? error.stack : undefined;
  }
}
