import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Post, PostDocument } from '../posts/schemas/post.schema';
import {
  PostTarget,
  PostTargetDocument,
} from '../posts/schemas/post-target.schema';
import { PostStatus } from '../posts/enums/post-status.enum';
import { PostTargetStatus } from '../posts/enums/post-target-status.enum';

import { QueueService } from './queue.service';

/**
 * On worker startup, repairs drift between MongoDB (source of truth for
 * "this target should be scheduled") and Redis (source of truth for
 * "a job will actually fire for it").
 *
 * A target is eligible for reconciliation only when:
 *
 *   1. PostTarget.status === SCHEDULED
 *   2. Parent Post.status === SCHEDULED
 *
 * This prevents stale targets from resurrecting jobs after the parent Post
 * has moved to another lifecycle state.
 *
 * This is intentionally a single startup sweep, not a generalized
 * continuously-running reconciliation engine.
 */
@Injectable()
export class ReconciliationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    @InjectModel(PostTarget.name)
    private readonly postTargetModel: Model<PostTargetDocument>,

    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,

    private readonly queueService: QueueService,
  ) {}

  async onApplicationBootstrap() {
    const scheduledTargets = await this.postTargetModel
      .find({
        status: PostTargetStatus.SCHEDULED,
      })
      .select('_id postId workspaceId platform scheduledAt')
      .lean()
      .exec();

    if (scheduledTargets.length === 0) {
      return;
    }

    /**
     * Only targets whose parent Post is still SCHEDULED are eligible
     * for re-enqueueing.
     *
     * Query the parent Posts in one operation rather than performing
     * one database lookup per target.
     */
    const postIds = [
      ...new Set(scheduledTargets.map((target) => target.postId.toString())),
    ];

    const scheduledPosts = await this.postModel
      .find({
        _id: { $in: postIds },
        status: PostStatus.SCHEDULED,
      })
      .select('_id')
      .lean()
      .exec();

    const scheduledPostIds = new Set(
      scheduledPosts.map((post) => post._id.toString()),
    );

    const compatibleTargets = scheduledTargets.filter((target) =>
      scheduledPostIds.has(target.postId.toString()),
    );

    if (compatibleTargets.length === 0) {
      this.logger.log(
        `Reconciliation: ${scheduledTargets.length} scheduled target(s), but none have a currently scheduled parent Post`,
      );
      return;
    }

    const activeJobIds = await this.queueService.getActiveJobIds();

    const missing = compatibleTargets.filter(
      (target) => !activeJobIds.has(target._id.toString()),
    );

    if (missing.length === 0) {
      this.logger.log(
        `Reconciliation: ${compatibleTargets.length} compatible scheduled target(s), no drift found`,
      );
      return;
    }

    this.logger.warn(
      `Reconciliation: found ${missing.length} scheduled target(s) with no active job — re-enqueuing`,
    );

    for (const target of missing) {
      await this.queueService.scheduleJob(
        {
          postTargetId: target._id.toString(),
          workspaceId: target.workspaceId.toString(),
          postId: target.postId.toString(),
          platform: target.platform,
        },
        target.scheduledAt,
      );
    }
  }
}
