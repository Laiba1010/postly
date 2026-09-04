import { useQuery } from "@tanstack/react-query";
import { listMembers } from "../api/members";

export function useMembers(workspaceId: string | null) {
  return useQuery({
    queryKey: ["members", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { members } = await listMembers(workspaceId);
      return members;
    },
    enabled: Boolean(workspaceId),
  });
}
