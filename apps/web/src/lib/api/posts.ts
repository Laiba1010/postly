import { apiClient } from "./client";
import type { SocialProvider } from "./social-connections";

export type PostStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PARTIALLY_PUBLISHED"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELLED";

export type PostTargetStatus =
  | "SCHEDULED"
  | "PUBLISHING"
  | "RETRYING"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELLED";

export type PublishingAttemptStatus = "PUBLISHING" | "SUCCESS" | "FAILED";

export interface PostDestination {
  provider: SocialProvider;
  socialConnectionId: string;
  accountName: string;
}

export interface Post {
  id: string;
  content: string;
  status: PostStatus;
  destinations: PostDestination[];
  mediaIds: string[];
  scheduledAt: string | null;
  timezone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostTarget {
  id: string;
  platform: SocialProvider;
  socialConnectionId: string;
  status: PostTargetStatus;
  scheduledAt: string;
  retryCount?: number;
  nextRetryAt?: string | null;
  externalPostId?: string | null;
}

export interface PublishingAttempt {
  number: number;
  status: PublishingAttemptStatus;
  startedAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface PostStatusTarget {
  id: string;
  platform: SocialProvider;
  socialConnectionId: string;
  accountName: string;
  status: PostTargetStatus;
  scheduledAt: string;
  externalPostId: string | null;
  attempt: PublishingAttempt | null;
  retry: {
    count: number;
    maxAttempts: number;
    nextRetryAt: string | null;
  };
}

export interface PostStatusResponse {
  postId: string;
  status: PostStatus;
  updatedAt: string;
  targets: PostStatusTarget[];
}

export interface SaveDraftInput {
  content?: string;
  destinations?: {
    provider: SocialProvider;
    socialConnectionId: string;
  }[];
  mediaIds?: string[];
}

export interface ScheduleInput {
  date: string;
  time: string;
  timezone: string;
}

export function createDraft(workspaceId: string, input: SaveDraftInput) {
  return apiClient.post<{ post: Post }>(
    `/api/workspaces/${workspaceId}/posts`,
    input,
  );
}

export function getDraft(workspaceId: string, postId: string) {
  return apiClient.get<{ post: Post }>(
    `/api/workspaces/${workspaceId}/posts/${postId}`,
  );
}

export function updateDraft(
  workspaceId: string,
  postId: string,
  input: SaveDraftInput,
) {
  return apiClient.patch<{ post: Post }>(
    `/api/workspaces/${workspaceId}/posts/${postId}`,
    input,
  );
}

export function listDrafts(workspaceId: string) {
  return apiClient.get<{ posts: Post[] }>(
    `/api/workspaces/${workspaceId}/posts`,
  );
}

export function deleteDraft(workspaceId: string, postId: string) {
  return apiClient.delete<{ success: boolean }>(
    `/api/workspaces/${workspaceId}/posts/${postId}`,
  );
}

export function schedulePost(
  workspaceId: string,
  postId: string,
  input: ScheduleInput,
) {
  return apiClient.post<{ post: Post }>(
    `/api/workspaces/${workspaceId}/posts/${postId}/schedule`,
    input,
  );
}

export function reschedulePost(
  workspaceId: string,
  postId: string,
  input: ScheduleInput,
) {
  return apiClient.patch<{ post: Post }>(
    `/api/workspaces/${workspaceId}/posts/${postId}/schedule`,
    input,
  );
}

export function cancelSchedule(workspaceId: string, postId: string) {
  return apiClient.post<{ post: Post }>(
    `/api/workspaces/${workspaceId}/posts/${postId}/cancel`,
  );
}

export function listPostTargets(workspaceId: string, postId: string) {
  return apiClient.get<{ targets: PostTarget[] }>(
    `/api/workspaces/${workspaceId}/posts/${postId}/targets`,
  );
}


export function getPostStatus(workspaceId: string, postId: string) {
  return apiClient.get<PostStatusResponse>(
    `/api/workspaces/${workspaceId}/posts/${postId}/status`,
  );
}
