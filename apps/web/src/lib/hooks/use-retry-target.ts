import { useMutation, useQueryClient } from "@tanstack/react-query";
import { retryTarget } from "../api/posts";
export function useRetryTarget(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      targetId,
    }: {
      postId: string;
      targetId: string;
    }) => {
      if (!workspaceId) throw new Error("No active workspace selected");
      return retryTarget(workspaceId, postId, targetId);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["posts", workspaceId] });
      queryClient.invalidateQueries({
        queryKey: ["post-status", workspaceId, vars.postId],
      });
    },
  });
}
