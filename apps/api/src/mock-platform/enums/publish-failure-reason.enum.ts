/**
 * The set of failure modes the mock social platform can simulate.
 *
 * These mirror the categories a real platform publishing API realistically
 * returns. Phase 9 only needs to produce and log these; deciding which are
 * retryable, computing backoff, and persisting a structured error code on
 * the PublishingAttempt record are explicitly Phase 10 responsibilities.
 */
export enum PublishFailureReason {
  RATE_LIMITED = 'RATE_LIMITED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PLATFORM_ERROR = 'PLATFORM_ERROR',
  INVALID_MEDIA = 'INVALID_MEDIA',
  AUTH_ERROR = 'AUTH_ERROR',
}
