import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Workspace, WorkspaceDocument } from './schemas/workspace.schema';
import {
  Membership,
  MembershipDocument,
} from '../memberships/schemas/membership.schema';
import { Role } from '../common/enums/role.enum';
import { slugify, randomSuffix } from '../common/utils/slugify';
import { NotFoundException } from '@nestjs/common';

export interface WorkspaceWithRole {
  id: string;
  name: string;
  slug: string;
  role: Role;
}

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<WorkspaceDocument>,
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<MembershipDocument>,
  ) {}

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || 'workspace';
    let candidate = base;
    let attempt = 0;

    while (await this.workspaceModel.exists({ slug: candidate })) {
      attempt += 1;
      candidate = `${base}-${randomSuffix()}`;
      if (attempt > 5) {
        // Extremely unlikely, but never loop forever
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
      .filter((m) => m.workspaceId) // guard against orphaned membership edge case
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
    if (!Types.ObjectId.isValid(workspaceId)) {
      return null;
    }

    const membership = await this.membershipModel
      .findOne({
        userId: new Types.ObjectId(userId),
        workspaceId: new Types.ObjectId(workspaceId),
      })
      .exec();

    if (!membership) {
      return null;
    }

    const workspace = await this.workspaceModel.findById(workspaceId).exec();
    if (!workspace) {
      return null;
    }

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
      role: Role.OWNER, // caller already knows the role from WorkspaceGuard; controller will merge it
    };
  }
}
