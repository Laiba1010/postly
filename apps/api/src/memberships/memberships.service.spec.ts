import { BadRequestException } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { MembershipsService } from './memberships.service';

function createSession() {
  return {
    withTransaction: async (callback: () => Promise<void>) => callback(),
    endSession: jest.fn().mockResolvedValue(undefined),
  };
}

describe('MembershipsService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const membershipId = '507f1f77bcf86cd799439012';

  it('does not allow ownership transfer through role updates', async () => {
    const service = new MembershipsService({} as any, {} as any);

    await expect(
      service.updateMemberRole(
        workspaceId,
        membershipId,
        Role.OWNER,
        '507f1f77bcf86cd799439013',
      ),
    ).rejects.toThrow('Ownership transfer is not supported in the MVP');
  });

  it('rejects invalid workspace IDs before querying MongoDB', async () => {
    const membershipModel = { find: jest.fn() };
    const service = new MembershipsService(membershipModel as any, {} as any);

    await expect(service.listMembers('invalid')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(membershipModel.find).not.toHaveBeenCalled();
  });

  it('rejects invalid membership IDs before querying MongoDB', async () => {
    const membershipModel = { findOne: jest.fn() };
    const service = new MembershipsService(membershipModel as any, {} as any);

    await expect(
      service.updateMemberRole(
        workspaceId,
        'invalid',
        Role.EDITOR,
        '507f1f77bcf86cd799439013',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(membershipModel.findOne).not.toHaveBeenCalled();
  });

  it('rejects removing an invalid membership ID before querying MongoDB', async () => {
    const membershipModel = { findOne: jest.fn() };
    const service = new MembershipsService(membershipModel as any, {} as any);

    await expect(
      service.removeMember(workspaceId, 'invalid', '507f1f77bcf86cd799439013'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(membershipModel.findOne).not.toHaveBeenCalled();
  });

  it('does not allow the sole owner to be removed', async () => {
    const owner = {
      userId: { toString: () => '507f1f77bcf86cd799439013' },
      role: Role.OWNER,
    };
    const membershipModel = {
      findOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(owner) })),
      countDocuments: jest.fn(() => ({
        session: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(1),
      })),
    };
    const session = createSession();

    const service = new MembershipsService(
      membershipModel as any,
      { startSession: jest.fn().mockResolvedValue(session) } as any,
    );

    await expect(
      service.removeMember(
        workspaceId,
        membershipId,
        '507f1f77bcf86cd799439014',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CANNOT_REMOVE_OWNER',
      }),
    });
  });
});
