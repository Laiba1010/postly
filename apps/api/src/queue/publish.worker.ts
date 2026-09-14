import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { DelayedError, Job, Worker } from 'bullmq';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../redis/redis.module';
import { PUBLISH_QUEUE_NAME } from './queue.constants';
import { PublishJobData } from './queue.service';
import {
  computeNextRetryDelayMs,
  isRetryableFailure,
  MAX_PUBLISH_ATTEMPTS,
} from './retry-policy';
import { PublishFailureReason } from '../mock-platform/enums/publish-failure-reason.enum';
import { SocialProvider } from '../social-connections/enums/provider.enum';
import { MockPlatformService } from '../mock-platform/mock-platform.service';
import {
  isMockPublishFailure,
  MockPublishResult,
} from '../mock-platform/mock-platform.types';

import {
  PostTarget,
  PostTargetDocument,
} from '../posts/schemas/post-target.schema';
import { PostTargetStatus } from '../posts/enums/post-target-status.enum';
import {
  PublishingAttempt,
  PublishingAttemptDocument,
} from '../posts/schemas/publishing-attempt.schema';
import { PublishingAttemptStatus } from '../posts/enums/publishing-attempt-status.enum';
import { PostStatusAggregator } from '../posts/post-status-aggregator';

interface AttemptContext {
  workspaceId: string;
  postId: string;
  platform: SocialProvider;
  attemptNumber: number;
}

@Injectable()
export class PublishWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PublishWorker.name);
  private worker?: Worker<PublishJobData>;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(PostTarget.name)
    private readonly postTargetModel: Model<PostTargetDocument>,
    @InjectModel(PublishingAttempt.name)
    private readonly publishingAttemptModel: Model<PublishingAttemptDocument>,
    private readonly mockPlatformService: MockPlatformService,
    private readonly postStatusAggregator: PostStatusAggregator,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<PublishJobData>(
      PUBLISH_QUEUE_NAME,
      (job, token) => this.process(job, token),
      {
        connection: this.redisClient.duplicate({
          maxRetriesPerRequest: null,
        }),
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Job failed jobId=${job?.id} postTargetId=${job?.data.postTargetId}: ${err.message}`,
      );
    });

    this.worker.on('error', (err) => {
      this.logger.error(`BullMQ worker error: ${err.message}`, err.stack);
    });
  }

  private async process(
    job: Job<PublishJobData>,
    token?: string,
  ): Promise<void> {
    const { postTargetId } = job.data;
    const context = await this.startOrResumeAttempt(postTargetId, job.id);

    if (!context) {
      return;
    }

    const { workspaceId, postId, platform, attemptNumber } = context;

    this.logger.log(
      `Publishing started jobId=${job.id} workspaceId=${workspaceId} postId=${postId} postTargetId=${postTargetId} platform=${platform} attemptNumber=${attemptNumber}`,
    );

    let result: MockPublishResult;

    try {
      result = await this.mockPlatformService.publish({
        // The cache implementation scopes this key by attemptNumber. Keeping
        // the stable target identifier here makes the key deterministic while
        // allowing every legitimate attempt to receive a fresh outcome.
        idempotencyKey: postTargetId,
        attemptNumber,
        postTargetId,
        postId,
        workspaceId,
        platform,
      });
    } catch (err) {
      result = {
        outcome: 'FAILURE',
        reason: PublishFailureReason.NETWORK_ERROR,
        message: `Mock platform call failed unexpectedly: ${(err as Error).message}`,
      };

      this.logger.error(
        `Mock platform infrastructure failure jobId=${job.id} postTargetId=${postTargetId}: ${(err as Error).message}`,
      );
    }

    if (isMockPublishFailure(result)) {
      await this.handleFailure(job, context, result, token);
      return;
    }

    await this.markSuccess(postTargetId, postId, attemptNumber);

    this.logger.log(
      `Publishing succeeded jobId=${job.id} workspaceId=${workspaceId} postId=${postId} postTargetId=${postTargetId} platform=${platform} attemptNumber=${attemptNumber} status=SUCCESS`,
    );
  }

  /**
   * SCHEDULED and RETRYING are claimed atomically and open a new attempt.
   * PUBLISHING is different: it means an attempt was already opened and the
   * worker may be resuming after a stall/restart, so the existing open attempt
   * number is reused.
   */
  private async startOrResumeAttempt(
    postTargetId: string,
    jobId: string | undefined,
  ): Promise<AttemptContext | null> {
    const existing = await this.postTargetModel
      .findById(postTargetId)
      .select('_id postId workspaceId platform status')
      .lean()
      .exec();

    if (!existing) {
      this.logger.warn(
        `Skipping stale job jobId=${jobId} postTargetId=${postTargetId} reason=target-not-found`,
      );
      return null;
    }

    if (
      existing.status === PostTargetStatus.PUBLISHED ||
      existing.status === PostTargetStatus.FAILED ||
      existing.status === PostTargetStatus.CANCELLED
    ) {
      this.logger.log(
        `Skipping job jobId=${jobId} postTargetId=${postTargetId} reason=terminal-target status=${existing.status}`,
      );
      return null;
    }

    const baseContext = {
      workspaceId: existing.workspaceId.toString(),
      postId: existing.postId.toString(),
      platform: existing.platform,
    };

    if (existing.status === PostTargetStatus.PUBLISHING) {
      const openAttempt = await this.publishingAttemptModel
        .findOne({
          postTargetId: existing._id,
          status: PublishingAttemptStatus.PUBLISHING,
        })
        .sort({ attemptNumber: -1 })
        .select('attemptNumber')
        .lean()
        .exec();

      if (openAttempt) {
        return {
          ...baseContext,
          attemptNumber: openAttempt.attemptNumber,
        };
      }

      // A PUBLISHING target without an open attempt can only be a partially
      // persisted legacy/corrupt state. Recover it by opening the next attempt
      // transactionally before making another external call.
      return this.openNewAttempt(postTargetId, baseContext, [
        PostTargetStatus.PUBLISHING,
      ]);
    }

    return this.openNewAttempt(postTargetId, baseContext, [
      PostTargetStatus.SCHEDULED,
      PostTargetStatus.RETRYING,
    ]);
  }

  private async openNewAttempt(
    postTargetId: string,
    context: Omit<AttemptContext, 'attemptNumber'>,
    allowedStatuses: PostTargetStatus[],
  ): Promise<AttemptContext | null> {
    const session = await this.connection.startSession();
    let attemptNumber = 0;

    try {
      await session.withTransaction(async () => {
        const target = await this.postTargetModel
          .findOne({
            _id: postTargetId,
            status: { $in: allowedStatuses },
          })
          .session(session);

        if (!target) {
          return;
        }

        const lastAttempt = await this.publishingAttemptModel
          .findOne({ postTargetId: target._id })
          .sort({ attemptNumber: -1 })
          .select('attemptNumber')
          .session(session)
          .lean()
          .exec();

        attemptNumber = (lastAttempt?.attemptNumber ?? 0) + 1;

        target.status = PostTargetStatus.PUBLISHING;
        target.nextRetryAt = null;
        await target.save({ session });

        await this.publishingAttemptModel.create(
          [
            {
              postTargetId: target._id,
              attemptNumber,
              status: PublishingAttemptStatus.PUBLISHING,
              errorCode: null,
              errorMessage: null,
              startedAt: new Date(),
              completedAt: null,
            },
          ],
          { session },
        );

        await this.postStatusAggregator.recomputePostStatus(
          context.postId,
          session,
        );
      });
    } catch (err) {
      if ((err as any)?.code === 11000) {
        const openAttempt = await this.publishingAttemptModel
          .findOne({
            postTargetId,
            status: PublishingAttemptStatus.PUBLISHING,
          })
          .sort({ attemptNumber: -1 })
          .select('attemptNumber')
          .lean()
          .exec();

        if (openAttempt) {
          return { ...context, attemptNumber: openAttempt.attemptNumber };
        }
      }
      throw err;
    } finally {
      await session.endSession();
    }

    if (attemptNumber === 0) {
      return null;
    }

    return { ...context, attemptNumber };
  }

  private async handleFailure(
    job: Job<PublishJobData>,
    context: AttemptContext,
    failure: Extract<MockPublishResult, { outcome: 'FAILURE' }>,
    token?: string,
  ): Promise<void> {
    const errorMessage = failure.retryAfterMs
      ? `${failure.reason}: ${failure.message} (retryAfterMs=${failure.retryAfterMs})`
      : `${failure.reason}: ${failure.message}`;

    const retryable = isRetryableFailure(failure.reason);
    const shouldRetry =
      retryable && context.attemptNumber < MAX_PUBLISH_ATTEMPTS;

    this.logger.warn(
      `Publishing attempt failed jobId=${job.id} workspaceId=${context.workspaceId} postId=${context.postId} postTargetId=${job.data.postTargetId} platform=${context.platform} attemptNumber=${context.attemptNumber} errorCode=${failure.reason} retryable=${retryable} willRetry=${shouldRetry}`,
    );

    let nextRetryAt: Date | null = null;
    let duplicateResolution = false;

    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        const target = await this.postTargetModel
          .findOne({
            _id: job.data.postTargetId,
            postId: job.data.postId,
            status: PostTargetStatus.PUBLISHING,
          })
          .session(session);

        if (!target) {
          const current = await this.postTargetModel
            .findById(job.data.postTargetId)
            .select('status')
            .session(session)
            .lean()
            .exec();

          if (
            current?.status === PostTargetStatus.PUBLISHED ||
            current?.status === PostTargetStatus.FAILED ||
            current?.status === PostTargetStatus.CANCELLED
          ) {
            duplicateResolution = true;
            return;
          }

          throw new Error('TARGET_NOT_PUBLISHING');
        }

        const attemptResult = await this.publishingAttemptModel.updateOne(
          {
            postTargetId: target._id,
            attemptNumber: context.attemptNumber,
            status: PublishingAttemptStatus.PUBLISHING,
          },
          {
            $set: {
              status: PublishingAttemptStatus.FAILED,
              errorCode: failure.reason,
              errorMessage,
              completedAt: new Date(),
            },
          },
          { session },
        );

        if (attemptResult.modifiedCount !== 1) {
          throw new Error('ATTEMPT_NOT_PUBLISHING');
        }

        if (shouldRetry) {
          const retryCount = target.retryCount ?? 0;
          const delayMs = computeNextRetryDelayMs(retryCount);
          nextRetryAt = new Date(Date.now() + delayMs);

          target.status = PostTargetStatus.RETRYING;
          target.retryCount = retryCount + 1;
          target.nextRetryAt = nextRetryAt;
          await target.save({ session });
        } else {
          target.status = PostTargetStatus.FAILED;
          target.nextRetryAt = null;
          await target.save({ session });
        }

        await this.postStatusAggregator.recomputePostStatus(
          context.postId,
          session,
        );
      });
    } finally {
      await session.endSession();
    }

    if (duplicateResolution) {
      this.logger.log(
        `Ignoring duplicate failure delivery jobId=${job.id} postTargetId=${job.data.postTargetId} currentStateAlreadyResolved=true`,
      );
      return;
    }

    if (!shouldRetry) {
      this.logger.warn(
        `Publishing terminal failure jobId=${job.id} workspaceId=${context.workspaceId} postId=${context.postId} postTargetId=${job.data.postTargetId} platform=${context.platform} attemptNumber=${context.attemptNumber} errorCode=${failure.reason}`,
      );

      // Keep the BullMQ job in its terminal `failed` state. Manual retry can
      // then re-arm this deterministic job with job.retry('failed'). The
      // domain state is already durably FAILED in MongoDB.
      throw new Error(`PUBLISH_TARGET_FAILED:${failure.reason}`);
    }

    if (!nextRetryAt) {
      throw new Error('RETRY_TIME_NOT_COMPUTED');
    }

    try {
      // Mongo is the durable source of truth. The target is already RETRYING;
      // moving the same BullMQ job to delayed is a derived queue operation.
      // If Redis fails, the job may fail, but reconciliation will see the
      // durable RETRYING target and reconstruct the missing job.
      await job.moveToDelayed(nextRetryAt.getTime(), token);
      throw new DelayedError();
    } catch (err) {
      if (
        err instanceof DelayedError ||
        (err as Error).name === 'DelayedError'
      ) {
        throw err;
      }

      this.logger.error(
        `Failed to move retry job to delayed state jobId=${job.id} postTargetId=${job.data.postTargetId}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  private async markSuccess(
    postTargetId: string,
    postId: string,
    attemptNumber: number,
  ): Promise<void> {
    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        const targetResult = await this.postTargetModel.updateOne(
          {
            _id: postTargetId,
            status: PostTargetStatus.PUBLISHING,
          },
          {
            $set: {
              status: PostTargetStatus.PUBLISHED,
              nextRetryAt: null,
              externalPostId: `mock:${postTargetId}:${attemptNumber}`,
            },
          },
          { session },
        );

        if (targetResult.modifiedCount !== 1) {
          // Another delivery may already have completed this attempt. Treat
          // the duplicate completion as idempotent instead of corrupting it.
          const current = await this.postTargetModel
            .findById(postTargetId)
            .select('status')
            .session(session)
            .lean()
            .exec();

          if (current?.status === PostTargetStatus.PUBLISHED) {
            return;
          }

          throw new Error('TARGET_NOT_PUBLISHING');
        }

        const attemptResult = await this.publishingAttemptModel.updateOne(
          {
            postTargetId,
            attemptNumber,
            status: PublishingAttemptStatus.PUBLISHING,
          },
          {
            $set: {
              status: PublishingAttemptStatus.SUCCESS,
              completedAt: new Date(),
            },
          },
          { session },
        );

        if (attemptResult.modifiedCount !== 1) {
          throw new Error('ATTEMPT_NOT_PUBLISHING');
        }

        await this.postStatusAggregator.recomputePostStatus(postId, session);
      });
    } finally {
      await session.endSession();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
