import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { randomBytes, createHash } from 'crypto';
import { Invitation, InvitationDocument } from './schemas/invitation.schema';
import {
  Membership,
  MembershipDocument,
} from '../memberships/schemas/membership.schema';
import {
  Workspace,
  WorkspaceDocument,
} from '../workspaces/schemas/workspace.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/enums/role.enum';

export interface InvitationSummary {
  id: string;
  workspaceId: string;
  workspaceName?: string;
  email: string;
  role: Role;
  expiresAt: Date;
  invitedByName?: string;
}

const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

@Injectable()
export class InvitationsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Invitation.name)
    private readonly invitationModel: Model<InvitationDocument>,
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<MembershipDocument>,
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<WorkspaceDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async createInvitation(
    workspaceId: string,
    invitedByUserId: string,
    email: string,
    role: Role,
  ): Promise<{ invitation: InvitationSummary; rawToken: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await this.userModel
      .findOne({ email: normalizedEmail })
      .exec();
    if (existingUser) {
      const alreadyMember = await this.membershipModel.exists({
        workspaceId: new Types.ObjectId(workspaceId),
        userId: existingUser._id,
      });
      if (alreadyMember) {
        throw new ConflictException({
          code: 'ALREADY_MEMBER',
          message: 'This person is already a member of the workspace',
        });
      }
    }

    const existingPending = await this.invitationModel.exists({
      workspaceId: new Types.ObjectId(workspaceId),
      email: normalizedEmail,
      acceptedAt: null,
      revokedAt: null,
    });
    if (existingPending) {
      throw new ConflictException({
        code: 'DUPLICATE_INVITATION',
        message: 'An invitation has already been sent to this email',
      });
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const invitation = await this.invitationModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      email: normalizedEmail,
      role,
      tokenHash,
      expiresAt,
      invitedBy: new Types.ObjectId(invitedByUserId),
    });

    const workspace = await this.workspaceModel.findById(workspaceId).exec();
    const inviteLink = `http://localhost:3000/invitations/${rawToken}`;

    // TODO: replace with real email sending (out of MVP scope per spec).
    console.log(
      `[DEV ONLY] Invitation link for ${normalizedEmail}: ${inviteLink}`,
    );

    return {
      invitation: {
        id: invitation._id.toString(),
        workspaceId,
        workspaceName: workspace?.name,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
      rawToken,
    };
  }

  async listPendingForWorkspace(
    workspaceId: string,
  ): Promise<InvitationSummary[]> {
    const invitations = await this.invitationModel
      .find({
        workspaceId: new Types.ObjectId(workspaceId),
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 })
      .exec();

    return invitations.map((inv) => ({
      id: inv._id.toString(),
      workspaceId: inv.workspaceId.toString(),
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt,
    }));
  }

  async revokeInvitation(
    workspaceId: string,
    invitationId: string,
  ): Promise<void> {
    const result = await this.invitationModel.updateOne(
      {
        _id: invitationId,
        workspaceId: new Types.ObjectId(workspaceId),
        acceptedAt: null,
      },
      { revokedAt: new Date() },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException({
        code: 'INVITATION_NOT_FOUND',
        message: 'Invitation not found',
      });
    }
  }

  /**
   * Preview an invitation by its raw token, without requiring authentication.
   * Used by the acceptance page to show "You're invited to join X as Y"
   * before the user has necessarily logged in.
   */
  async previewByToken(rawToken: string): Promise<InvitationSummary> {
    const tokenHash = this.hashToken(rawToken);
    const invitation = await this.invitationModel.findOne({ tokenHash }).exec();

    if (!invitation || invitation.revokedAt || invitation.acceptedAt) {
      throw new NotFoundException({
        code: 'INVITATION_NOT_FOUND',
        message: 'This invitation is no longer valid',
      });
    }
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'INVITATION_EXPIRED',
        message: 'This invitation has expired',
      });
    }

    const workspace = await this.workspaceModel
      .findById(invitation.workspaceId)
      .exec();

    return {
      id: invitation._id.toString(),
      workspaceId: invitation.workspaceId.toString(),
      workspaceName: workspace?.name,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    };
  }

  async acceptInvitation(
    rawToken: string,
    authenticatedUserId: string,
    authenticatedEmail: string,
  ): Promise<void> {
    const tokenHash = this.hashToken(rawToken);

    const invitation = await this.invitationModel.findOne({ tokenHash }).exec();

    if (!invitation || invitation.revokedAt) {
      throw new NotFoundException({
        code: 'INVITATION_NOT_FOUND',
        message: 'This invitation is no longer valid',
      });
    }
    if (invitation.acceptedAt) {
      throw new BadRequestException({
        code: 'INVITATION_ALREADY_ACCEPTED',
        message: 'This invitation has already been accepted',
      });
    }
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'INVITATION_EXPIRED',
        message: 'This invitation has expired',
      });
    }

    // Critical security rule: the authenticated account must match
    // the invited email exactly. Prevents a forwarded link from being
    // claimed by an unintended account.
    if (invitation.email !== authenticatedEmail.toLowerCase().trim()) {
      throw new ForbiddenException({
        code: 'INVITATION_EMAIL_MISMATCH',
        message: 'This invitation was sent to a different email address',
      });
    }

    const alreadyMember = await this.membershipModel.exists({
      workspaceId: invitation.workspaceId,
      userId: new Types.ObjectId(authenticatedUserId),
    });
    if (alreadyMember) {
      // Idempotent: mark accepted and return success rather than erroring,
      // per spec Rule 6 (existing member handling).
      invitation.acceptedAt = new Date();
      await invitation.save();
      return;
    }

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        await this.membershipModel.create(
          [
            {
              userId: new Types.ObjectId(authenticatedUserId),
              workspaceId: invitation.workspaceId,
              role: invitation.role,
            },
          ],
          { session },
        );

        invitation.acceptedAt = new Date();
        await invitation.save({ session });
      });
    } finally {
      await session.endSession();
    }
  }
}
