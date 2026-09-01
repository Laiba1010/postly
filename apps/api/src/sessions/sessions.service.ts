import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

export interface SessionData {
  userId: string;
  createdAt: string;
  lastUsedAt: string;
}

@Injectable()
export class SessionsService {
  private readonly ttlSeconds: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    private readonly configService: ConfigService,
  ) {
    // 7 days, reasonable default for a B2B SaaS session
    this.ttlSeconds = 60 * 60 * 24 * 7;
  }

  private key(sessionId: string): string {
    return `session:${sessionId}`;
  }

  async createSession(userId: string): Promise<string> {
    const sessionId = randomUUID();
    const now = new Date().toISOString();

    const data: SessionData = {
      userId,
      createdAt: now,
      lastUsedAt: now,
    };

    await this.redisClient.set(
      this.key(sessionId),
      JSON.stringify(data),
      'EX',
      this.ttlSeconds,
    );

    return sessionId;
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const raw = await this.redisClient.get(this.key(sessionId));
    if (!raw) {
      return null;
    }

    const data: SessionData = JSON.parse(raw);

    // Sliding expiry: touch lastUsedAt and refresh TTL on access
    data.lastUsedAt = new Date().toISOString();
    await this.redisClient.set(
      this.key(sessionId),
      JSON.stringify(data),
      'EX',
      this.ttlSeconds,
    );

    return data;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.redisClient.del(this.key(sessionId));
  }
}
