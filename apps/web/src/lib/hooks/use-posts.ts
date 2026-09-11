import { useQuery } from "@tanstack/react-query";
import { listDrafts } from "../api/posts";

export function usePosts(workspaceId: string | null) {
  return useQuery({
    queryKey: ["posts", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { posts } = await listDrafts(workspaceId);
      return posts;
    },
    enabled: Boolean(workspaceId),
  });
}
