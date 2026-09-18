"use client";

import { useCancelSchedule } from "@/lib/hooks/use-schedule-post";
import { ApiError } from "@/lib/api/client";
import type { Post } from "@/lib/api/posts";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CancelScheduleDialogProps {
  workspaceId: string;
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CancelScheduleDialog({
  workspaceId,
  post,
  open,
  onOpenChange,
}: CancelScheduleDialogProps) {
  const mutation = useCancelSchedule(workspaceId);

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.code === "INVALID_STATE_TRANSITION"
        ? "This post is no longer scheduled. Refresh the page to see its current status."
        : "Unable to cancel this schedule. Please try again."
      : mutation.isError
        ? "Something went wrong. Please try again."
        : null;

  function handleConfirm() {
    mutation.mutate(post.id, {
      onSuccess: () => onOpenChange(false),
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this schedule?</AlertDialogTitle>
          <AlertDialogDescription>
            Any scheduled or retrying targets will be cancelled. A target that
            is already publishing may continue to finish. This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Keep schedule
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Cancelling..." : "Cancel schedule"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
