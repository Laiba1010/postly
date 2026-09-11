"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Trash2,
  CalendarClock,
  CalendarCog,
  XCircle,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useWorkspaceContext } from "@/lib/hooks/use-workspace-context";
import { usePosts } from "@/lib/hooks/use-posts";
import { deleteDraft, type Post } from "@/lib/api/posts";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { ScheduleDialog } from "@/components/posts/schedule-dialog";
import { CancelScheduleDialog } from "@/components/posts/cancel-schedule-dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  PUBLISHING: "Publishing",
  PARTIALLY_PUBLISHED: "Partially published",
  PUBLISHED: "Published",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const STATUS_VARIANTS: Record<
  string,
  "secondary" | "default" | "destructive" | "outline"
> = {
  DRAFT: "secondary",
  SCHEDULED: "outline",
  PUBLISHING: "default",
  PARTIALLY_PUBLISHED: "default",
  PUBLISHED: "default",
  FAILED: "destructive",
  CANCELLED: "outline",
};

function contentPreview(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "Untitled draft";
  return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
}

function formatScheduledAt(
  iso: string | null,
  timezone: string | null,
): string | null {
  if (!iso) return null;

  const date = new Date(iso);

  const formatted = date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone ?? undefined,
  });

  return timezone ? `${formatted} (${timezone})` : formatted;
}

export default function PostsPage() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const { data: workspace } = useWorkspaceContext(activeWorkspaceId);
  const queryClient = useQueryClient();

  const {
    data: posts,
    isLoading,
    isError,
    refetch,
  } = usePosts(activeWorkspaceId);

  const canManage = workspace?.role === "OWNER" || workspace?.role === "EDITOR";

  const [scheduleTarget, setScheduleTarget] = useState<{
    post: Post;
    mode: "schedule" | "reschedule";
  } | null>(null);

  const [cancelTarget, setCancelTarget] = useState<Post | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => {
      if (!activeWorkspaceId) {
        throw new Error("No active workspace selected");
      }
      return deleteDraft(activeWorkspaceId, postId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["posts", activeWorkspaceId],
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Posts</h1>
          <p className="text-sm text-muted-foreground">
            Manage drafts, scheduled posts, and publishing activity for this
            workspace.
          </p>
        </div>

        {canManage && (
          <Link
            href="/posts/new"
            className={cn(buttonVariants({ variant: "default" }))}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create post
          </Link>
        )}
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border py-16 text-center">
          <p className="text-sm font-medium text-destructive">
            Unable to load posts
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : posts && posts.length > 0 ? (
        <div className="space-y-2">
          {posts.map((post) => {
            const scheduledLabel = formatScheduledAt(
              post.scheduledAt,
              post.timezone,
            );

            return (
              <div
                key={post.id}
                className="group flex items-center justify-between rounded-lg border bg-card px-4 py-3 transition-colors hover:border-border/80 hover:bg-accent/50"
              >
                <Link
                  href={`/posts/${post.id}`}
                  className="min-w-0 flex-1 pr-4"
                >
                  <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                    {contentPreview(post.content)}
                  </p>

                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {scheduledLabel ? (
                      <span>Scheduled for {scheduledLabel}</span>
                    ) : (
                      <span>
                        Updated{" "}
                        {new Date(post.updatedAt).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </span>
                    )}

                    {post.destinations && post.destinations.length > 0 && (
                      <>
                        <span>•</span>
                        <span>
                          {post.destinations.length} channel
                          {post.destinations.length > 1 ? "s" : ""}
                        </span>
                      </>
                    )}
                  </div>
                </Link>

                <div className="flex shrink-0 items-center gap-3">
                  <Badge
                    variant={STATUS_VARIANTS[post.status] || "secondary"}
                    className="capitalize"
                  >
                    {STATUS_LABELS[post.status] || post.status}
                  </Badge>

                  {canManage && post.status === "DRAFT" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setScheduleTarget({
                          post,
                          mode: "schedule",
                        })
                      }
                    >
                      <CalendarClock
                        className="mr-1.5 h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      Schedule
                    </Button>
                  )}

                  {canManage && post.status === "SCHEDULED" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setScheduleTarget({
                            post,
                            mode: "reschedule",
                          })
                        }
                      >
                        <CalendarCog
                          className="mr-1.5 h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        Reschedule
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setCancelTarget(post)}
                      >
                        <XCircle
                          className="mr-1.5 h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        Cancel
                      </Button>
                    </>
                  )}

                  {post.status === "DRAFT" && (
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={(props) => (
                          <Button
                            {...props}
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Delete draft"
                            onClick={(e) => {
                              // Retain trigger behavior while stopping event bubbling to parent row
                              props.onClick?.(e);
                              e.stopPropagation();
                            }}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                      />

                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete this draft?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone and will permanently
                            remove this draft.
                          </AlertDialogDescription>
                        </AlertDialogHeader>

                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(post.id)}
                            disabled={deleteMutation.isPending}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deleteMutation.isPending
                              ? "Deleting..."
                              : "Delete"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-20 text-center">
          <div className="rounded-full bg-muted p-3">
            <FileText
              className="h-6 w-6 text-muted-foreground"
              aria-hidden="true"
            />
          </div>

          <div className="max-w-xs space-y-1">
            <p className="text-sm font-medium">No posts yet</p>
            <p className="text-xs text-muted-foreground">
              Create your first post draft to start scheduling and publishing
              across platforms.
            </p>
          </div>

          {canManage && (
            <Link
              href="/posts/new"
              className={cn(buttonVariants({ variant: "default" }), "mt-2")}
            >
              Create post
            </Link>
          )}
        </div>
      )}

      {activeWorkspaceId && scheduleTarget && (
        <ScheduleDialog
          workspaceId={activeWorkspaceId}
          post={scheduleTarget.post}
          mode={scheduleTarget.mode}
          open={!!scheduleTarget}
          onOpenChange={(open) => {
            if (!open) {
              setScheduleTarget(null);
            }
          }}
        />
      )}

      {activeWorkspaceId && cancelTarget && (
        <CancelScheduleDialog
          workspaceId={activeWorkspaceId}
          post={cancelTarget}
          open={!!cancelTarget}
          onOpenChange={(open) => {
            if (!open) {
              setCancelTarget(null);
            }
          }}
        />
      )}
    </div>
  );
}
