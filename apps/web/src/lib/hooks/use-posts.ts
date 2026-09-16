import { useQuery } from "@tanstack/react-query";
import { listPosts, type ListPostsParams } from "../api/posts";

export function usePosts(
  workspaceId: string | null,
  params: ListPostsParams = {},
) {
  return useQuery({
    queryKey: ["posts", workspaceId, params],
    queryFn: () =>
      workspaceId
        ? listPosts(workspaceId, params)
        : Promise.resolve({
            posts: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
          }),
    enabled: Boolean(workspaceId),
    placeholderData: (previous) => previous,
    staleTime: 5_000,
  });
}
