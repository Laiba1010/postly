import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { PUBLISH_QUEUE_NAME, JOB_OPTIONS } from './queue.constants';

export interface PublishJobData {
  postTargetId: string;
  workspaceId: string;
  postId: string;
  platform: string;
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queue: Queue<PublishJobData>;

  constructor(@Inject(REDIS_CLIENT) redisClient: Redis) {
    this.queue = new Queue<PublishJobData>(PUBLISH_QUEUE_NAME, {
      connection: redisClient.duplicate({ maxRetriesPerRequest: null }),
    });
  }

  private computeDelayMs(scheduledAt: Date): number {
    return Math.max(0, scheduledAt.getTime() - Date.now());
  }

  async scheduleJob(data: PublishJobData, scheduledAt: Date): Promise<boolean> {
    try {
      await this.queue.add(data.postTargetId, data, {
        jobId: data.postTargetId,
        delay: this.computeDelayMs(scheduledAt),
        ...JOB_OPTIONS,
      });

      return true;
    } catch (err) {
      this.logger.error(
        `Failed to enqueue job jobId=${data.postTargetId}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  async rescheduleJob(
    data: PublishJobData,
    newScheduledAt: Date,
  ): Promise<boolean> {
    try {
      const job = await this.queue.getJob(data.postTargetId);

      if (!job) {
        return this.scheduleJob(data, newScheduledAt);
      }

      const state = await job.getState();

      if (state !== 'delayed') {
        this.logger.warn(
          `Cannot reschedule jobId=${data.postTargetId}; job state=${state}`,
        );
        return false;
      }

      await job.changeDelay(this.computeDelayMs(newScheduledAt));
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to reschedule jobId=${data.postTargetId}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  async removeJob(postTargetId: string): Promise<boolean> {
    try {
      const existing = await this.queue.getJob(postTargetId);

      if (!existing) {
        return true;
      }

      const state = await existing.getState();

      if (state === 'delayed' || state === 'waiting') {
        await existing.remove();
      }

      return true;
    } catch (err) {
      this.logger.error(
        `Failed to remove job jobId=${postTargetId}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Re-arms a deterministic job for a target that is already durably marked
   * RETRYING. For manual retry, a retained failed BullMQ job can be retried
   * directly. For reconciliation, a retained terminal job is removed and
   * recreated with the requested delay.
   */
  async retryJob(data: PublishJobData, delayMs = 0): Promise<boolean> {
    try {
      const job = await this.queue.getJob(data.postTargetId);

      if (!job) {
        return this.scheduleJob(data, new Date(Date.now() + delayMs));
      }

      const state = await job.getState();

      if (state === 'failed') {
        if (delayMs === 0) {
          await job.retry('failed');
          return true;
        }

        await job.remove();
        return this.scheduleJob(data, new Date(Date.now() + delayMs));
      }

      if (state === 'completed') {
        await job.remove();
        return this.scheduleJob(data, new Date(Date.now() + delayMs));
      }

      if (
        state === 'waiting' ||
        state === 'delayed' ||
        state === 'active' ||
        state === 'prioritized'
      ) {
        this.logger.warn(
          `Retry job already exists jobId=${data.postTargetId} state=${state}`,
        );
        return false;
      }

      this.logger.warn(
        `Retry job has unsupported state jobId=${data.postTargetId} state=${state}; leaving it untouched`,
      );
      return false;
    } catch (err) {
      this.logger.error(
        `Failed to re-arm job jobId=${data.postTargetId}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Includes active jobs as well as waiting/delayed jobs. An active
   * PUBLISHING target already has an execution owner and must not be
   * duplicated by reconciliation.
   */
  async getActiveJobIds(): Promise<Set<string>> {
    const activeJobIds = new Set<string>();
    const pageSize = 1_000;
    let start = 0;

    while (true) {
      const jobs: Job<PublishJobData>[] = await this.queue.getJobs(
        ['active', 'delayed', 'waiting', 'prioritized'],
        start,
        start + pageSize - 1,
      );

      for (const job of jobs) {
        if (job.id) {
          activeJobIds.add(job.id);
        }
      }

      if (jobs.length < pageSize) {
        break;
      }

      start += pageSize;
    }

    return activeJobIds;
  }

  getQueue(): Queue<PublishJobData> {
    return this.queue;
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
