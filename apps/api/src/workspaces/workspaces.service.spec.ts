import { BadRequestException } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { Role } from '../common/enums/role.enum';

describe('WorkspacesService', () => {
  const userId = '507f1f77bcf86cd799439011';
  const workspaceId = '507f1f77bcf86cd799439012';

  function createSession() {
    return {
      withTransaction: async (callback: () => Promise<void>) => callback(),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('rejects an invalid user ID before creating a workspace', async () => {
    const workspaceModel = { create: jest.fn() };
    const service = new WorkspacesService(
      {} as any,
      workspaceModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.createWorkspace('invalid', 'Workspace'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(workspaceModel.create).not.toHaveBeenCalled();
  });

  it('retries workspace creation when the unique slug index loses a race', async () => {
    const sessionOne = createSession();
    const sessionTwo = createSession();

    const workspaceDocument = {
      _id: { toString: () => workspaceId },
      name: 'Workspace',
      slug: 'workspace-2',
    };

    const workspaceModel = {
      create: jest
        .fn()
        .mockRejectedValueOnce({ code: 11000 })
        .mockResolvedValueOnce([workspaceDocument]),
    };
    const membershipModel = {
      create: jest.fn().mockResolvedValue([]),
    };
    const connection = {
      startSession: jest
        .fn()
        .mockResolvedValueOnce(sessionOne)
        .mockResolvedValueOnce(sessionTwo),
    };

    const service = new WorkspacesService(
      connection as any,
      workspaceModel as any,
      membershipModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    jest
      .spyOn(service as any, 'generateUniqueSlug')
      .mockResolvedValueOnce('workspace')
      .mockResolvedValueOnce('workspace-2');

    await expect(service.createWorkspace(userId, 'Workspace')).resolves.toEqual(
      {
        id: workspaceId,
        name: 'Workspace',
        slug: 'workspace-2',
        role: Role.OWNER,
      },
    );

    expect(workspaceModel.create).toHaveBeenCalledTimes(2);
    expect(membershipModel.create).toHaveBeenCalledTimes(1);
    expect(sessionOne.endSession).toHaveBeenCalled();
    expect(sessionTwo.endSession).toHaveBeenCalled();
  });
});
