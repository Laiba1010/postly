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
