import { apiClient } from "./client";
import type { Role } from "./workspaces";

export interface Member {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
}

export function listMembers(workspaceId: string) {
  return apiClient.get<{ members: Member[] }>(
    `/api/workspaces/${workspaceId}/members`,
  );
}

export function updateMemberRole(
  workspaceId: string,
  membershipId: string,
  role: Member["role"],
) {
  return apiClient.patch<{ member: Member }>(
    `/api/workspaces/${workspaceId}/members/${membershipId}`,
    { role },
  );
}

export function removeMember(workspaceId: string, membershipId: string) {
  return apiClient.delete<{ success: boolean }>(
    `/api/workspaces/${workspaceId}/members/${membershipId}`,
  );
}
