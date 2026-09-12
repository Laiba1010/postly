import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
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

  constructor(
    @Inject(REDIS_CLIENT) redisClient: Redis,
    private readonly configService: ConfigService,
  ) {
    // BullMQ needs its own connection with maxRetriesPerRequest: null.
    // We duplicate the existing shared client's connection options rather
    // than opening a second, differently-configured Redis client type.
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
        `Failed to enqueue job for postTarget ${data.postTargetId}: ${
          (err as Error).message
        }`,
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
          `Cannot reschedule ${data.postTargetId}; job state=${state}`,
        );

        return false;
      }

      await job.changeDelay(this.computeDelayMs(newScheduledAt));

      return true;
    } catch (err) {
      this.logger.error(
        `Failed to reschedule ${data.postTargetId}: ${(err as Error).message}`,
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

      // If already active/completed, there is nothing to remove — the
      // worker's own state-check on pickup handles a target that was
      // cancelled after its job began processing.
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to remove job for postTarget ${postTargetId}: ${
          (err as Error).message
        }`,
      );

      return false;
    }
  }

  /**
   * Returns the set of postTargetIds that currently have an active
   * (delayed or waiting) job in the queue.
   *
   * Jobs are read in bounded pages so reconciliation does not load the
   * entire queue into application memory in one getJobs() call.
   */
  async getActiveJobIds(): Promise<Set<string>> {
    const activeJobIds = new Set<string>();

    const pageSize = 1000;
    let start = 0;

    while (true) {
      const jobs = await this.queue.getJobs(
        ['delayed', 'waiting'],
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
