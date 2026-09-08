import { apiClient } from './client';

export type SocialProvider = 'INSTAGRAM' | 'FACEBOOK' | 'LINKEDIN' | 'X';
export type ConnectionStatus = 'ACTIVE';

export interface SocialConnection {
  id: string;
  provider: SocialProvider;
  accountId: string;
  accountName: string;
  status: ConnectionStatus;
  createdAt: string;
}

export interface MockAccount {
  accountId: string;
  accountName: string;
}

export interface OAuthStartResponse {
  state: string;
  provider: SocialProvider;
  displayName: string;
  mockAccounts: MockAccount[];
}

export function listSocialConnections(workspaceId: string) {
  return apiClient.get<{ connections: SocialConnection[] }>(
    `/api/workspaces/${workspaceId}/social-connections`,
  );
}

export function disconnectSocialConnection(workspaceId: string, connectionId: string) {
  return apiClient.delete<{ success: boolean }>(
    `/api/workspaces/${workspaceId}/social-connections/${connectionId}`,
  );
}

export function startOAuth(workspaceId: string, provider: SocialProvider) {
  return apiClient.post<OAuthStartResponse>(
    `/api/workspaces/${workspaceId}/social-connections/oauth/${provider}/start`,
  );
}

export function completeOAuth(input: { state: string; accountId?: string; cancelled?: boolean }) {
  return apiClient.post<{ cancelled: boolean; connection?: SocialConnection }>(
    `/api/oauth/callback`,
    input,
  );
}