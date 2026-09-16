import { useMutation, useQueryClient } from "@tanstack/react-query";
import { duplicateDraft } from "../api/posts";
export function useDuplicatePost(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => {
      if (!workspaceId) throw new Error("No active workspace selected");
      return duplicateDraft(workspaceId, postId);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["posts", workspaceId] }),
  });
}
