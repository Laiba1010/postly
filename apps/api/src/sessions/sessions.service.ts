import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

export interface SessionData {
  userId: string;
  createdAt: string;
  lastUsedAt: string;
}

@Injectable()
export class SessionsService {
  private readonly ttlSeconds = 60 * 60 * 24 * 7; // 7 days

  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private key(hashedToken: string): string {
    return `session:${hashedToken}`;
  }

  /**
   * Creates a session and returns the RAW token to send to the browser.
   * Only the HASH is ever persisted.
   */
  async createSession(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = this.hashToken(rawToken);
    const now = new Date().toISOString();

    const data: SessionData = { userId, createdAt: now, lastUsedAt: now };

    await this.redisClient.set(
      this.key(hashedToken),
      JSON.stringify(data),
      'EX',
      this.ttlSeconds,
    );

    return rawToken;
  }

  /**
   * Accepts the RAW token from the cookie, hashes it, and looks up the session.
   */
  async getSession(rawToken: string): Promise<SessionData | null> {
    const hashedToken = this.hashToken(rawToken);
    const raw = await this.redisClient.get(this.key(hashedToken));
    if (!raw) return null;

    const data: SessionData = JSON.parse(raw);
    data.lastUsedAt = new Date().toISOString();

    await this.redisClient.set(
      this.key(hashedToken),
      JSON.stringify(data),
      'EX',
      this.ttlSeconds,
    );

    return data;
  }

  async deleteSession(rawToken: string): Promise<void> {
    const hashedToken = this.hashToken(rawToken);
    await this.redisClient.del(this.key(hashedToken));
  }
}
