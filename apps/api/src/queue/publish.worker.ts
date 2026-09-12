import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis/redis.module';
import { PUBLISH_QUEUE_NAME } from './queue.constants';
import { PublishJobData } from './queue.service';
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

@Injectable()
export class PublishWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PublishWorker.name);
  private worker: Worker<PublishJobData>;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(PostTarget.name)
    private readonly postTargetModel: Model<PostTargetDocument>,
    @InjectModel(PublishingAttempt.name)
    private readonly publishingAttemptModel: Model<PublishingAttemptDocument>,
  ) {}

  onModuleInit() {
    this.worker = new Worker<PublishJobData>(
      PUBLISH_QUEUE_NAME,
      (job) => this.process(job),
      {
        connection: this.redisClient.duplicate({ maxRetriesPerRequest: null }),
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Job failed jobId=${job?.id} postTargetId=${job?.data.postTargetId}: ${err.message}`,
      );
    });
  }

  private async process(job: Job<PublishJobData>): Promise<void> {
    // Queue metadata is used only as the lookup key.
    const { postTargetId } = job.data;

    const target = await this.postTargetModel
      .findById(postTargetId)
      .select('_id postId workspaceId platform status scheduledAt');

    if (!target || target.status !== PostTargetStatus.SCHEDULED) {
      // Target was cancelled, or this is a stale re-processed job.
      // Correct, expected no-op — not an error.
      this.logger.log(
        `Skipping job jobId=${job.id} postTargetId=${postTargetId} reason=target-not-scheduled`,
      );
      return;
    }

    // MongoDB is the source of truth for the target's identity and context.
    const actualWorkspaceId = target.workspaceId.toString();
    const actualPostId = target.postId.toString();
    const actualPlatform = target.platform;

    const session = await this.connection.startSession();
    let attemptNumber = 1;

    try {
      await session.withTransaction(async () => {
        // Re-verify inside the transaction to close the race between the
        // pre-check above and this write.
        const freshTarget = await this.postTargetModel
          .findOne({
            _id: postTargetId,
            status: PostTargetStatus.SCHEDULED,
          })
          .select('_id postId workspaceId platform status scheduledAt')
          .session(session);

        if (!freshTarget) {
          throw new Error('TARGET_NO_LONGER_SCHEDULED');
        }

        const lastAttempt = await this.publishingAttemptModel
          .findOne({ postTargetId: freshTarget._id })
          .sort({ attemptNumber: -1 })
          .select({ attemptNumber: 1 })
          .session(session)
          .lean();

        attemptNumber = (lastAttempt?.attemptNumber ?? 0) + 1;

        freshTarget.status = PostTargetStatus.PUBLISHING;

        await freshTarget.save({ session });

        await this.publishingAttemptModel.create(
          [
            {
              postTargetId: freshTarget._id,
              attemptNumber,
              status: PublishingAttemptStatus.PUBLISHING,
              startedAt: new Date(),
            },
          ],
          { session },
        );
      });
    } catch (err) {
      if ((err as Error).message === 'TARGET_NO_LONGER_SCHEDULED') {
        this.logger.log(
          `Skipping job jobId=${job.id} postTargetId=${postTargetId} reason=race-target-changed`,
        );
        return;
      }

      throw err;
    } finally {
      await session.endSession();
    }

    this.logger.log(
      `Publishing started jobId=${job.id} workspaceId=${actualWorkspaceId} postId=${actualPostId} postTargetId=${postTargetId} platform=${actualPlatform} attemptNumber=${attemptNumber}`,
    );

    // Phase 8 stub: proves the pipeline end-to-end without a real
    // external call. Phase 9 replaces this block with the actual mock
    // social platform integration; Phase 10 adds retry/failure handling
    // around it. Deliberately not building either here.
    await this.markSuccess(postTargetId, attemptNumber);

    this.logger.log(
      `Publishing succeeded jobId=${job.id} workspaceId=${actualWorkspaceId} postId=${actualPostId} postTargetId=${postTargetId} platform=${actualPlatform} attemptNumber=${attemptNumber} status=SUCCESS`,
    );
  }

  private async markSuccess(
    postTargetId: string,
    attemptNumber: number,
  ): Promise<void> {
    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        const result = await this.postTargetModel.updateOne(
          {
            _id: postTargetId,
            status: PostTargetStatus.PUBLISHING,
          },
          {
            $set: {
              status: PostTargetStatus.PUBLISHED,
            },
          },
          { session },
        );

        if (result.modifiedCount !== 1) {
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
      });
    } finally {
      await session.endSession();
    }
  }

  async onModuleDestroy() {
    // Lets any in-flight job finish before the process exits, rather
    // than killing it mid-transaction.
    await this.worker.close();
  }
}
