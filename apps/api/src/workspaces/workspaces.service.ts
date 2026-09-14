import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Workspace, WorkspaceDocument } from './schemas/workspace.schema';
import {
  Membership,
  MembershipDocument,
} from '../memberships/schemas/membership.schema';
import { Role } from '../common/enums/role.enum';
import { slugify, randomSuffix } from '../common/utils/slugify';
import {
  SocialConnection,
  SocialConnectionDocument,
} from '../social-connections/schemas/social-connection.schema';
import {
  Invitation,
  InvitationDocument,
} from '../invitations/schemas/invitation.schema';
import { Post, PostDocument } from '../posts/schemas/post.schema';
import {
  PostTarget,
  PostTargetDocument,
} from '../posts/schemas/post-target.schema';
import {
  PublishingAttempt,
  PublishingAttemptDocument,
} from '../posts/schemas/publishing-attempt.schema';
import { Media, MediaDocument } from '../media/schemas/media.schema';
import { QueueService } from '../queue/queue.service';
import { MediaService } from '../media/media.service';
import { Inject, forwardRef } from '@nestjs/common';

export interface WorkspaceWithRole {
  id: string;
  name: string;
  slug: string;
  role: Role;
}

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<WorkspaceDocument>,
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<MembershipDocument>,
    @InjectModel(SocialConnection.name)
    private readonly socialConnectionModel: Model<SocialConnectionDocument>,
    @InjectModel(Invitation.name)
    private readonly invitationModel: Model<InvitationDocument>,
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
    @InjectModel(PostTarget.name)
    private readonly postTargetModel: Model<PostTargetDocument>,
    @InjectModel(PublishingAttempt.name)
    private readonly publishingAttemptModel: Model<PublishingAttemptDocument>,
    @InjectModel(Media.name)
    private readonly mediaModel: Model<MediaDocument>,
    private readonly queueService: QueueService,
    @Inject(forwardRef(() => MediaService))
    private readonly mediaService: MediaService,
  ) {}

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || 'workspace';
    let candidate = base;
    let attempt = 0;

    while (await this.workspaceModel.exists({ slug: candidate })) {
      attempt += 1;
      candidate = `${base}-${randomSuffix()}`;
      if (attempt > 5) {
        candidate = `${base}-${Date.now()}`;
        break;
      }
    }

    return candidate;
  }

  async createWorkspace(
    userId: string,
    name: string,
  ): Promise<WorkspaceWithRole> {
    const slug = await this.generateUniqueSlug(name);
    const session = await this.connection.startSession();

    try {
      let workspace!: WorkspaceDocument;

      await session.withTransaction(async () => {
        const created = await this.workspaceModel.create([{ name, slug }], {
          session,
        });
        workspace = created[0];

        await this.membershipModel.create(
          [
            {
              userId: new Types.ObjectId(userId),
              workspaceId: workspace._id,
              role: Role.OWNER,
            },
          ],
          { session },
        );
      });

      return {
        id: workspace._id.toString(),
        name: workspace.name,
        slug: workspace.slug,
        role: Role.OWNER,
      };
    } finally {
      await session.endSession();
    }
  }

  async listForUser(userId: string): Promise<WorkspaceWithRole[]> {
    const memberships = await this.membershipModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate<{ workspaceId: WorkspaceDocument }>('workspaceId')
      .exec();

    return memberships
      .filter((m) => m.workspaceId)
      .map((m) => ({
        id: m.workspaceId._id.toString(),
        name: m.workspaceId.name,
        slug: m.workspaceId.slug,
        role: m.role,
      }));
  }

  async verifyMembership(
    userId: string,
    workspaceId: string,
  ): Promise<Role | null> {
    if (!Types.ObjectId.isValid(workspaceId)) return null;

    const membership = await this.membershipModel
      .findOne({
        userId: new Types.ObjectId(userId),
        workspaceId: new Types.ObjectId(workspaceId),
      })
      .exec();

    return membership ? membership.role : null;
  }

  async getWorkspaceContext(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceWithRole | null> {
    if (!Types.ObjectId.isValid(workspaceId)) return null;

    const membership = await this.membershipModel
      .findOne({
        userId: new Types.ObjectId(userId),
        workspaceId: new Types.ObjectId(workspaceId),
      })
      .exec();

    if (!membership) return null;

    const workspace = await this.workspaceModel.findById(workspaceId).exec();
    if (!workspace) return null;

    return {
      id: workspace._id.toString(),
      name: workspace.name,
      slug: workspace.slug,
      role: membership.role,
    };
  }

  async updateWorkspace(
    workspaceId: string,
    updates: { name?: string },
  ): Promise<WorkspaceWithRole> {
    const workspace = await this.workspaceModel.findById(workspaceId).exec();
    if (!workspace) {
      throw new NotFoundException({
        code: 'WORKSPACE_NOT_FOUND',
        message: 'Workspace not found',
      });
    }

    if (updates.name !== undefined) {
      workspace.name = updates.name;
      await workspace.save();
    }

    return {
      id: workspace._id.toString(),
      name: workspace.name,
      slug: workspace.slug,
      role: Role.OWNER,
    };
  }

  /**
   * Deletes all Phase 0–10 workspace-owned domain records in one Mongo
   * transaction, then removes derived BullMQ jobs and physical media files.
   * Redis/storage cannot participate in the Mongo transaction, so they are
   * deliberately handled after the durable database deletion.
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    const workspaceObjectId = new Types.ObjectId(workspaceId);
    const session = await this.connection.startSession();
    let storageKeys: string[] = [];

    try {
      await session.withTransaction(async () => {
        const workspace = await this.workspaceModel
          .findById(workspaceObjectId)
          .session(session)
          .exec();

        if (!workspace) {
          throw new NotFoundException({
            code: 'WORKSPACE_NOT_FOUND',
            message: 'Workspace not found',
          });
        }

        const media = await this.mediaModel
          .find({ workspaceId: workspaceObjectId })
          .select('storageKey')
          .session(session)
          .lean()
          .exec();

        const targets = await this.postTargetModel
          .find({ workspaceId: workspaceObjectId })
          .select('_id')
          .session(session)
          .lean()
          .exec();

        storageKeys = media.map((item) => item.storageKey);
        const targetIds = targets.map((item) => item._id);

        if (targetIds.length > 0) {
          await this.publishingAttemptModel.deleteMany(
            { postTargetId: { $in: targetIds } },
            { session },
          );
        }

        await this.postTargetModel.deleteMany(
          { workspaceId: workspaceObjectId },
          { session },
        );
        await this.postModel.deleteMany(
          { workspaceId: workspaceObjectId },
          { session },
        );
        await this.mediaModel.deleteMany(
          { workspaceId: workspaceObjectId },
          { session },
        );
        await this.socialConnectionModel.deleteMany(
          { workspaceId: workspaceObjectId },
          { session },
        );
        await this.invitationModel.deleteMany(
          { workspaceId: workspaceObjectId },
          { session },
        );
        await this.membershipModel.deleteMany(
          { workspaceId: workspaceObjectId },
          { session },
        );

        await this.workspaceModel.deleteOne(
          { _id: workspaceObjectId },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    const queueCleaned =
      await this.queueService.removeWorkspaceJobs(workspaceId);
    if (!queueCleaned) {
      this.logger.error(
        `Workspace queue cleanup incomplete workspaceId=${workspaceId}`,
      );
    }

    for (const storageKey of storageKeys) {
      try {
        await this.mediaService.deleteFileByStorageKey(storageKey);
      } catch (err) {
        this.logger.error(
          `Failed to delete workspace media file workspaceId=${workspaceId} storageKey=${storageKey}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
