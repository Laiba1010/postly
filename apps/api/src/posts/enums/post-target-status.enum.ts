export enum PostTargetStatus {
  SCHEDULED = 'SCHEDULED',
  PUBLISHING = 'PUBLISHING',
  PUBLISHED = 'PUBLISHED',
  // Added in Phase 9: the mock platform can resolve a publish attempt as
  // a failure, and the target needs a terminal state to land in when it
  // does. Phase 10 owns deciding retryability and moving a target back
  // out of FAILED via a retry; Phase 9 only sets it.
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}
