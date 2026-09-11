import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  schedulePost,
  reschedulePost,
  cancelSchedule,
  type ScheduleInput,
} from "../api/posts";

export function useSchedulePost(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, input }: { postId: string; input: ScheduleInput }) =>
      schedulePost(workspaceId!, postId, input),
    onSuccess: ({ post }) => {
      queryClient.invalidateQueries({ queryKey: ["posts", workspaceId] });
      queryClient.setQueryData(["post", workspaceId, post.id], post);
    },
  });
}

export function useReschedulePost(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, input }: { postId: string; input: ScheduleInput }) =>
      reschedulePost(workspaceId!, postId, input),
    onSuccess: ({ post }) => {
      queryClient.invalidateQueries({ queryKey: ["posts", workspaceId] });
      queryClient.setQueryData(["post", workspaceId, post.id], post);
    },
  });
}

export function useCancelSchedule(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => cancelSchedule(workspaceId!, postId),
    onSuccess: ({ post }) => {
      queryClient.invalidateQueries({ queryKey: ["posts", workspaceId] });
      queryClient.setQueryData(["post", workspaceId, post.id], post);
    },
  });
}
