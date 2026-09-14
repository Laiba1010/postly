import { RedisThrottlerStorage } from './redis-throttler.storage';

describe('RedisThrottlerStorage', () => {
  it('increments a distributed counter and applies the first-hit TTL', async () => {
    const redis = {
      incr: jest.fn().mockResolvedValue(1),
      pexpire: jest.fn().mockResolvedValue(1),
      pttl: jest.fn().mockResolvedValue(59_500),
    } as any;

    const storage = new RedisThrottlerStorage(redis);

    const result = await storage.increment('key', 60_000);

    expect(redis.incr).toHaveBeenCalledWith('throttle:key');

    expect(redis.pexpire).toHaveBeenCalledWith('throttle:key', 60_000);

    expect(redis.pttl).toHaveBeenCalledWith('throttle:key');

    expect(result).toEqual({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('does not reset the TTL after the first hit', async () => {
    const redis = {
      incr: jest.fn().mockResolvedValue(2),
      pexpire: jest.fn().mockResolvedValue(1),
      pttl: jest.fn().mockResolvedValue(30_000),
    } as any;

    const storage = new RedisThrottlerStorage(redis);

    const result = await storage.increment('key', 60_000);

    expect(redis.incr).toHaveBeenCalledWith('throttle:key');

    expect(redis.pexpire).not.toHaveBeenCalled();

    expect(result).toEqual({
      totalHits: 2,
      timeToExpire: 30,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('falls back to the configured TTL when Redis reports no expiry', async () => {
    const redis = {
      incr: jest.fn().mockResolvedValue(2),
      pexpire: jest.fn(),
      pttl: jest.fn().mockResolvedValue(-1),
    } as any;

    const storage = new RedisThrottlerStorage(redis);

    const result = await storage.increment('key', 60_000);

    expect(result).toEqual({
      totalHits: 2,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });
});
