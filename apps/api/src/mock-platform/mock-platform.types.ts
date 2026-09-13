import { SocialProvider } from '../social-connections/enums/provider.enum';
import { PublishFailureReason } from './enums/publish-failure-reason.enum';

/**
 * Everything the mock platform needs to resolve (or replay) a publish
 * attempt. workspaceId/postId are carried through purely for structured
 * logging — they do not affect which scenario is resolved.
 */
export interface MockPublishRequest {
  readonly idempotencyKey: string; // still postTargetId, kept for logging/back-compat
  readonly attemptNumber: number;
  readonly postTargetId: string;
  readonly postId: string;
  readonly workspaceId: string;
  readonly platform: SocialProvider;
}

export interface MockPublishSuccess {
  readonly outcome: 'SUCCESS';
}

export interface MockPublishFailure {
  readonly outcome: 'FAILURE';
  readonly reason: PublishFailureReason;
  readonly message: string;
  /**
   * Only ever populated for RATE_LIMITED, mirroring a real platform's
   * Retry-After style hint. Informational only in Phase 9 — nothing reads
   * or acts on it until Phase 10's retry/backoff logic exists.
   */
  readonly retryAfterMs?: number;
}

export type MockPublishResult = MockPublishSuccess | MockPublishFailure;

export function isMockPublishFailure(
  result: MockPublishResult,
): result is MockPublishFailure {
  return result.outcome === 'FAILURE';
}
