import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Membership, MembershipDocument } from './schemas/membership.schema';
import { User } from '../users/schemas/user.schema';
import { Role } from '../common/enums/role.enum';

export interface MemberSummary {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
}

@Injectable()
export class MembershipsService {
  constructor(
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<MembershipDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async listMembers(workspaceId: string): Promise<MemberSummary[]> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      throw new BadRequestException({
        code: 'INVALID_WORKSPACE_ID',
        message: 'Invalid workspace ID',
      });
    }

    const memberships = await this.membershipModel
      .find({ workspaceId: new Types.ObjectId(workspaceId) })
      .populate<{ userId: User & { _id: Types.ObjectId } }>('userId')
      .sort({ createdAt: 1 })
      .exec();

    return memberships
      .filter((m) => m.userId) // guard against a dangling user reference
      .map((m) => ({
        membershipId: m._id.toString(),
        userId: m.userId._id.toString(),
        name: m.userId.name,
        email: m.userId.email,
        role: m.role,
      }));
  }

  private async countOwners(
    workspaceId: string,
    session?: ClientSession,
  ): Promise<number> {
    const query = this.membershipModel.countDocuments({
      workspaceId: new Types.ObjectId(workspaceId),
      role: Role.OWNER,
    });
    if (session) query.session(session);
    return query.exec();
  }

  async updateMemberRole(
    workspaceId: string,
    membershipId: string,
    newRole: Role,
    actingUserId: string,
  ): Promise<MemberSummary> {
    if (newRole === Role.OWNER) {
      throw new BadRequestException({
        code: 'OWNER_TRANSFER_NOT_SUPPORTED',
        message: 'Ownership transfer is not supported in the MVP',
      });
    }

    if (!Types.ObjectId.isValid(workspaceId)) {
      throw new BadRequestException({
        code: 'INVALID_WORKSPACE_ID',
        message: 'Invalid workspace ID',
      });
    }
    if (!Types.ObjectId.isValid(membershipId)) {
      throw new BadRequestException({
        code: 'INVALID_MEMBERSHIP_ID',
        message: 'Invalid membership ID',
      });
    }

    const workspaceObjectId = new Types.ObjectId(workspaceId);
    const membershipObjectId = new Types.ObjectId(membershipId);

    const current = await this.membershipModel
      .findOne({ _id: membershipObjectId, workspaceId: workspaceObjectId })
      .populate<{ userId: User & { _id: Types.ObjectId } }>('userId')
      .exec();

    if (!current) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Member not found in this workspace',
      });
    }

    const isSelf = current.userId._id.toString() === actingUserId;

    if (isSelf && current.role === Role.OWNER) {
      throw new BadRequestException({
        code: 'CANNOT_DEMOTE_OWNER',
        message: 'You cannot demote yourself as the workspace owner',
      });
    }

    let updated: MembershipDocument | null = null;

    if (current.role === Role.OWNER) {
      const session = await this.connection.startSession();
      try {
        await session.withTransaction(async () => {
          const ownerCount = await this.countOwners(workspaceId, session);
          if (ownerCount <= 1) {
            throw new BadRequestException({
              code: 'CANNOT_DEMOTE_OWNER',
              message: 'A workspace must always have at least one owner',
            });
          }

          updated = await this.membershipModel.findOneAndUpdate(
            {
              _id: membershipObjectId,
              workspaceId: workspaceObjectId,
              role: Role.OWNER,
            },
            { $set: { role: newRole } },
            { new: true, session },
          );

          if (!updated) {
            throw new BadRequestException({
              code: 'MEMBER_CHANGED',
              message: 'The member changed before this update completed',
            });
          }
        });
      } finally {
        await session.endSession();
      }
    } else {
      updated = await this.membershipModel.findOneAndUpdate(
        {
          _id: membershipObjectId,
          workspaceId: workspaceObjectId,
          role: { $ne: Role.OWNER },
        },
        { $set: { role: newRole } },
        { new: true },
      );
    }

    if (!updated) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Member not found in this workspace',
      });
    }

    const populated = await updated.populate<{
      userId: User & { _id: Types.ObjectId };
    }>('userId');

    return {
      membershipId: populated._id.toString(),
      userId: populated.userId._id.toString(),
      name: populated.userId.name,
      email: populated.userId.email,
      role: populated.role,
    };
  }

  async removeMember(
    workspaceId: string,
    membershipId: string,
    actingUserId: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      throw new BadRequestException({
        code: 'INVALID_WORKSPACE_ID',
        message: 'Invalid workspace ID',
      });
    }
    if (!Types.ObjectId.isValid(membershipId)) {
      throw new BadRequestException({
        code: 'INVALID_MEMBERSHIP_ID',
        message: 'Invalid membership ID',
      });
    }

    const workspaceObjectId = new Types.ObjectId(workspaceId);
    const membershipObjectId = new Types.ObjectId(membershipId);

    const membership = await this.membershipModel
      .findOne({ _id: membershipObjectId, workspaceId: workspaceObjectId })
      .exec();

    if (!membership) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Member not found in this workspace',
      });
    }

    const isSelf = membership.userId.toString() === actingUserId;

    if (isSelf) {
      throw new BadRequestException({
        code: 'CANNOT_REMOVE_MEMBER',
        message: 'You cannot remove yourself from the workspace',
      });
    }

    if (membership.role !== Role.OWNER) {
      const result = await this.membershipModel.deleteOne({
        _id: membershipObjectId,
        workspaceId: workspaceObjectId,
        role: { $ne: Role.OWNER },
      });

      if (result.deletedCount !== 1) {
        throw new BadRequestException({
          code: 'MEMBER_CHANGED',
          message: 'The member changed before this removal completed',
        });
      }
      return;
    }

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const ownerCount = await this.countOwners(workspaceId, session);
        if (ownerCount <= 1) {
          throw new BadRequestException({
            code: 'CANNOT_REMOVE_OWNER',
            message: 'A workspace must always have at least one owner',
          });
        }

        const result = await this.membershipModel.deleteOne(
          {
            _id: membershipObjectId,
            workspaceId: workspaceObjectId,
            role: Role.OWNER,
          },
          { session },
        );

        if (result.deletedCount !== 1) {
          throw new BadRequestException({
            code: 'MEMBER_CHANGED',
            message: 'The member changed before this removal completed',
          });
        }
      });
    } finally {
      await session.endSession();
    }
  }
}
