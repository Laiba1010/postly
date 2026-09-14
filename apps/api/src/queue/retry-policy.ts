import { PublishFailureReason } from '../mock-platform/enums/publish-failure-reason.enum';

/** Maximum number of external publish executions for one target. */
export const MAX_PUBLISH_ATTEMPTS = 3;

/** Base automatic retry delay. */
export const RETRY_BACKOFF_BASE_MS = 1_000;

/** Exponential multiplier applied for each scheduled retry. */
export const RETRY_BACKOFF_MULTIPLIER = 2;

export function isRetryableFailure(reason: PublishFailureReason): boolean {
  switch (reason) {
    case PublishFailureReason.RATE_LIMITED:
    case PublishFailureReason.NETWORK_ERROR:
    case PublishFailureReason.PLATFORM_ERROR:
      return true;
    case PublishFailureReason.INVALID_MEDIA:
    case PublishFailureReason.AUTH_ERROR:
      return false;
    default:
      return false;
  }
}

/**
 * retryCount is the number of automatic retries already scheduled.
 * Therefore retryCount=0 produces the first retry delay.
 */
export function computeNextRetryDelayMs(retryCount: number): number {
  if (!Number.isInteger(retryCount) || retryCount < 0) {
    throw new Error('retryCount must be a non-negative integer');
  }

  return RETRY_BACKOFF_BASE_MS * Math.pow(RETRY_BACKOFF_MULTIPLIER, retryCount);
}
