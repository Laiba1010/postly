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
        `Failed to enqueue job jobId=${data.postTargetId}: ${err instanceof Error ? err.message : String(err)}`,
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

      if (!job) return this.scheduleJob(data, newScheduledAt);

      const state = await job.getState();

      // A reschedule replaces the derived queue representation. Waiting and
      // delayed jobs are safe to remove here; the worker also re-checks the
      // durable MongoDB scheduledAt before opening a publishing attempt, so a
      // stale job cannot publish after a concurrent reschedule.
      if (
        state === 'delayed' ||
        state === 'waiting' ||
        state === 'prioritized' ||
        state === 'failed' ||
        state === 'completed' ||
        state === 'waiting-children'
      ) {
        await job.remove();
        return this.scheduleJob(data, newScheduledAt);
      }

      if (state === 'active') {
        this.logger.warn(
          `Cannot replace active job during reschedule jobId=${data.postTargetId}; worker will re-check durable scheduledAt`,
        );
        return false;
      }

      this.logger.warn(
        `Cannot reschedule jobId=${data.postTargetId}; job state=${state}`,
      );
      return false;
    } catch (err) {
      this.logger.error(
        `Failed to reschedule jobId=${data.postTargetId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  async removeJob(postTargetId: string): Promise<boolean> {
    try {
      const existing = await this.queue.getJob(postTargetId);
      if (!existing) return true;

      const state = await existing.getState();
      if (
        state === 'delayed' ||
        state === 'waiting' ||
        state === 'failed' ||
        state === 'completed' ||
        state === 'prioritized'
      ) {
        await existing.remove();
      }
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to remove job jobId=${postTargetId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  /**
   * Removes all non-active publishing jobs belonging to a workspace. Active
   * jobs are deliberately left alone: once the target is deleted from Mongo,
   * the worker's durable lookup will safely treat them as stale and exit.
   */
  async removeWorkspaceJobs(workspaceId: string): Promise<boolean> {
    let success = true;
    const states: Array<
      | 'completed'
      | 'delayed'
      | 'failed'
      | 'prioritized'
      | 'waiting'
      | 'waiting-children'
    > = [
      'completed',
      'delayed',
      'failed',
      'prioritized',
      'waiting',
      'waiting-children',
    ];

    try {
      for (const state of states) {
        // Collect matching jobs before removing anything so pagination cannot
        // skip entries as the underlying list shrinks.
        const jobs = await this.queue.getJobs([state], 0, -1);
        const workspaceJobs = jobs.filter(
          (job) => job.data.workspaceId === workspaceId,
        );

        for (const job of workspaceJobs) {
          try {
            await job.remove();
          } catch (err) {
            success = false;
            this.logger.error(
              `Failed to remove workspace job jobId=${job.id} workspaceId=${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }
    } catch (err) {
      success = false;
      this.logger.error(
        `Failed to scan workspace queue jobs workspaceId=${workspaceId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return success;
  }

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
        `Failed to re-arm job jobId=${data.postTargetId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

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
        if (job.id) activeJobIds.add(job.id);
      }

      if (jobs.length < pageSize) break;
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
