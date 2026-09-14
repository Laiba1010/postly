import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

export interface SessionData {
  userId: string;
  createdAt: string;
  lastUsedAt: string;
  version: number;
}

@Injectable()
export class SessionsService {
  private readonly ttlSeconds = 60 * 60 * 24 * 7;

  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private key(hashedToken: string): string {
    return `session:${hashedToken}`;
  }

  private versionKey(userId: string): string {
    return `session-version:${userId}`;
  }

  async createSession(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = this.hashToken(rawToken);
    const now = new Date().toISOString();
    const versionKey = this.versionKey(userId);

    /**
     * Session creation and password-reset invalidation share the same Redis
     * version key. WATCH makes the version read + session write atomic with
     * respect to INCR on that key, so a reset cannot race with a new session
     * and leave the new session carrying a stale version.
     */
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await this.redisClient.watch(versionKey);

      try {
        const versionRaw = await this.redisClient.get(versionKey);
        const parsedVersion = versionRaw ? Number.parseInt(versionRaw, 10) : 0;
        const version = Number.isFinite(parsedVersion) ? parsedVersion : 0;

        const data: SessionData = {
          userId,
          createdAt: now,
          lastUsedAt: now,
          version,
        };

        const result = await this.redisClient
          .multi()
          .set(
            this.key(hashedToken),
            JSON.stringify(data),
            'EX',
            this.ttlSeconds,
          )
          .exec();

        if (result !== null) {
          return rawToken;
        }
      } finally {
        await this.redisClient.unwatch();
      }
    }

    throw new Error('SESSION_CREATION_CONFLICT');
  }

  async getSession(rawToken: string): Promise<SessionData | null> {
    const hashedToken = this.hashToken(rawToken);
    const raw = await this.redisClient.get(this.key(hashedToken));
    if (!raw) return null;

    let data: SessionData;
    try {
      data = JSON.parse(raw) as SessionData;
    } catch {
      await this.redisClient.del(this.key(hashedToken));
      return null;
    }

    const currentVersionRaw = await this.redisClient.get(
      this.versionKey(data.userId),
    );
    const currentVersion = currentVersionRaw
      ? Number.parseInt(currentVersionRaw, 10)
      : 0;

    if ((data.version ?? 0) !== currentVersion) {
      await this.redisClient.del(this.key(hashedToken));
      return null;
    }

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

  async invalidateUserSessions(userId: string): Promise<void> {
    await this.redisClient.incr(this.versionKey(userId));
  }

  getFingerprint(rawToken: string): string {
    return this.hashToken(rawToken);
  }
}
