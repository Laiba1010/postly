import {
  computeNextRetryDelayMs,
  isRetryableFailure,
  MAX_PUBLISH_ATTEMPTS,
} from '../retry-policy';

import { PublishFailureReason } from '../../mock-platform/enums/publish-failure-reason.enum';

describe('retry-policy', () => {
  describe('isRetryableFailure', () => {
    it('classifies transient platform failures as retryable', () => {
      expect(isRetryableFailure(PublishFailureReason.RATE_LIMITED)).toBe(true);

      expect(isRetryableFailure(PublishFailureReason.NETWORK_ERROR)).toBe(true);

      expect(isRetryableFailure(PublishFailureReason.PLATFORM_ERROR)).toBe(
        true,
      );
    });

    it('classifies permanent failures as non-retryable', () => {
      expect(isRetryableFailure(PublishFailureReason.INVALID_MEDIA)).toBe(
        false,
      );

      expect(isRetryableFailure(PublishFailureReason.AUTH_ERROR)).toBe(false);
    });
  });

  describe('computeNextRetryDelayMs', () => {
    it('uses exponential backoff', () => {
      expect(computeNextRetryDelayMs(0)).toBe(1_000);

      expect(computeNextRetryDelayMs(1)).toBe(2_000);

      expect(computeNextRetryDelayMs(2)).toBe(4_000);
    });

    it('rejects negative retry counts', () => {
      expect(() => computeNextRetryDelayMs(-1)).toThrow(
        'retryCount must be a non-negative integer',
      );
    });

    it('rejects fractional retry counts', () => {
      expect(() => computeNextRetryDelayMs(1.5)).toThrow(
        'retryCount must be a non-negative integer',
      );
    });

    it('rejects non-finite retry counts', () => {
      expect(() => computeNextRetryDelayMs(Number.NaN)).toThrow();

      expect(() => computeNextRetryDelayMs(Number.POSITIVE_INFINITY)).toThrow();
    });

    it('defines the automatic attempt ceiling', () => {
      expect(MAX_PUBLISH_ATTEMPTS).toBe(3);
    });
  });
});
