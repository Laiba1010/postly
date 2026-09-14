import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
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
import { ConfigService } from '@nestjs/config';

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
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Invitation.name)
    private readonly invitationModel: Model<InvitationDocument>,
    @InjectModel(Membership.name)
    private readonly membershipModel: Model<MembershipDocument>,
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<WorkspaceDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
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

    if (role === Role.OWNER) {
      throw new BadRequestException({
        code: 'OWNER_INVITATION_NOT_SUPPORTED',
        message: 'Ownership transfer is not supported in the MVP',
      });
    }

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

    let invitation: InvitationDocument;
    try {
      invitation = await this.invitationModel.create({
        workspaceId: new Types.ObjectId(workspaceId),
        email: normalizedEmail,
        role,
        tokenHash,
        expiresAt,
        invitedBy: new Types.ObjectId(invitedByUserId),
      });
    } catch (err: any) {
      // The partial unique index is the concurrency-safe source of truth.
      if (err?.code === 11000) {
        throw new ConflictException({
          code: 'DUPLICATE_INVITATION',
          message: 'An invitation has already been sent to this email',
        });
      }
      throw err;
    }

    const workspace = await this.workspaceModel.findById(workspaceId).exec();
    const inviteLink = `http://localhost:3000/invitations/${rawToken}`;

    // TODO: replace with real email sending (out of MVP scope per spec).
    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      this.logger.log(
        `[DEV ONLY] Invitation link for ${normalizedEmail}: ${inviteLink}`,
      );
    }

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
    const normalizedEmail = authenticatedEmail.toLowerCase().trim();
    const now = new Date();

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const invitation = await this.invitationModel
          .findOne({ tokenHash })
          .session(session)
          .exec();

        if (!invitation || invitation.revokedAt) {
          throw new NotFoundException({
            code: 'INVITATION_NOT_FOUND',
            message: 'This invitation is no longer valid',
          });
        }

        if (invitation.expiresAt < now) {
          throw new BadRequestException({
            code: 'INVITATION_EXPIRED',
            message: 'This invitation has expired',
          });
        }

        if (invitation.email !== normalizedEmail) {
          throw new ForbiddenException({
            code: 'INVITATION_EMAIL_MISMATCH',
            message: 'This invitation was sent to a different email address',
          });
        }

        if (invitation.acceptedAt) {
          const existingMember = await this.membershipModel
            .findOne({
              workspaceId: invitation.workspaceId,
              userId: new Types.ObjectId(authenticatedUserId),
            })
            .session(session)
            .lean()
            .exec();

          if (existingMember) return;

          throw new BadRequestException({
            code: 'INVITATION_ALREADY_ACCEPTED',
            message: 'This invitation has already been accepted',
          });
        }

        const existingMember = await this.membershipModel
          .findOne({
            workspaceId: invitation.workspaceId,
            userId: new Types.ObjectId(authenticatedUserId),
          })
          .session(session)
          .lean()
          .exec();

        if (existingMember) {
          const claimed = await this.invitationModel.updateOne(
            { _id: invitation._id, acceptedAt: null, revokedAt: null },
            { $set: { acceptedAt: now } },
            { session },
          );

          if (claimed.modifiedCount !== 1) {
            throw new BadRequestException({
              code: 'INVITATION_ALREADY_ACCEPTED',
              message: 'This invitation has already been accepted',
            });
          }
          return;
        }

        const claimed = await this.invitationModel.updateOne(
          {
            _id: invitation._id,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { $gt: now },
          },
          { $set: { acceptedAt: now } },
          { session },
        );

        if (claimed.modifiedCount !== 1) {
          throw new BadRequestException({
            code: 'INVITATION_ALREADY_ACCEPTED',
            message: 'This invitation has already been accepted',
          });
        }

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
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        // Membership uniqueness is the final concurrency guard. If the
        // membership now exists for this user, the invitation was effectively
        // accepted by the winning request.
        const invitation = await this.invitationModel
          .findOne({ tokenHash })
          .select('workspaceId acceptedAt')
          .lean()
          .exec();

        if (invitation?.acceptedAt) {
          const member = await this.membershipModel.exists({
            workspaceId: invitation.workspaceId,
            userId: new Types.ObjectId(authenticatedUserId),
          });
          if (member) return;
        }
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }
}
