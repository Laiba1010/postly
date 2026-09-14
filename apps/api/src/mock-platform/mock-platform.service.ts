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

@Injectable()
export class MockPlatformService {
  private readonly logger = new Logger(MockPlatformService.name);

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
  ) {}

  async publish(request: MockPublishRequest): Promise<MockPublishResult> {
    this.assertValidRequest(request);

    const cacheKey = this.buildCacheKey(
      request.idempotencyKey,
      request.attemptNumber,
    );

    /**
     * Redis is acting as a simulation of a platform-side idempotency
     * mechanism.
     *
     * The key is attempt scoped:
     *
     * postTargetId:attemptNumber
     */
    const cached = await this.readCachedResult(cacheKey);

    if (cached) {
      this.logger.log(
        `Idempotent replay ` +
          `postTargetId=${request.postTargetId} ` +
          `platform=${request.platform} ` +
          `attemptNumber=${request.attemptNumber} ` +
          `outcome=${cached.outcome}`,
      );

      return cached;
    }

    await this.simulateNetworkLatency();

    /**
     * The result is generated before the atomic NX write.
     *
     * Only one concurrent caller can claim the idempotency key.
     */
    const resolved = this.resolveScenario();

    const claimed = await this.claimCacheSlot(cacheKey, resolved);

    if (!claimed) {
      const winner = await this.readCachedResult(cacheKey);

      if (winner) {
        this.logger.log(
          `Idempotency race lost ` +
            `postTargetId=${request.postTargetId} ` +
            `attemptNumber=${request.attemptNumber} ` +
            `outcome=${winner.outcome}`,
        );

        return winner;
      }

      /**
       * If the winner disappeared between SET NX and GET, retry the
       * read once. We deliberately do not execute another external
       * operation because this method represents the platform boundary.
       */
      const secondRead = await this.readCachedResult(cacheKey);

      if (secondRead) {
        return secondRead;
      }

      throw new Error('MOCK_PLATFORM_IDEMPOTENCY_RESULT_UNAVAILABLE');
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

    if (!Number.isInteger(request.attemptNumber) || request.attemptNumber < 1) {
      throw new Error(
        'MockPlatformService.publish requires a positive integer attemptNumber',
      );
    }
  }

  private logResolution(
    request: MockPublishRequest,
    result: MockPublishResult,
  ): void {
    if (result.outcome === 'SUCCESS') {
      this.logger.log(
        `Publish resolved ` +
          `postTargetId=${request.postTargetId} ` +
          `platform=${request.platform} ` +
          `attemptNumber=${request.attemptNumber} ` +
          `outcome=SUCCESS`,
      );

      return;
    }

    this.logger.warn(
      `Publish resolved ` +
        `postTargetId=${request.postTargetId} ` +
        `platform=${request.platform} ` +
        `attemptNumber=${request.attemptNumber} ` +
        `outcome=FAILURE ` +
        `errorCode=${result.reason}`,
    );
  }

  private buildCacheKey(idempotencyKey: string, attemptNumber: number): string {
    return (
      `${MOCK_PLATFORM_IDEMPOTENCY_KEY_PREFIX}` +
      `${idempotencyKey}:${attemptNumber}`
    );
  }

  private async readCachedResult(
    cacheKey: string,
  ): Promise<MockPublishResult | null> {
    const raw = await this.redisClient.get(cacheKey);

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as MockPublishResult;

      if (!parsed || typeof parsed !== 'object' || !('outcome' in parsed)) {
        throw new Error('Invalid cached result shape');
      }

      return parsed;
    } catch (err) {
      this.logger.error(
        `Corrupted mock platform cache ` +
          `key=${cacheKey}: ` +
          `${this.getErrorMessage(err)}`,
      );

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

    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }

  private resolveScenario(): MockPublishResult {
    const totalWeight = MOCK_PLATFORM_SCENARIO_WEIGHTS.reduce(
      (sum, entry) => sum + entry.weight,
      0,
    );

    if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
      throw new Error('MOCK_PLATFORM_SCENARIO_WEIGHTS_INVALID');
    }

    let roll = Math.random() * totalWeight;

    for (const entry of MOCK_PLATFORM_SCENARIO_WEIGHTS) {
      roll -= entry.weight;

      if (roll <= 0) {
        return this.buildResult(entry.outcome);
      }
    }

    return {
      outcome: 'SUCCESS',
    };
  }

  private buildResult(
    outcome: 'SUCCESS' | PublishFailureReason,
  ): MockPublishResult {
    if (outcome === 'SUCCESS') {
      return {
        outcome: 'SUCCESS',
      };
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
          message: 'Platform rejected the attached media.',
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

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
