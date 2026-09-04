import { useQuery } from "@tanstack/react-query";
import { getWorkspace } from "../api/workspaces";

export function useWorkspaceContext(workspaceId: string | null) {
  return useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { workspace } = await getWorkspace(workspaceId);
      return workspace;
    },
    enabled: Boolean(workspaceId),
  });
}
