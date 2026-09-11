import { useQuery } from '@tanstack/react-query';
import { getDraft } from '../api/posts';

export function useDraft(workspaceId: string | null, postId: string | null) {
  return useQuery({
    queryKey: ['post', workspaceId, postId],
    queryFn: async () => {
      const { post } = await getDraft(workspaceId!, postId!);
      return post;
    },
    enabled: Boolean(workspaceId && postId),
  });
}