import { apiClient } from "./client";
import type { Member } from "./members";

export interface Invitation {
  id: string;
  workspaceId: string;
  workspaceName?: string;
  email: string;
  role: Member["role"];
  expiresAt: string;
}

export function createInvitation(
  workspaceId: string,
  input: { email: string; role: Member["role"] },
) {
  return apiClient.post<{ invitation: Invitation }>(
    `/api/workspaces/${workspaceId}/invitations`,
    input,
  );
}

export function listPendingInvitations(workspaceId: string) {
  return apiClient.get<{ invitations: Invitation[] }>(
    `/api/workspaces/${workspaceId}/invitations`,
  );
}

export function previewInvitation(token: string) {
  return apiClient.get<{ invitation: Invitation }>(
    `/api/invitations/${token}/preview`,
  );
}

export function acceptInvitation(token: string) {
  return apiClient.post<{ success: boolean }>(
    `/api/invitations/${token}/accept`,
  );
}
