import { useQuery } from "@tanstack/react-query";
import { listSocialConnections } from "../api/social-connections";

export function useSocialConnections(workspaceId: string | null) {
  return useQuery({
    queryKey: ["social-connections", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { connections } = await listSocialConnections(workspaceId);
      return connections;
    },
    enabled: Boolean(workspaceId),
  });
}
