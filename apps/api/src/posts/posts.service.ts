import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Post, PostDocument } from './schemas/post.schema';
import { PostTarget, PostTargetDocument } from './schemas/post-target.schema';
import { PostStatus } from './enums/post-status.enum';
import { PostTargetStatus } from './enums/post-target-status.enum';
import { SaveDraftDto } from './dto/save-draft.dto';
import { SchedulePostDto } from './dto/schedule-post.dto';
import { ReschedulePostDto } from './dto/reschedule-post.dto';
import { validateAgainstPlatformRules } from './constants/platform-rules';
import {
  calculateScheduledUtc,
  assertScheduledInFuture,
} from './utils/timezone.util';
import {
  SocialConnection,
  SocialConnectionDocument,
} from '../social-connections/schemas/social-connection.schema';
import { Media, MediaDocument } from '../media/schemas/media.schema';
import { MEDIA_LIMITS } from '../media/constants/media-limits';

export interface PostTargetSummary {
  id: string;
  platform: string;
  socialConnectionId: string;
  status: PostTargetStatus;
  scheduledAt: Date;
}

export interface PostSummary {
  id: string;
  content: string;
  status: PostStatus;
  destinations: {
    provider: string;
    socialConnectionId: string;
    accountName: string;
  }[];
  mediaIds: string[];
  scheduledAt: Date | null;
  timezone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PostsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(PostTarget.name)
    private readonly postTargetModel: Model<PostTargetDocument>,
    @InjectModel(SocialConnection.name)
    private readonly socialConnectionModel: Model<SocialConnectionDocument>,
    @InjectModel(Media.name) private readonly mediaModel: Model<MediaDocument>,
  ) {}

  private toObjectId(value: string, fieldName: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: `${fieldName} is invalid`,
      });
    }

    return new Types.ObjectId(value);
  }

  private async resolveAndValidateDestinations(
    workspaceId: string,
    destinationInputs: { provider: string; socialConnectionId: string }[],
  ) {
    if (!destinationInputs || destinationInputs.length === 0) return [];

    const invalidId = destinationInputs.some(
      (d) => !Types.ObjectId.isValid(d.socialConnectionId),
    );
    if (invalidId) {
      throw new BadRequestException({
        code: 'INVALID_DESTINATION',
        message: 'One or more social connection IDs are malformed',
      });
    }

    const connectionIds = destinationInputs.map(
      (d) => new Types.ObjectId(d.socialConnectionId),
    );
    const connections = await this.socialConnectionModel.find({
      _id: { $in: connectionIds },
      workspaceId: new Types.ObjectId(workspaceId),
    });

    if (connections.length !== destinationInputs.length) {
      throw new BadRequestException({
        code: 'INVALID_DESTINATION',
        message:
          'One or more selected social accounts are invalid for this workspace',
      });
    }

    return connections.map((c) => ({
      provider: c.provider,
      socialConnectionId: c._id,
      accountName: c.accountName,
    }));
  }

  private async resolveAndValidateMedia(
    workspaceId: string,
    mediaIds: string[],
    currentPostId: string | null,
  ) {
    if (!mediaIds || mediaIds.length === 0) return [];

    if (mediaIds.length > MEDIA_LIMITS.MAX_MEDIA_PER_POST) {
      throw new BadRequestException({
        code: 'TOO_MANY_MEDIA_ITEMS',
        message: `A post can have at most ${MEDIA_LIMITS.MAX_MEDIA_PER_POST} media items`,
      });
    }

    const invalidId = mediaIds.some((id) => !Types.ObjectId.isValid(id));
    if (invalidId) {
      throw new BadRequestException({
        code: 'INVALID_MEDIA',
        message: 'One or more media IDs are malformed',
      });
    }

    const objectIds = mediaIds.map((id) => new Types.ObjectId(id));
    const media = await this.mediaModel.find({
      _id: { $in: objectIds },
      workspaceId: new Types.ObjectId(workspaceId),
    });

    if (media.length !== mediaIds.length) {
      throw new BadRequestException({
        code: 'INVALID_MEDIA',
        message:
          'One or more selected media items are invalid for this workspace',
      });
    }

    const conflicting = media.find(
      (m) =>
        m.postId && (!currentPostId || m.postId.toString() !== currentPostId),
    );
    if (conflicting) {
      throw new BadRequestException({
        code: 'MEDIA_ALREADY_ATTACHED',
        message:
          'One or more selected media items are already attached to another post',
      });
    }

    return objectIds;
  }

  async createDraft(
    workspaceId: string,
    authorId: string,
    dto: SaveDraftDto,
  ): Promise<PostSummary> {
    const destinations = await this.resolveAndValidateDestinations(
      workspaceId,
      dto.destinations ?? [],
    );
    const mediaIds = await this.resolveAndValidateMedia(
      workspaceId,
      dto.mediaIds ?? [],
      null,
    );

    const platformErrors = validateAgainstPlatformRules(
      dto.content ?? '',
      destinations,
      mediaIds.length,
    );
    if (platformErrors.length > 0) {
      throw new BadRequestException({
        code: 'PLATFORM_VALIDATION_FAILED',
        message:
          'Content does not meet the requirements for one or more selected platforms',
        errors: platformErrors,
      });
    }

    const post = await this.postModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      authorId: new Types.ObjectId(authorId),
      content: dto.content ?? '',
      status: PostStatus.DRAFT,
      destinations,
      mediaIds,
    });

    if (mediaIds.length > 0) {
      await this.mediaModel.updateMany(
        { _id: { $in: mediaIds } },
        { postId: post._id },
      );
    }

    return this.toSummary(post);
  }

  async getDraft(workspaceId: string, postId: string): Promise<PostSummary> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }

    const post = await this.postModel.findOne({
      _id: new Types.ObjectId(postId),
      workspaceId: new Types.ObjectId(workspaceId),
    });

    if (!post) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }

    return this.toSummary(post);
  }

  async listDrafts(workspaceId: string): Promise<PostSummary[]> {
    const posts = await this.postModel
      .find({ workspaceId: new Types.ObjectId(workspaceId) })
      .sort({ updatedAt: -1 })
      .exec();

    return posts.map((p) => this.toSummary(p));
  }

  async duplicateDraft(
    workspaceId: string,
    authorId: string,
    postId: string,
  ): Promise<PostSummary> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }

    const sourcePost = await this.postModel.findOne({
      _id: new Types.ObjectId(postId),
      workspaceId: new Types.ObjectId(workspaceId),
    });

    if (!sourcePost) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }

    const newPost = await this.postModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      authorId: new Types.ObjectId(authorId),
      content: sourcePost.content ? `${sourcePost.content} (Copy)` : '',
      status: PostStatus.DRAFT,
      destinations: sourcePost.destinations,
      mediaIds: [],
    });

    return this.toSummary(newPost);
  }

  async deleteDraft(workspaceId: string, postId: string): Promise<void> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }

    const post = await this.postModel.findOne({
      _id: new Types.ObjectId(postId),
      workspaceId: new Types.ObjectId(workspaceId),
    });

    if (!post) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }

    if (post.mediaIds.length > 0) {
      await this.mediaModel.updateMany(
        { _id: { $in: post.mediaIds } },
        { postId: null },
      );
    }

    await post.deleteOne();
  }

  async updateDraft(
    workspaceId: string,
    postId: string,
    dto: SaveDraftDto,
  ): Promise<PostSummary> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }

    const post = await this.postModel.findOne({
      _id: new Types.ObjectId(postId),
      workspaceId: new Types.ObjectId(workspaceId),
    });

    if (!post) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }

    if (post.status !== PostStatus.DRAFT) {
      throw new ForbiddenException({
        code: 'POST_NOT_EDITABLE',
        message: 'Only draft posts can be edited',
      });
    }

    const previousMediaIds = (post.mediaIds || []).map((id) => id.toString());

    const destinations =
      dto.destinations !== undefined
        ? await this.resolveAndValidateDestinations(
            workspaceId,
            dto.destinations,
          )
        : post.destinations;

    const mediaIds =
      dto.mediaIds !== undefined
        ? await this.resolveAndValidateMedia(workspaceId, dto.mediaIds, postId)
        : post.mediaIds;

    const content = dto.content !== undefined ? dto.content : post.content;

    const platformErrors = validateAgainstPlatformRules(
      content,
      destinations,
      mediaIds.length,
    );
    if (platformErrors.length > 0) {
      throw new BadRequestException({
        code: 'PLATFORM_VALIDATION_FAILED',
        message:
          'Content does not meet the requirements for one or more selected platforms',
        errors: platformErrors,
      });
    }

    post.content = content;
    post.destinations = destinations as any;
    post.mediaIds = mediaIds as any;
    await post.save();

    const newMediaIds = (mediaIds || []).map((id) => id.toString());
    const added = newMediaIds.filter((id) => !previousMediaIds.includes(id));
    const removed = previousMediaIds.filter((id) => !newMediaIds.includes(id));

    if (added.length > 0) {
      await this.mediaModel.updateMany(
        { _id: { $in: added.map((id) => new Types.ObjectId(id)) } },
        { postId: post._id },
      );
    }
    if (removed.length > 0) {
      await this.mediaModel.updateMany(
        { _id: { $in: removed.map((id) => new Types.ObjectId(id)) } },
        { postId: null },
      );
    }

    return this.toSummary(post);
  }

  async scheduleDraft(
    workspaceId: string,
    postId: string,
    dto: SchedulePostDto,
  ): Promise<PostSummary> {
    const workspaceObjectId = this.toObjectId(workspaceId, 'workspaceId');
    const postObjectId = this.toObjectId(postId, 'postId');

    const scheduledUtc = calculateScheduledUtc(
      dto.date,
      dto.time,
      dto.timezone,
    );

    assertScheduledInFuture(scheduledUtc);

    const existingPost = await this.postModel.findOne({
      _id: postObjectId,
      workspaceId: workspaceObjectId,
    });

    if (!existingPost) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }

    if (existingPost.destinations.length === 0) {
      throw new BadRequestException({
        code: 'CANNOT_SCHEDULE_EMPTY_POST',
        message: 'Select at least one platform before scheduling',
      });
    }

    const platformErrors = validateAgainstPlatformRules(
      existingPost.content,
      existingPost.destinations,
      existingPost.mediaIds.length,
    );

    if (platformErrors.length > 0) {
      throw new BadRequestException({
        code: 'PLATFORM_VALIDATION_FAILED',
        message:
          'Content does not meet the requirements for one or more selected platforms',
        errors: platformErrors,
      });
    }

    const session = await this.connection.startSession();

    try {
      let scheduledPost: PostDocument | null = null;

      await session.withTransaction(async () => {
        /**
         * Atomic lifecycle transition:
         *
         * DRAFT -> SCHEDULED
         *
         * Only one concurrent request can successfully perform this transition.
         */
        scheduledPost = await this.postModel.findOneAndUpdate(
          {
            _id: postObjectId,
            workspaceId: workspaceObjectId,
            status: PostStatus.DRAFT,
          },
          {
            $set: {
              status: PostStatus.SCHEDULED,
              scheduledAt: scheduledUtc,
              timezone: dto.timezone,
            },
          },
          {
            new: true,
            session,
          },
        );

        if (!scheduledPost) {
          throw new BadRequestException({
            code: 'INVALID_STATE_TRANSITION',
            message: 'Only draft posts can be scheduled',
          });
        }

        const targetDocs = scheduledPost.destinations.map((destination) => ({
          postId: scheduledPost!._id,
          workspaceId: scheduledPost!.workspaceId,
          platform: destination.provider,
          socialConnectionId: destination.socialConnectionId,
          status: PostTargetStatus.SCHEDULED,
          scheduledAt: scheduledUtc,
        }));

        await this.postTargetModel.insertMany(targetDocs, {
          session,
        });
      });

      return this.toSummary(scheduledPost!);
    } finally {
      await session.endSession();
    }
  }

  async reschedulePost(
    workspaceId: string,
    postId: string,
    dto: ReschedulePostDto,
  ): Promise<PostSummary> {
    const workspaceObjectId = this.toObjectId(workspaceId, 'workspaceId');
    const postObjectId = this.toObjectId(postId, 'postId');

    const scheduledUtc = calculateScheduledUtc(
      dto.date,
      dto.time,
      dto.timezone,
    );

    assertScheduledInFuture(scheduledUtc);

    const post = await this.postModel.findOne({
      _id: postObjectId,
      workspaceId: workspaceObjectId,
    });

    if (!post) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }

    if (post.status !== PostStatus.SCHEDULED) {
      throw new BadRequestException({
        code: 'INVALID_STATE_TRANSITION',
        message: 'Only scheduled posts can be rescheduled',
      });
    }

    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        post.scheduledAt = scheduledUtc;
        post.timezone = dto.timezone;

        await post.save({ session });

        await this.postTargetModel.updateMany(
          {
            postId: post._id,
            workspaceId: workspaceObjectId,
            status: PostTargetStatus.SCHEDULED,
          },
          {
            $set: {
              scheduledAt: scheduledUtc,
            },
          },
          {
            session,
          },
        );
      });

      return this.toSummary(post);
    } finally {
      await session.endSession();
    }
  }

  async cancelSchedule(
    workspaceId: string,
    postId: string,
  ): Promise<PostSummary> {
    const workspaceObjectId = this.toObjectId(workspaceId, 'workspaceId');
    const postObjectId = this.toObjectId(postId, 'postId');

    const post = await this.postModel.findOne({
      _id: postObjectId,
      workspaceId: workspaceObjectId,
    });

    if (!post) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }

    if (post.status !== PostStatus.SCHEDULED) {
      throw new BadRequestException({
        code: 'INVALID_STATE_TRANSITION',
        message: 'Only scheduled posts can be cancelled',
      });
    }

    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        await this.postTargetModel.updateMany(
          {
            postId: post._id,
            workspaceId: workspaceObjectId,
            status: PostTargetStatus.SCHEDULED,
          },
          {
            $set: {
              status: PostTargetStatus.CANCELLED,
            },
          },
          {
            session,
          },
        );

        post.status = PostStatus.CANCELLED;

        await post.save({ session });
      });

      return this.toSummary(post);
    } finally {
      await session.endSession();
    }
  }

  async listTargetsForPost(
    workspaceId: string,
    postId: string,
  ): Promise<PostTargetSummary[]> {
    const workspaceObjectId = this.toObjectId(workspaceId, 'workspaceId');
    const postObjectId = this.toObjectId(postId, 'postId');

    const targets = await this.postTargetModel.find({
      postId: postObjectId,
      workspaceId: workspaceObjectId,
    });

    return targets.map((target) => ({
      id: target._id.toString(),
      platform: target.platform,
      socialConnectionId: target.socialConnectionId.toString(),
      status: target.status,
      scheduledAt: target.scheduledAt,
    }));
  }

  private toSummary(p: PostDocument): PostSummary {
    return {
      id: p._id.toString(),
      content: p.content,
      status: p.status,
      destinations: p.destinations.map((d) => ({
        provider: d.provider,
        socialConnectionId: d.socialConnectionId.toString(),
        accountName: d.accountName,
      })),
      mediaIds: p.mediaIds.map((id) => id.toString()),
      scheduledAt: p.scheduledAt,
      timezone: p.timezone,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
