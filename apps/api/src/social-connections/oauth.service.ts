import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { SocialProvider } from './enums/provider.enum';
import { ProviderRegistry } from './providers/provider.registry';
import { SocialConnectionsService, SocialConnectionSummary } from './social-connections.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { Role } from '../common/enums/role.enum';
import type { PublicUser } from '../auth/auth.service';
import { OAuthCallbackDto } from './dto/oauth-callback.dto';

interface OAuthStateData {
  userId: string;
  workspaceId: string;
  provider: SocialProvider;
  sessionFingerprint: string;
}

export interface OAuthStartResult {
  state: string;
  provider: SocialProvider;
  displayName: string;
  mockAccounts: { accountId: string; accountName: string }[];
}

export interface OAuthCallbackResult {
  cancelled: boolean;
  connection?: SocialConnectionSummary;
}

const STATE_TTL_SECONDS = 60 * 10; // 10 minutes
const ALLOWED_ROLES = [Role.OWNER, Role.EDITOR];

@Injectable()
export class OAuthService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    private readonly providerRegistry: ProviderRegistry,
    private readonly socialConnectionsService: SocialConnectionsService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  private key(state: string) {
    return `oauth-state:${state}`;
  }

  async startConnection(
    userId: string,
    workspaceId: string,
    provider: SocialProvider,
    sessionFingerprint: string,
  ): Promise<OAuthStartResult> {
    const adapter = this.providerRegistry.get(provider);

    const state = randomUUID();
    const data: OAuthStateData = { userId, workspaceId, provider, sessionFingerprint };
    await this.redisClient.set(this.key(state), JSON.stringify(data), 'EX', STATE_TTL_SECONDS);

    return {
      state,
      provider: adapter.provider,
      displayName: adapter.displayName,
      mockAccounts: adapter.getMockAccounts(),
    };
  }

  async completeConnection(
    dto: OAuthCallbackDto,
    currentUser: PublicUser,
    currentSessionFingerprint: string,
  ): Promise<OAuthCallbackResult> {
    const stateKey = this.key(dto.state);
    const raw = await this.redisClient.get(stateKey);

    if (!raw) {
      throw new BadRequestException({
        code: 'INVALID_OAUTH_STATE',
        message: 'This authorization request is invalid or has expired',
      });
    }

    // Single-use: delete immediately so the same state can never be replayed
    await this.redisClient.del(stateKey);

    const stateData: OAuthStateData = JSON.parse(raw);

    // This is the actual security boundary: the transaction must be completed
    // from the exact same authenticated session that started it, not merely
    // by the same user (who could have multiple concurrent sessions/tabs).
    if (stateData.sessionFingerprint !== currentSessionFingerprint) {
      throw new ForbiddenException({
        code: 'OAUTH_SESSION_MISMATCH',
        message: 'This authorization request belongs to a different session. Please restart the connection.',
      });
    }

    if (dto.cancelled) {
      return { cancelled: true };
    }

    // Re-verify role at completion time — it could have changed since start.
    // Workspace comes ONLY from this server-validated state, never from the client.
    const role = await this.workspacesService.verifyMembership(
      stateData.userId,
      stateData.workspaceId,
    );
    if (!role || !ALLOWED_ROLES.includes(role)) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_ROLE',
        message: 'You do not have permission to connect social accounts in this workspace',
      });
    }

    const adapter = this.providerRegistry.get(stateData.provider);
    const mockAccount = adapter.getMockAccounts().find((a) => a.accountId === dto.accountId);

    if (!mockAccount) {
      throw new BadRequestException({
        code: 'INVALID_MOCK_ACCOUNT',
        message: 'Selected account is not valid for this provider',
      });
    }

    const connection = await this.socialConnectionsService.createConnection({
      workspaceId: stateData.workspaceId,
      provider: stateData.provider,
      accountId: mockAccount.accountId,
      accountName: mockAccount.accountName,
    });

    return { cancelled: false, connection };
  }
}