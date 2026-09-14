import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';

import { Post, PostDocument } from './schemas/post.schema';
import { PostTarget, PostTargetDocument } from './schemas/post-target.schema';
import { PostStatus } from './enums/post-status.enum';
import { PostTargetStatus } from './enums/post-target-status.enum';

/**
 * Derives the parent post lifecycle from its independent publishing targets.
 * MongoDB remains the domain source of truth; this class contains the one
 * aggregation rule used by both automatic publishing and manual retry.
 */
@Injectable()
export class PostStatusAggregator {
  private readonly logger = new Logger(PostStatusAggregator.name);

  constructor(
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
    @InjectModel(PostTarget.name)
    private readonly postTargetModel: Model<PostTargetDocument>,
  ) {}

  async recomputePostStatus(
    postId: Types.ObjectId | string,
    session?: ClientSession,
  ): Promise<PostStatus | null> {
    const postObjectId =
      typeof postId === 'string' ? new Types.ObjectId(postId) : postId;

    const postQuery = this.postModel
      .findById(postObjectId)
      .select('_id status')
      .lean();

    if (session) postQuery.session(session);

    const post = await postQuery.exec();
    if (!post) return null;

    if (post.status === PostStatus.CANCELLED) {
      return PostStatus.CANCELLED;
    }

    const targetQuery = this.postTargetModel
      .find({
        postId: postObjectId,
        status: { $ne: PostTargetStatus.CANCELLED },
      })
      .select('status')
      .lean();

    if (session) targetQuery.session(session);

    const targets = await targetQuery.exec();
    if (targets.length === 0) return post.status;

    const statuses = targets.map((target) => target.status);
    const allScheduled = statuses.every(
      (status) => status === PostTargetStatus.SCHEDULED,
    );
    const hasInFlight = statuses.some(
      (status) =>
        status === PostTargetStatus.PUBLISHING ||
        status === PostTargetStatus.RETRYING,
    );
    const hasScheduled = statuses.some(
      (status) => status === PostTargetStatus.SCHEDULED,
    );
    const allPublished = statuses.every(
      (status) => status === PostTargetStatus.PUBLISHED,
    );
    const allFailed = statuses.every(
      (status) => status === PostTargetStatus.FAILED,
    );

    let nextStatus: PostStatus;

    if (allScheduled) {
      nextStatus = PostStatus.SCHEDULED;
    } else if (hasInFlight || hasScheduled) {
      nextStatus = PostStatus.PUBLISHING;
    } else if (allPublished) {
      nextStatus = PostStatus.PUBLISHED;
    } else if (allFailed) {
      nextStatus = PostStatus.FAILED;
    } else {
      nextStatus = PostStatus.PARTIALLY_PUBLISHED;
    }

    await this.postModel.updateOne(
      { _id: postObjectId, status: { $ne: PostStatus.CANCELLED } },
      { $set: { status: nextStatus } },
      { session },
    );

    this.logger.log(
      `Post status recomputed postId=${postObjectId.toString()} status=${nextStatus}`,
    );

    return nextStatus;
  }
}
