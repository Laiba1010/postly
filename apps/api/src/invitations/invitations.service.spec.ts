import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { Role } from '../common/enums/role.enum';

describe('InvitationsService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const userId = '507f191e810c19729de860ea';

  function createSession() {
    return {
      withTransaction: async (callback: () => Promise<void>) => callback(),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('accepts a valid invitation and creates the membership atomically', async () => {
    const session = createSession();

    const invitation = {
      _id: { toString: () => '507f1f77bcf86cd799439012' },
      workspaceId,
      email: 'member@example.com',
      role: Role.EDITOR,
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      revokedAt: null,
    };

    const invitationModel = {
      findOne: jest.fn(() => ({
        session: jest.fn(() => ({
          exec: jest.fn().mockResolvedValue(invitation),
        })),
      })),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    const membershipModel = {
      findOne: jest.fn(() => ({
        session: jest.fn(() => ({
          lean: jest.fn(() => ({
            exec: jest.fn().mockResolvedValue(null),
          })),
        })),
      })),
      create: jest.fn().mockResolvedValue([]),
    };

    const service = new InvitationsService(
      { startSession: jest.fn().mockResolvedValue(session) } as any,
      invitationModel as any,
      membershipModel as any,
      {} as any,
      {} as any,
      { get: jest.fn() } as any,
    );

    await expect(
      service.acceptInvitation('raw-token', userId, invitation.email),
    ).resolves.toBeUndefined();

    expect(invitationModel.updateOne).toHaveBeenCalled();

    expect(membershipModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          userId: expect.anything(),
          workspaceId: invitation.workspaceId,
          role: Role.EDITOR,
        }),
      ],
      { session },
    );
  });

  it('rejects a concurrent acceptance after another request claims the token', async () => {
    const session = createSession();

    const invitation = {
      _id: { toString: () => '507f1f77bcf86cd799439012' },
      workspaceId,
      email: 'member@example.com',
      role: Role.VIEWER,
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      revokedAt: null,
    };

    const invitationModel = {
      findOne: jest.fn(() => ({
        session: jest.fn(() => ({
          exec: jest.fn().mockResolvedValue(invitation),
        })),
      })),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    };

    const membershipModel = {
      findOne: jest.fn(() => ({
        session: jest.fn(() => ({
          lean: jest.fn(() => ({
            exec: jest.fn().mockResolvedValue(null),
          })),
        })),
      })),
    };

    const service = new InvitationsService(
      { startSession: jest.fn().mockResolvedValue(session) } as any,
      invitationModel as any,
      membershipModel as any,
      {} as any,
      {} as any,
      { get: jest.fn() } as any,
    );

    await expect(
      service.acceptInvitation('raw-token', userId, invitation.email),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'INVITATION_ALREADY_ACCEPTED',
      }),
    });
  });

  it('rejects an invitation token that has already been accepted', async () => {
    const session = createSession();

    const invitation = {
      _id: { toString: () => '507f1f77bcf86cd799439012' },
      workspaceId,
      email: 'member@example.com',
      role: Role.EDITOR,
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: new Date(Date.now() - 60_000),
      revokedAt: null,
    };

    const invitationModel = {
      findOne: jest.fn(() => ({
        session: jest.fn(() => ({
          exec: jest.fn().mockResolvedValue(invitation),
        })),
      })),
    };

    const service = new InvitationsService(
      { startSession: jest.fn().mockResolvedValue(session) } as any,
      invitationModel as any,
      {} as any,
      {} as any,
      {} as any,
      { get: jest.fn() } as any,
    );

    await expect(
      service.acceptInvitation('raw-token', userId, invitation.email),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'INVITATION_ALREADY_ACCEPTED',
      }),
    });

    expect(invitationModel.findOne).toHaveBeenCalled();
  });

  it('rejects an invalid workspace ID when listing invitations', async () => {
    const service = new InvitationsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.listPendingForWorkspace('not-an-id'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid invitation ID when revoking', async () => {
    const service = new InvitationsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.revokeInvitation(workspaceId, 'not-an-id'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invitation when the authenticated email does not match', async () => {
    const session = createSession();

    const invitation = {
      _id: { toString: () => '507f1f77bcf86cd799439012' },
      workspaceId,
      email: 'invited@example.com',
      role: Role.VIEWER,
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      revokedAt: null,
    };

    const invitationModel = {
      findOne: jest.fn(() => ({
        session: jest.fn(() => ({
          exec: jest.fn().mockResolvedValue(invitation),
        })),
      })),
    };

    const service = new InvitationsService(
      { startSession: jest.fn().mockResolvedValue(session) } as any,
      invitationModel as any,
      {} as any,
      {} as any,
      {} as any,
      { get: jest.fn() } as any,
    );

    await expect(
      service.acceptInvitation('raw-token', userId, 'other@example.com'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an invalid invitation token', async () => {
    const session = createSession();

    const invitationModel = {
      findOne: jest.fn(() => ({
        session: jest.fn(() => ({
          exec: jest.fn().mockResolvedValue(null),
        })),
      })),
    };

    const membershipModel = {
      findOne: jest.fn(() => ({
        session: jest.fn(() => ({
          lean: jest.fn(() => ({
            exec: jest.fn().mockResolvedValue(null),
          })),
        })),
      })),
    };

    const service = new InvitationsService(
      { startSession: jest.fn().mockResolvedValue(session) } as any,
      invitationModel as any,
      membershipModel as any,
      {} as any,
      {} as any,
      { get: jest.fn() } as any,
    );

    await expect(
      service.acceptInvitation('raw-token', userId, 'member@example.com'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
