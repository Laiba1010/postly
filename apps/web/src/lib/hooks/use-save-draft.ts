import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDraft, updateDraft, type SaveDraftInput } from '../api/posts';

export function useSaveDraft(workspaceId: string | null, postId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveDraftInput) => {
      if (postId) {
        return updateDraft(workspaceId!, postId, input);
      }
      return createDraft(workspaceId!, input);
    },
    onSuccess: ({ post }) => {
      queryClient.setQueryData(['post', workspaceId, post.id], post);
    },
  });
}