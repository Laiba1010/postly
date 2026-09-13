import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../redis/redis.module';
import { PublishFailureReason } from './enums/publish-failure-reason.enum';
import {
  MOCK_PLATFORM_IDEMPOTENCY_KEY_PREFIX,
  MOCK_PLATFORM_IDEMPOTENCY_TTL_MS,
  MOCK_PLATFORM_MAX_LATENCY_MS,
  MOCK_PLATFORM_MIN_LATENCY_MS,
  MOCK_PLATFORM_RATE_LIMIT_RETRY_AFTER_MS,
  MOCK_PLATFORM_SCENARIO_WEIGHTS,
} from './mock-platform.constants';
import { MockPublishRequest, MockPublishResult } from './mock-platform.types';

/**
 * Simulates an external social platform's publish endpoint.
 *
 * Scope boundary (Phase 9): this service resolves and returns the
 * immediate outcome of a single publish call — success or one of five
 * failure categories — and guarantees that outcome is idempotent per
 * postTargetId. It does not classify errors as retryable/permanent,
 * schedule retries, compute backoff, or persist anything itself. Those
 * are Phase 10 responsibilities; the caller (PublishWorker) owns
 * persisting whatever this service returns.
 */
@Injectable()
export class MockPlatformService {
  private readonly logger = new Logger(MockPlatformService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  async publish(request: MockPublishRequest): Promise<MockPublishResult> {
    this.assertValidRequest(request);

    const cacheKey = this.buildCacheKey(
      request.idempotencyKey,
      request.attemptNumber,
    );

    const cached = await this.readCachedResult(cacheKey);

    if (cached) {
      this.logger.log(
        `Idempotent replay postTargetId=${request.postTargetId} platform=${request.platform} outcome=${cached.outcome}`,
      );

      return cached;
    }

    await this.simulateNetworkLatency();

    const resolved = this.resolveScenario();

    const claimed = await this.claimCacheSlot(cacheKey, resolved);

    if (!claimed) {
      // Another concurrent call for the same idempotency key won the
      // race between our cache-miss read and our write. A real platform
      // would return that caller's original response rather than
      // executing the publish twice — replay it instead of our own.
      const winner = await this.readCachedResult(cacheKey);

      if (winner) {
        this.logger.log(
          `Idempotency race lost postTargetId=${request.postTargetId} platform=${request.platform}, replaying winner outcome=${winner.outcome}`,
        );

        return winner;
      }

      // Extremely unlikely: the winning entry expired between our failed
      // claim and this read. Fall back to our own freshly-resolved
      // result rather than leaving the caller without one.
    }

    this.logResolution(request, resolved);

    return resolved;
  }

  private assertValidRequest(request: MockPublishRequest): void {
    if (!request.idempotencyKey?.trim()) {
      throw new Error(
        'MockPlatformService.publish requires a non-empty idempotencyKey',
      );
    }

    if (!request.postTargetId?.trim()) {
      throw new Error(
        'MockPlatformService.publish requires a non-empty postTargetId',
      );
    }

    if (!request.platform) {
      throw new Error('MockPlatformService.publish requires a platform');
    }
  }

  private logResolution(
    request: MockPublishRequest,
    result: MockPublishResult,
  ): void {
    if (result.outcome === 'SUCCESS') {
      this.logger.log(
        `Publish resolved postTargetId=${request.postTargetId} platform=${request.platform} outcome=SUCCESS`,
      );
      return;
    }

    this.logger.warn(
      `Publish resolved postTargetId=${request.postTargetId} platform=${request.platform} outcome=FAILURE errorCode=${result.reason}`,
    );
  }

  private buildCacheKey(idempotencyKey: string, attemptNumber: number): string {
    return `${MOCK_PLATFORM_IDEMPOTENCY_KEY_PREFIX}${idempotencyKey}:${attemptNumber}`;
  }
  private async readCachedResult(
    cacheKey: string,
  ): Promise<MockPublishResult | null> {
    const raw = await this.redisClient.get(cacheKey);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as MockPublishResult;
    } catch (err) {
      this.logger.error(
        `Corrupted mock-platform cache entry key=${cacheKey}, deleting so idempotency can recover: ${
          (err as Error).message
        }`,
      );

      // Actively remove it rather than leaving a poisoned key that
      // permanently blocks NX claims for the rest of its TTL.
      await this.redisClient.del(cacheKey);

      return null;
    }
  }

  private async claimCacheSlot(
    cacheKey: string,
    result: MockPublishResult,
  ): Promise<boolean> {
    const reply = await this.redisClient.set(
      cacheKey,
      JSON.stringify(result),
      'PX',
      MOCK_PLATFORM_IDEMPOTENCY_TTL_MS,
      'NX',
    );

    return reply === 'OK';
  }

  private async simulateNetworkLatency(): Promise<void> {
    const spread = MOCK_PLATFORM_MAX_LATENCY_MS - MOCK_PLATFORM_MIN_LATENCY_MS;
    const delay = MOCK_PLATFORM_MIN_LATENCY_MS + Math.random() * spread;

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private resolveScenario(): MockPublishResult {
    const totalWeight = MOCK_PLATFORM_SCENARIO_WEIGHTS.reduce(
      (sum, entry) => sum + entry.weight,
      0,
    );

    let roll = Math.random() * totalWeight;

    for (const entry of MOCK_PLATFORM_SCENARIO_WEIGHTS) {
      roll -= entry.weight;

      if (roll <= 0) {
        return this.buildResult(entry.outcome);
      }
    }

    // Floating-point fallback: in practice the loop above always returns
    // before this line, but a scenario must never go unresolved.
    return { outcome: 'SUCCESS' };
  }

  private buildResult(
    outcome: 'SUCCESS' | PublishFailureReason,
  ): MockPublishResult {
    if (outcome === 'SUCCESS') {
      return { outcome: 'SUCCESS' };
    }

    switch (outcome) {
      case PublishFailureReason.RATE_LIMITED:
        return {
          outcome: 'FAILURE',
          reason: PublishFailureReason.RATE_LIMITED,
          message: 'Platform rate limit exceeded for this account.',
          retryAfterMs: MOCK_PLATFORM_RATE_LIMIT_RETRY_AFTER_MS,
        };

      case PublishFailureReason.NETWORK_ERROR:
        return {
          outcome: 'FAILURE',
          reason: PublishFailureReason.NETWORK_ERROR,
          message: 'Request to the platform timed out with no response.',
        };

      case PublishFailureReason.PLATFORM_ERROR:
        return {
          outcome: 'FAILURE',
          reason: PublishFailureReason.PLATFORM_ERROR,
          message: 'Platform returned an internal server error.',
        };

      case PublishFailureReason.INVALID_MEDIA:
        return {
          outcome: 'FAILURE',
          reason: PublishFailureReason.INVALID_MEDIA,
          message:
            'Platform rejected the attached media (unsupported format or corrupt file).',
        };

      case PublishFailureReason.AUTH_ERROR:
        return {
          outcome: 'FAILURE',
          reason: PublishFailureReason.AUTH_ERROR,
          message:
            'Platform rejected the request due to an invalid or expired access token.',
        };

      default: {
        const exhaustiveCheck: never = outcome;
        throw new Error(
          `Unhandled mock platform outcome: ${String(exhaustiveCheck)}`,
        );
      }
    }
  }
}
