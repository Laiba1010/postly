import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';

import { QueueService } from '../queue/queue.service';
import { PostStatusAggregator } from './post-status-aggregator';
import { MAX_PUBLISH_ATTEMPTS } from '../queue/retry-policy';
import type { PostStatusResponse } from './dto/post-status-response.dto';
import {
  ListPostsQueryDto,
  PostListSortBy,
  PostListSortDir,
} from './dto/list-posts-query.dto';

import { Post, PostDocument } from './schemas/post.schema';
import { PostTarget, PostTargetDocument } from './schemas/post-target.schema';
import {
  PublishingAttempt,
  PublishingAttemptDocument,
} from './schemas/publishing-attempt.schema';

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
  retryCount: number;
  nextRetryAt: Date | null;
  externalPostId: string | null;
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
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
    @InjectModel(PostTarget.name)
    private readonly postTargetModel: Model<PostTargetDocument>,
    @InjectModel(PublishingAttempt.name)
    private readonly publishingAttemptModel: Model<PublishingAttemptDocument>,
    @InjectModel(SocialConnection.name)
    private readonly socialConnectionModel: Model<SocialConnectionDocument>,
    @InjectModel(Media.name)
    private readonly mediaModel: Model<MediaDocument>,
    private readonly queueService: QueueService,
    private readonly postStatusAggregator: PostStatusAggregator,
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
    destinationInputs: {
      provider: string;
      socialConnectionId: string;
    }[],
  ) {
    if (!destinationInputs || destinationInputs.length === 0) {
      return [];
    }

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
    session?: ClientSession,
  ) {
    if (!mediaIds || mediaIds.length === 0) {
      return [];
    }

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

    const query = this.mediaModel.find({
      _id: { $in: objectIds },
      workspaceId: new Types.ObjectId(workspaceId),
    });
    if (session) query.session(session);
    const media = await query.exec();

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

    const session = await this.connection.startSession();
    let post!: PostDocument;

    try {
      await session.withTransaction(async () => {
        // Recheck attachment state inside the transaction so validation and
        // association are protected against concurrent draft saves.
        const lockedMediaIds = await this.resolveAndValidateMedia(
          workspaceId,
          dto.mediaIds ?? [],
          null,
          session,
        );

        post = await this.postModel
          .create(
            [
              {
                workspaceId: new Types.ObjectId(workspaceId),
                authorId: new Types.ObjectId(authorId),
                content: dto.content ?? '',
                status: PostStatus.DRAFT,
                destinations,
                mediaIds: lockedMediaIds,
              },
            ],
            { session },
          )
          .then((docs) => docs[0]);

        if (lockedMediaIds.length > 0) {
          const result = await this.mediaModel.updateMany(
            {
              _id: { $in: lockedMediaIds },
              workspaceId: new Types.ObjectId(workspaceId),
              postId: null,
            },
            { $set: { postId: post._id } },
            { session },
          );

          if (result.modifiedCount !== lockedMediaIds.length) {
            throw new BadRequestException({
              code: 'MEDIA_ALREADY_ATTACHED',
              message:
                'One or more selected media items are already attached to another post',
            });
          }
        }
      });
    } finally {
      await session.endSession();
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

  async listPosts(
    workspaceId: string,
    query: ListPostsQueryDto,
  ): Promise<{
    posts: (PostSummary & {
      targets: {
        id: string;
        platform: string;
        socialConnectionId: string;
        accountName: string;
        status: PostTargetStatus;
        scheduledAt: Date;
        retryCount: number;
        nextRetryAt: Date | null;
      }[];
    })[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const workspaceObjectId = this.toObjectId(workspaceId, 'workspaceId');
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const filter: Record<string, unknown> = { workspaceId: workspaceObjectId };

    if (query.status) filter.status = query.status;
    if (query.platform)
      filter.destinations = { $elemMatch: { provider: query.platform } };

    const search = query.search?.trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.content = { $regex: escaped, $options: 'i' };
    }

    if (query.createdFrom || query.createdTo) {
      const createdAt: Record<string, Date> = {};
      if (query.createdFrom) {
        const from = new Date(
          /^\d{4}-\d{2}-\d{2}$/.test(query.createdFrom)
            ? `${query.createdFrom}T00:00:00.000Z`
            : query.createdFrom,
        );
        if (Number.isNaN(from.getTime()))
          throw new BadRequestException({
            code: 'INVALID_CREATED_FROM',
            message: 'createdFrom must be a valid ISO date',
          });
        createdAt.$gte = from;
      }
      if (query.createdTo) {
        const to = new Date(
          /^\d{4}-\d{2}-\d{2}$/.test(query.createdTo)
            ? `${query.createdTo}T23:59:59.999Z`
            : query.createdTo,
        );
        if (Number.isNaN(to.getTime()))
          throw new BadRequestException({
            code: 'INVALID_CREATED_TO',
            message: 'createdTo must be a valid ISO date',
          });
        createdAt.$lte = to;
      }
      if (createdAt.$gte && createdAt.$lte && createdAt.$gte > createdAt.$lte) {
        throw new BadRequestException({
          code: 'INVALID_CREATED_RANGE',
          message: 'createdFrom must not be later than createdTo',
        });
      }
      filter.createdAt = createdAt;
    }

    const sortField = query.sortBy ?? PostListSortBy.UPDATED_AT;
    const sortDirection = query.sortDir === PostListSortDir.ASC ? 1 : -1;
    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .sort({ [sortField]: sortDirection, _id: sortDirection })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.postModel.countDocuments(filter),
    ]);

    const postIds = posts.map((post) => post._id);
    const targets = postIds.length
      ? await this.postTargetModel
          .find({ workspaceId: workspaceObjectId, postId: { $in: postIds } })
          .select(
            '_id postId platform socialConnectionId status scheduledAt retryCount nextRetryAt',
          )
          .lean()
          .exec()
      : [];

    const targetsByPost = new Map<string, typeof targets>();
    for (const target of targets) {
      const key = target.postId.toString();
      const list = targetsByPost.get(key);
      if (list) list.push(target);
      else targetsByPost.set(key, [target]);
    }

    return {
      posts: posts.map((post) => {
        const destinationNames = new Map(
          post.destinations.map((d) => [
            d.socialConnectionId.toString(),
            d.accountName,
          ]),
        );
        return {
          ...this.toSummary(post),
          targets: (targetsByPost.get(post._id.toString()) ?? []).map(
            (target) => ({
              id: target._id.toString(),
              platform: target.platform,
              socialConnectionId: target.socialConnectionId.toString(),
              accountName:
                destinationNames.get(target.socialConnectionId.toString()) ??
                'Connected account',
              status: target.status,
              scheduledAt: target.scheduledAt,
              retryCount: target.retryCount ?? 0,
              nextRetryAt: target.nextRetryAt ?? null,
            }),
          ),
        };
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async listDrafts(workspaceId: string): Promise<PostSummary[]> {
    const result = await this.listPosts(workspaceId, {
      page: 1,
      limit: 50,
      sortBy: PostListSortBy.UPDATED_AT,
      sortDir: PostListSortDir.DESC,
    } as ListPostsQueryDto);
    return result.posts.map(({ ...post }) => post);
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

  async deletePost(workspaceId: string, postId: string): Promise<void> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const post = await this.postModel
          .findOne({
            _id: new Types.ObjectId(postId),
            workspaceId: new Types.ObjectId(workspaceId),
            status: { $in: [PostStatus.DRAFT, PostStatus.CANCELLED] },
          })
          .session(session)
          .exec();

        if (!post) {
          throw new NotFoundException({
            code: 'POST_NOT_FOUND',
            message: 'Post not found or cannot be deleted in its current state',
          });
        }

        if (post.mediaIds.length > 0) {
          await this.mediaModel.updateMany(
            {
              _id: { $in: post.mediaIds },
              workspaceId: new Types.ObjectId(workspaceId),
              postId: post._id,
            },
            { $set: { postId: null } },
            { session },
          );
        }

        const targetIds = await this.postTargetModel
          .find({
            postId: post._id,
            workspaceId: new Types.ObjectId(workspaceId),
          })
          .distinct('_id')
          .session(session)
          .exec();

        if (targetIds.length > 0) {
          await this.publishingAttemptModel.deleteMany(
            { postTargetId: { $in: targetIds } },
            { session },
          );
        }

        await this.postTargetModel.deleteMany(
          { postId: post._id, workspaceId: new Types.ObjectId(workspaceId) },
          { session },
        );

        await post.deleteOne({ session });
      });
    } finally {
      await session.endSession();
    }
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

    const session = await this.connection.startSession();
    let updatedPost!: PostDocument;
    const removedScheduledTargetIds: string[] = [];

    try {
      await session.withTransaction(async () => {
        const post = await this.postModel
          .findOne({
            _id: new Types.ObjectId(postId),
            workspaceId: new Types.ObjectId(workspaceId),
          })
          .session(session)
          .exec();

        if (!post) {
          throw new NotFoundException({
            code: 'POST_NOT_FOUND',
            message: 'Post not found',
          });
        }

        if (
          post.status !== PostStatus.DRAFT &&
          post.status !== PostStatus.SCHEDULED
        ) {
          throw new ForbiddenException({
            code: 'POST_NOT_EDITABLE',
            message: 'Only draft and scheduled posts can be edited',
          });
        }

        const isScheduledPost = post.status === PostStatus.SCHEDULED;

        const previousMediaIds = (post.mediaIds || []).map((id) =>
          id.toString(),
        );

        const destinations =
          dto.destinations !== undefined
            ? await this.resolveAndValidateDestinations(
                workspaceId,
                dto.destinations,
              )
            : post.destinations;

        if (isScheduledPost && destinations.length === 0) {
          throw new BadRequestException({
            code: 'CANNOT_SAVE_SCHEDULED_WITHOUT_DESTINATIONS',
            message: 'A scheduled post must have at least one platform',
          });
        }

        const mediaIds =
          dto.mediaIds !== undefined
            ? await this.resolveAndValidateMedia(
                workspaceId,
                dto.mediaIds,
                postId,
                session,
              )
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

        const newMediaIds = mediaIds.map((id) => id.toString());
        const added = newMediaIds.filter(
          (id) => !previousMediaIds.includes(id),
        );
        const removed = previousMediaIds.filter(
          (id) => !newMediaIds.includes(id),
        );

        let targetsToRemove: Types.ObjectId[] = [];
        let destinationsToAdd: typeof destinations = [];

        if (isScheduledPost) {
          const existingTargets = await this.postTargetModel
            .find({
              postId: post._id,
              workspaceId: new Types.ObjectId(workspaceId),
            })
            .session(session)
            .exec();

          const nonScheduledTarget = existingTargets.find(
            (target) => target.status !== PostTargetStatus.SCHEDULED,
          );

          if (nonScheduledTarget) {
            throw new ConflictException({
              code: 'POST_PUBLISHING_STARTED',
              message:
                'This post has started publishing and can no longer be edited',
            });
          }

          const nextConnectionIds = new Set(
            destinations.map((destination) =>
              destination.socialConnectionId.toString(),
            ),
          );

          targetsToRemove = existingTargets
            .filter(
              (target) =>
                !nextConnectionIds.has(target.socialConnectionId.toString()),
            )
            .map((target) => target._id);

          removedScheduledTargetIds.push(
            ...targetsToRemove.map((targetId) => targetId.toString()),
          );

          const existingConnectionIds = new Set(
            existingTargets.map((target) =>
              target.socialConnectionId.toString(),
            ),
          );

          destinationsToAdd = destinations.filter(
            (destination) =>
              !existingConnectionIds.has(
                destination.socialConnectionId.toString(),
              ),
          );
        }

        if (added.length > 0) {
          const result = await this.mediaModel.updateMany(
            {
              _id: { $in: added.map((id) => new Types.ObjectId(id)) },
              workspaceId: new Types.ObjectId(workspaceId),
              postId: null,
            },
            { $set: { postId: post._id } },
            { session },
          );

          if (result.modifiedCount !== added.length) {
            throw new BadRequestException({
              code: 'MEDIA_ALREADY_ATTACHED',
              message:
                'One or more selected media items are already attached to another post',
            });
          }
        }

        if (removed.length > 0) {
          await this.mediaModel.updateMany(
            {
              _id: { $in: removed.map((id) => new Types.ObjectId(id)) },
              workspaceId: new Types.ObjectId(workspaceId),
              postId: post._id,
            },
            { $set: { postId: null } },
            { session },
          );
        }

        post.content = content;
        post.destinations = destinations as any;
        post.mediaIds = mediaIds as any;

        if (isScheduledPost) {
          if (targetsToRemove.length > 0) {
            await this.publishingAttemptModel.deleteMany(
              { postTargetId: { $in: targetsToRemove } },
              { session },
            );

            await this.postTargetModel.deleteMany(
              {
                _id: { $in: targetsToRemove },
                postId: post._id,
                workspaceId: new Types.ObjectId(workspaceId),
              },
              { session },
            );
          }

          if (destinationsToAdd.length > 0) {
            await this.postTargetModel.insertMany(
              destinationsToAdd.map((destination) => ({
                postId: post._id,
                workspaceId: post.workspaceId,
                platform: destination.provider,
                socialConnectionId: destination.socialConnectionId,
                status: PostTargetStatus.SCHEDULED,
                scheduledAt: post.scheduledAt,
                retryCount: 0,
                nextRetryAt: null,
                externalPostId: null,
              })),
              { session },
            );
          }
        }

        await post.save({ session });
        updatedPost = post;
      });
    } finally {
      await session.endSession();
    }

    if (updatedPost.status === PostStatus.SCHEDULED) {
      await Promise.all(
        removedScheduledTargetIds.map(async (targetId) => {
          const queueRemoved = await this.queueService.removeJob(targetId);

          if (!queueRemoved) {
            this.logger.error(
              `Queue cleanup failed while removing scheduled post target ${targetId}`,
            );
          }
        }),
      );

      const currentTargets = await this.postTargetModel.find({
        postId: updatedPost._id,
        workspaceId: new Types.ObjectId(workspaceId),
        status: PostTargetStatus.SCHEDULED,
      });

      await Promise.all(
        currentTargets.map(async (target) => {
          const queueSynced = await this.queueService.rescheduleJob(
            {
              postTargetId: target._id.toString(),
              workspaceId,
              postId: updatedPost._id.toString(),
              platform: target.platform,
            },
            updatedPost.scheduledAt!,
          );

          if (!queueSynced) {
            this.logger.error(
              `Queue synchronization failed while editing scheduled post target ${target._id.toString()}`,
            );
          }
        }),
      );
    }

    return this.toSummary(updatedPost);
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

    let insertedTargets: PostTargetDocument[] = [];

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

        insertedTargets = await this.postTargetModel.insertMany(targetDocs, {
          session,
        });
      });

      /**
       * Queue sync happens after the DB transaction commits.
       *
       * MongoDB and Redis cannot participate in the same transaction here,
       * so a queue failure must be explicitly detected rather than silently
       * reported as a successful enqueue.
       *
       * ReconciliationService is responsible for repairing any queue drift.
       */
      await Promise.all(
        insertedTargets.map(async (target) => {
          const queueSynced = await this.queueService.scheduleJob(
            {
              postTargetId: target._id.toString(),
              workspaceId,
              postId: scheduledPost!._id.toString(),
              platform: target.platform,
            },
            scheduledUtc,
          );

          if (!queueSynced) {
            // The DB transaction has already committed, so we cannot roll it
            // back here. Make the failure explicit in application logs so it
            // can be detected and repaired by reconciliation.
            //
            // Do not throw here: throwing would make the HTTP request look
            // like a failed schedule even though the post is already
            // SCHEDULED in MongoDB.
            this.logger.error(
              `Queue synchronization failed for scheduled post target ${target._id.toString()}`,
            );
          }
        }),
      );

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
    } finally {
      await session.endSession();
    }

    const affectedTargets = await this.postTargetModel.find({
      postId: post._id,
      workspaceId: workspaceObjectId,
      status: PostTargetStatus.SCHEDULED,
    });

    await Promise.all(
      affectedTargets.map(async (target) => {
        const queueSynced = await this.queueService.rescheduleJob(
          {
            postTargetId: target._id.toString(),
            workspaceId,
            postId: post._id.toString(),
            platform: target.platform,
          },
          scheduledUtc,
        );

        if (!queueSynced) {
          this.logger.error(
            `Queue synchronization failed while rescheduling post target ${target._id.toString()}`,
          );
        }
      }),
    );

    return this.toSummary(post);
  }

  async cancelSchedule(
    workspaceId: string,
    postId: string,
  ): Promise<PostSummary> {
    const workspaceObjectId = this.toObjectId(workspaceId, 'workspaceId');
    const postObjectId = this.toObjectId(postId, 'postId');

    const session = await this.connection.startSession();
    const targetIdsToCancel: string[] = [];
    let cancelledPost: PostDocument | null = null;

    try {
      await session.withTransaction(async () => {
        const post = await this.postModel
          .findOne({ _id: postObjectId, workspaceId: workspaceObjectId })
          .session(session);

        if (!post) {
          throw new NotFoundException({
            code: 'POST_NOT_FOUND',
            message: 'Post not found',
          });
        }

        if (
          post.status !== PostStatus.SCHEDULED &&
          post.status !== PostStatus.PUBLISHING
        ) {
          throw new BadRequestException({
            code: 'INVALID_STATE_TRANSITION',
            message:
              'Only scheduled posts with pending targets can be cancelled',
          });
        }

        const targets = await this.postTargetModel
          .find({
            postId: post._id,
            workspaceId: workspaceObjectId,
            status: {
              $in: [PostTargetStatus.SCHEDULED, PostTargetStatus.RETRYING],
            },
          })
          .select('_id')
          .session(session)
          .lean()
          .exec();

        const [publishedTarget, inFlightTarget] = await Promise.all([
          this.postTargetModel.exists({
            postId: post._id,
            workspaceId: workspaceObjectId,
            status: PostTargetStatus.PUBLISHED,
          }),
          this.postTargetModel.exists({
            postId: post._id,
            workspaceId: workspaceObjectId,
            status: PostTargetStatus.PUBLISHING,
          }),
        ]);

        if (post.status === PostStatus.PUBLISHING && targets.length === 0) {
          // Active PUBLISHING cancellation remains deliberately out of scope.
          // We cannot safely interrupt an already-running external publish in
          // this MVP without introducing worker cancellation semantics.
          throw new BadRequestException({
            code: 'INVALID_STATE_TRANSITION',
            message:
              'Posts with only actively publishing targets cannot be cancelled',
          });
        }

        const updateResult = await this.postTargetModel.updateMany(
          {
            postId: post._id,
            workspaceId: workspaceObjectId,
            status: {
              $in: [PostTargetStatus.SCHEDULED, PostTargetStatus.RETRYING],
            },
          },
          { $set: { status: PostTargetStatus.CANCELLED, nextRetryAt: null } },
          { session },
        );

        if (updateResult.modifiedCount > 0) {
          targetIdsToCancel.push(
            ...targets.map((target) => target._id.toString()),
          );
        }

        post.status = publishedTarget
          ? PostStatus.PARTIALLY_PUBLISHED
          : inFlightTarget
            ? PostStatus.PUBLISHING
            : PostStatus.CANCELLED;
        await post.save({ session });
        cancelledPost = post;
      });
    } finally {
      await session.endSession();
    }

    await Promise.all(
      targetIdsToCancel.map(async (targetId) => {
        const queueRemoved = await this.queueService.removeJob(targetId);
        if (!queueRemoved) {
          console.error(
            `Queue synchronization failed while cancelling post target ${targetId}`,
          );
        }
      }),
    );

    return this.toSummary(cancelledPost!);
  }

  async retryTarget(
    workspaceId: string,
    postId: string,
    targetId: string,
  ): Promise<PostTargetSummary> {
    const workspaceObjectId = this.toObjectId(workspaceId, 'workspaceId');
    const postObjectId = this.toObjectId(postId, 'postId');
    const targetObjectId = this.toObjectId(targetId, 'targetId');

    const session = await this.connection.startSession();
    let target: PostTargetDocument | null = null;

    try {
      await session.withTransaction(async () => {
        const post = await this.postModel
          .findOne({ _id: postObjectId, workspaceId: workspaceObjectId })
          .select('_id status')
          .session(session)
          .lean()
          .exec();

        if (!post) {
          throw new NotFoundException({
            code: 'POST_NOT_FOUND',
            message: 'Post not found',
          });
        }

        if (post.status === PostStatus.CANCELLED) {
          throw new BadRequestException({
            code: 'INVALID_STATE_TRANSITION',
            message: 'Cancelled posts cannot be retried',
          });
        }

        target = await this.postTargetModel.findOneAndUpdate(
          {
            _id: targetObjectId,
            postId: postObjectId,
            workspaceId: workspaceObjectId,
            status: PostTargetStatus.FAILED,
          },
          {
            $set: {
              status: PostTargetStatus.RETRYING,
              nextRetryAt: null,
            },
          },
          { new: true, session },
        );

        if (!target) {
          const existing = await this.postTargetModel
            .findOne({
              _id: targetObjectId,
              postId: postObjectId,
              workspaceId: workspaceObjectId,
            })
            .session(session)
            .lean()
            .exec();

          if (!existing) {
            throw new NotFoundException({
              code: 'TARGET_NOT_FOUND',
              message: 'Post target not found',
            });
          }

          throw new BadRequestException({
            code: 'TARGET_NOT_RETRYABLE',
            message: 'Only failed targets can be manually retried',
          });
        }

        await this.postStatusAggregator.recomputePostStatus(
          postObjectId,
          session,
        );
      });
    } finally {
      await session.endSession();
    }

    const targetDocument = target!;
    const queueSynced = await this.queueService.retryJob({
      postTargetId: targetDocument._id.toString(),
      workspaceId,
      postId,
      platform: targetDocument.platform,
    });

    if (!queueSynced) {
      // MongoDB already contains the durable RETRYING state. Reconciliation
      // will reconstruct the derived BullMQ job if necessary.
    }

    return {
      id: targetDocument._id.toString(),
      platform: targetDocument.platform,
      socialConnectionId: targetDocument.socialConnectionId.toString(),
      status: targetDocument.status,
      scheduledAt: targetDocument.scheduledAt,
      retryCount: targetDocument.retryCount ?? 0,
      nextRetryAt: targetDocument.nextRetryAt,
      externalPostId: targetDocument.externalPostId,
    };
  }

  async getPostStatus(
    workspaceId: string,
    postId: string,
  ): Promise<PostStatusResponse> {
    const workspaceObjectId = this.toObjectId(workspaceId, 'workspaceId');
    const postObjectId = this.toObjectId(postId, 'postId');

    const post = await this.postModel
      .findOne({ _id: postObjectId, workspaceId: workspaceObjectId })
      .select('_id status updatedAt destinations')
      .lean()
      .exec();

    if (!post) {
      throw new NotFoundException({
        code: 'POST_NOT_FOUND',
        message: 'Post not found',
      });
    }

    const targets = await this.postTargetModel
      .find({ postId: postObjectId, workspaceId: workspaceObjectId })
      .select(
        '_id platform socialConnectionId status scheduledAt retryCount nextRetryAt externalPostId',
      )
      .lean()
      .exec();

    const targetIds = targets.map((target) => target._id);
    const attempts = targetIds.length
      ? await this.publishingAttemptModel
          .find({ postTargetId: { $in: targetIds } })
          .select(
            'postTargetId attemptNumber status startedAt completedAt errorCode errorMessage',
          )
          .sort({ attemptNumber: -1 })
          .lean()
          .exec()
      : [];

    const latestAttemptByTarget = new Map<string, (typeof attempts)[number]>();

    for (const attempt of attempts) {
      const key = attempt.postTargetId.toString();
      if (!latestAttemptByTarget.has(key)) {
        latestAttemptByTarget.set(key, attempt);
      }
    }

    const accountNames = new Map(
      post.destinations.map((destination) => [
        destination.socialConnectionId.toString(),
        destination.accountName,
      ]),
    );

    return {
      postId: post._id.toString(),
      status: post.status,
      updatedAt: post.updatedAt,
      targets: targets.map((target) => {
        const attempt = latestAttemptByTarget.get(target._id.toString());

        return {
          id: target._id.toString(),
          platform: target.platform,
          socialConnectionId: target.socialConnectionId.toString(),
          accountName:
            accountNames.get(target.socialConnectionId.toString()) ??
            'Connected account',
          status: target.status,
          scheduledAt: target.scheduledAt,
          externalPostId: target.externalPostId ?? null,
          attempt: attempt
            ? {
                number: attempt.attemptNumber,
                status: attempt.status,
                startedAt: attempt.startedAt,
                completedAt: attempt.completedAt ?? null,
                errorCode: attempt.errorCode ?? null,
                errorMessage: attempt.errorMessage ?? null,
              }
            : null,
          retry: {
            count: target.retryCount ?? 0,
            maxAttempts: MAX_PUBLISH_ATTEMPTS,
            nextRetryAt: target.nextRetryAt ?? null,
          },
        };
      }),
    };
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
      retryCount: target.retryCount ?? 0,
      nextRetryAt: target.nextRetryAt,
      externalPostId: target.externalPostId,
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
