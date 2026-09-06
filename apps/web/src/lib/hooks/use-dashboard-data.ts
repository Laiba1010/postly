import { useQuery } from "@tanstack/react-query";
import { getDashboardData } from "../mock/dashboard";

export function useDashboardData(workspaceId: string | null) {
  return useQuery({
    queryKey: ["dashboard", workspaceId],
    queryFn: () => getDashboardData(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}
