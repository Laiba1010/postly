import { Injectable, Inject } from '@nestjs/common';
import { HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  async checkMongo(): Promise<HealthIndicatorResult> {
    const isConnected = this.mongoConnection.readyState === 1;
    if (isConnected) {
      return { mongodb: { status: 'up' } };
    }
    throw new HealthCheckError('MongoDB check failed', {
      mongodb: { status: 'down' },
    });
  }

  async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.redisClient.ping();
      if (pong === 'PONG') {
        return { redis: { status: 'up' } };
      }
      throw new Error('Unexpected ping response');
    } catch (err) {
      throw new HealthCheckError('Redis check failed', {
        redis: { status: 'down', message: (err as Error).message },
      });
    }
  }
}
