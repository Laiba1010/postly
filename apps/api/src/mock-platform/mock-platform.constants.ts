import { PublishFailureReason } from './enums/publish-failure-reason.enum';

export const MOCK_PLATFORM_IDEMPOTENCY_KEY_PREFIX =
  'mock-platform:idempotency:';

/**
 * How long a resolved outcome stays cached against its idempotency key.
 * Mirrors the retention window a real platform API would apply to a
 * client-supplied idempotency key — long enough to cover any reasonable
 * replay (worker restart, reconciliation re-enqueue) without living
 * forever in Redis.
 */
export const MOCK_PLATFORM_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Simulated network latency band. A mock that resolves instantly every
 * time isn't a realistic stand-in for an external HTTP call.
 */
export const MOCK_PLATFORM_MIN_LATENCY_MS = 150;
export const MOCK_PLATFORM_MAX_LATENCY_MS = 900;

export const MOCK_PLATFORM_RATE_LIMIT_RETRY_AFTER_MS = 30_000;

export interface ScenarioWeight {
  readonly outcome: 'SUCCESS' | PublishFailureReason;
  readonly weight: number;
}

/**
 * Fixed distribution for Phase 9. Weights are relative (need not sum to
 * 100) and deliberately not environment-configurable — this is a demo
 * fixture, not a tunable production parameter.
 */
export const MOCK_PLATFORM_SCENARIO_WEIGHTS: readonly ScenarioWeight[] = [
  { outcome: 'SUCCESS', weight: 80 },
  { outcome: PublishFailureReason.RATE_LIMITED, weight: 6 },
  { outcome: PublishFailureReason.NETWORK_ERROR, weight: 5 },
  { outcome: PublishFailureReason.PLATFORM_ERROR, weight: 4 },
  { outcome: PublishFailureReason.INVALID_MEDIA, weight: 3 },
  { outcome: PublishFailureReason.AUTH_ERROR, weight: 2 },
];
