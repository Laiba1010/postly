import { PostStatus } from '../enums/post-status.enum';
import { PostTargetStatus } from '../enums/post-target-status.enum';
import { PublishingAttemptStatus } from '../enums/publishing-attempt-status.enum';

export interface PostStatusAttemptResponse {
  number: number;
  status: PublishingAttemptStatus;
  startedAt: Date;
  completedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface PostStatusRetryResponse {
  count: number;
  maxAttempts: number;
  nextRetryAt: Date | null;
}

export interface PostStatusTargetResponse {
  id: string;
  platform: string;
  socialConnectionId: string;
  accountName: string;
  status: PostTargetStatus;
  scheduledAt: Date;
  externalPostId: string | null;
  attempt: PostStatusAttemptResponse | null;
  retry: PostStatusRetryResponse;
}

export interface PostStatusResponse {
  postId: string;
  status: PostStatus;
  updatedAt: Date;
  targets: PostStatusTargetResponse[];
}
