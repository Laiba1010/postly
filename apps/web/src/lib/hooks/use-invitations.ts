import { useQuery } from "@tanstack/react-query";
import { listPendingInvitations } from "../api/invitations";

export function usePendingInvitations(workspaceId: string | null) {
  return useQuery({
    queryKey: ["invitations", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { invitations } = await listPendingInvitations(workspaceId);
      return invitations;
    },
    enabled: Boolean(workspaceId),
  });
}
