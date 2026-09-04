import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
  ) {}

  async listMembers(workspaceId: string): Promise<MemberSummary[]> {
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

  private async countOwners(workspaceId: string): Promise<number> {
    return this.membershipModel.countDocuments({
      workspaceId: new Types.ObjectId(workspaceId),
      role: Role.OWNER,
    });
  }

  async updateMemberRole(
    workspaceId: string,
    membershipId: string,
    newRole: Role,
    actingUserId: string,
  ): Promise<MemberSummary> {
    const membership = await this.membershipModel
      .findOne({
        _id: membershipId,
        workspaceId: new Types.ObjectId(workspaceId),
      })
      .populate<{ userId: User & { _id: Types.ObjectId } }>('userId')
      .exec();

    if (!membership) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Member not found in this workspace',
      });
    }

    const isSelf = membership.userId._id.toString() === actingUserId;
    const isCurrentlyOwner = membership.role === Role.OWNER;

    if (isSelf && isCurrentlyOwner && newRole !== Role.OWNER) {
      throw new BadRequestException({
        code: 'CANNOT_DEMOTE_OWNER',
        message: 'You cannot demote yourself as the workspace owner',
      });
    }

    if (isCurrentlyOwner && newRole !== Role.OWNER) {
      const ownerCount = await this.countOwners(workspaceId);
      if (ownerCount <= 1) {
        throw new BadRequestException({
          code: 'CANNOT_DEMOTE_OWNER',
          message: 'A workspace must always have at least one owner',
        });
      }
    }

    membership.role = newRole;
    await membership.save();

    return {
      membershipId: membership._id.toString(),
      userId: membership.userId._id.toString(),
      name: membership.userId.name,
      email: membership.userId.email,
      role: membership.role,
    };
  }

  async removeMember(
    workspaceId: string,
    membershipId: string,
    actingUserId: string,
  ): Promise<void> {
    const membership = await this.membershipModel
      .findOne({
        _id: membershipId,
        workspaceId: new Types.ObjectId(workspaceId),
      })
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
        code: 'CANNOT_REMOVE_OWNER',
        message: 'You cannot remove yourself from the workspace',
      });
    }

    if (membership.role === Role.OWNER) {
      const ownerCount = await this.countOwners(workspaceId);
      if (ownerCount <= 1) {
        throw new BadRequestException({
          code: 'CANNOT_REMOVE_OWNER',
          message: 'A workspace must always have at least one owner',
        });
      }
    }

    await membership.deleteOne();
  }
}
