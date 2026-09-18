import { useQuery } from "@tanstack/react-query";
import { listPosts, type ListPostsParams } from "../api/posts";

const ACTIVE_TARGET_STATUSES = new Set(["PUBLISHING", "RETRYING"]);

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
    refetchInterval: (query) => {
      // Never create an endless retry loop when the list endpoint itself is
      // failing. The user gets an explicit Try again action instead.
      if (query.state.status === "error") return false;

      const data = query.state.data;
      if (!data) return false;

      const hasActivePublishing = data.posts.some((post) =>
        post.targets.some((target) =>
          ACTIVE_TARGET_STATUSES.has(target.status),
        ),
      );

      return hasActivePublishing ? 8_000 : false;
    },
    refetchIntervalInBackground: false,
  });
}
