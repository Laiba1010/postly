import { useQuery } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { getPostStatus, type PostStatusResponse } from "../api/posts";

const POLL_INTERVAL_MS = 5_000;

const ACTIVE_TARGET_STATUSES = new Set(["PUBLISHING", "RETRYING"]);

function shouldPoll(
  data: PostStatusResponse | undefined,
  isError: boolean,
): boolean {
  if (isError || !data) {
    return false;
  }

  return data.targets.some((target) =>
    ACTIVE_TARGET_STATUSES.has(target.status),
  );
}

export function usePostStatus(
  workspaceId: string | null,
  postId: string | null,
) {
  return useQuery({
    queryKey: ["post-status", workspaceId, postId],

    queryFn: async () => {
      if (!workspaceId || !postId) {
        throw new Error("A workspace and post are required");
      }

      return getPostStatus(workspaceId, postId);
    },

    enabled: Boolean(workspaceId && postId),

    retry: (failureCount, error) => {
      if (
        error instanceof ApiError &&
        [401, 403, 404].includes(error.statusCode)
      ) {
        return false;
      }

      return failureCount < 2;
    },

    refetchInterval: (query) =>
      shouldPoll(query.state.data, query.state.error !== null)
        ? POLL_INTERVAL_MS
        : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}
