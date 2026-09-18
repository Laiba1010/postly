import { useMutation } from "@tanstack/react-query";
import { retryTarget } from "../api/posts";

export function useRetryTarget(workspaceId: string | null) {
  return useMutation({
    mutationFn: ({
      postId,
      targetId,
    }: {
      postId: string;
      targetId: string;
    }) => {
      if (!workspaceId) {
        throw new Error("No active workspace selected");
      }

      return retryTarget(workspaceId, postId, targetId);
    },
  });
}
