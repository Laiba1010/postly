import { useQuery } from "@tanstack/react-query";
import { listWorkspaces } from "../api/workspaces";

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const { workspaces } = await listWorkspaces();
      return workspaces;
    },
  });
}
