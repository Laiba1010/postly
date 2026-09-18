import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostStatus } from './enums/post-status.enum';
import { PostTargetStatus } from './enums/post-target-status.enum';
import { PublishingAttemptStatus } from './enums/publishing-attempt-status.enum';

function query<T>(value: T) {
  const q = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  };

  return q;
}

describe('PostsService.getPostStatus', () => {
  const postModel = { findOne: jest.fn() };
  const postTargetModel = { find: jest.fn() };
  const publishingAttemptModel = { find: jest.fn() };

  const service = new PostsService(
    {} as never,
    postModel as never,
    postTargetModel as never,
    publishingAttemptModel as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns aggregate, target, latest attempt, error, and retry information', async () => {
    const post = {
      _id: { toString: () => 'post-1' },
      status: PostStatus.PUBLISHING,
      updatedAt: new Date('2026-09-14T10:00:00.000Z'),
      destinations: [
        {
          socialConnectionId: { toString: () => 'connection-1' },
          accountName: 'Marketing',
        },
      ],
    };

    const target = {
      _id: { toString: () => 'target-1' },
      platform: 'INSTAGRAM',
      socialConnectionId: { toString: () => 'connection-1' },
      status: PostTargetStatus.RETRYING,
      scheduledAt: new Date('2026-09-14T09:00:00.000Z'),
      retryCount: 1,
      nextRetryAt: new Date('2026-09-14T10:00:05.000Z'),
      externalPostId: null,
    };

    const attempt = {
      postTargetId: { toString: () => 'target-1' },
      attemptNumber: 1,
      status: PublishingAttemptStatus.FAILED,
      startedAt: new Date('2026-09-14T09:00:00.000Z'),
      completedAt: new Date('2026-09-14T09:00:01.000Z'),
      errorCode: 'NETWORK_ERROR',
      errorMessage: 'Temporary network failure',
    };

    postModel.findOne.mockReturnValue(query(post));
    postTargetModel.find.mockReturnValue(query([target]));
    publishingAttemptModel.find.mockReturnValue(query([attempt]));

    const result = await service.getPostStatus(
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439012',
    );

    expect(result.postId).toBe('post-1');
    expect(result.status).toBe(PostStatus.PUBLISHING);
    expect(result.targets).toHaveLength(1);

    expect(result.targets[0]).toMatchObject({
      id: 'target-1',
      platform: 'INSTAGRAM',
      accountName: 'Marketing',
      status: PostTargetStatus.RETRYING,
      retry: {
        count: 1,
        maxAttempts: expect.any(Number),
        nextRetryAt: target.nextRetryAt,
      },
      attempt: {
        number: 1,
        status: PublishingAttemptStatus.FAILED,
        errorCode: 'NETWORK_ERROR',
        errorMessage: 'Temporary network failure',
      },
    });
  });

  it('returns null attempt for a target that has not published yet', async () => {
    const post = {
      _id: { toString: () => 'post-1' },
      status: PostStatus.SCHEDULED,
      updatedAt: new Date(),
      destinations: [],
    };

    const target = {
      _id: { toString: () => 'target-1' },
      platform: 'FACEBOOK',
      socialConnectionId: { toString: () => 'connection-1' },
      status: PostTargetStatus.SCHEDULED,
      scheduledAt: new Date(),
      retryCount: 0,
      nextRetryAt: null,
      externalPostId: null,
    };

    postModel.findOne.mockReturnValue(query(post));
    postTargetModel.find.mockReturnValue(query([target]));
    publishingAttemptModel.find.mockReturnValue(query([]));

    const result = await service.getPostStatus(
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439012',
    );

    expect(result.targets[0].attempt).toBeNull();
    expect(result.targets[0].retry.nextRetryAt).toBeNull();
  });

  it('does not return a post from another workspace', async () => {
    postModel.findOne.mockReturnValue(query(null));

    await expect(
      service.getPostStatus(
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(postTargetModel.find).not.toHaveBeenCalled();
    expect(publishingAttemptModel.find).not.toHaveBeenCalled();
  });

  it('rejects malformed IDs', async () => {
    await expect(
      service.getPostStatus('not-an-id', 'also-not-an-id'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(postModel.findOne).not.toHaveBeenCalled();
  });
});
