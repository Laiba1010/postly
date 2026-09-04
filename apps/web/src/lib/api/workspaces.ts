import { apiClient } from "./client";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
}

export function createWorkspace(input: { name: string }) {
  return apiClient.post<{ workspace: Workspace }>("/api/workspaces", input);
}

export function listWorkspaces() {
  return apiClient.get<{ workspaces: Workspace[] }>("/api/workspaces");
}
export function getWorkspace(workspaceId: string) {
  return apiClient.get<{ workspace: Workspace }>(
    `/api/workspaces/${workspaceId}`,
  );
}
export function updateWorkspace(workspaceId: string, input: { name: string }) {
  return apiClient.patch<{ workspace: Workspace }>(
    `/api/workspaces/${workspaceId}`,
    input,
  );
}
