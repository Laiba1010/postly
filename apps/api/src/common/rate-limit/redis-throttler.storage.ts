import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {}

  async increment(key: string, ttl: number): Promise<ThrottlerStorageRecord> {
    const counterKey = `throttle:${key}`;

    const totalHits = await this.redis.incr(counterKey);

    if (totalHits === 1) {
      await this.redis.pexpire(counterKey, ttl);
    }

    let timeToExpire = await this.redis.pttl(counterKey);

    if (timeToExpire < 0) {
      timeToExpire = ttl;
    }

    return {
      totalHits,
      timeToExpire: Math.max(0, Math.ceil(timeToExpire / 1000)),
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}
