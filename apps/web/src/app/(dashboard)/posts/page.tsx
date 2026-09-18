"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CalendarCog,
  Copy,
  FileText,
  MoreHorizontal,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useWorkspaceContext } from "@/lib/hooks/use-workspace-context";
import { usePosts } from "@/lib/hooks/use-posts";
import { deletePost, type Post, type PostStatus } from "@/lib/api/posts";
import { ApiError } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ScheduleDialog } from "@/components/posts/schedule-dialog";
import { CancelScheduleDialog } from "@/components/posts/cancel-schedule-dialog";
import { PostsStatusTabs } from "@/components/posts/posts-status-tabs";
import { PostsFilterBar } from "@/components/posts/posts-filter-bar";
import { PostsPagination } from "@/components/posts/posts-pagination";
import { PostRowStatus } from "@/components/posts/post-row-status";
import { RetryFailedDialog } from "@/components/posts/retry-failed-dialog";
import { useDuplicatePost } from "@/lib/hooks/use-duplicate-post";
import { readPostsUrlState, SORT_OPTIONS } from "@/lib/posts-url";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusLabels: Record<PostStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  PUBLISHING: "Publishing",
  PARTIALLY_PUBLISHED: "Partially published",
  PUBLISHED: "Published",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const statusVariants: Record<
  PostStatus,
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

function preview(content: string) {
  const value = content.trim();

  return value
    ? value.length > 100
      ? `${value.slice(0, 100)}…`
      : value
    : "Untitled draft";
}

function formatDate(iso: string | null, tz: string | null) {
  if (!iso) return null;

  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: tz ?? undefined,
    });
  } catch {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
}

export default function PostsPage() {
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  const { data: workspace } = useWorkspaceContext(workspaceId);

  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo(
    () => readPostsUrlState(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const sort = useMemo(
    () =>
      SORT_OPTIONS.find(
        (option) =>
          option.sortBy === state.sortBy && option.sortDir === state.sortDir,
      )?.value ?? "updatedAt:desc",
    [state.sortBy, state.sortDir],
  );

  const params = useMemo(
    () => ({
      status: state.status === "ALL" ? undefined : state.status,
      platform: state.platform || undefined,
      search: state.search || undefined,
      page: state.page,
      limit: 20,
      sortBy: state.sortBy,
      sortDir: state.sortDir,
      createdFrom: state.createdFrom || undefined,
      createdTo: state.createdTo || undefined,
    }),
    [state],
  );

  const query = usePosts(workspaceId, params);
  const duplicate = useDuplicatePost(workspaceId);

  const [scheduleTarget, setScheduleTarget] = useState<{
    post: Post;
    mode: "schedule" | "reschedule";
  } | null>(null);

  const [cancelTarget, setCancelTarget] = useState<Post | null>(null);

  const [retryPostId, setRetryPostId] = useState<string | null>(null);

  const canManage = workspace?.role === "OWNER" || workspace?.role === "EDITOR";

  const hasFilters =
    Boolean(state.search) ||
    Boolean(state.platform) ||
    Boolean(state.createdFrom) ||
    Boolean(state.createdTo) ||
    state.status !== "ALL";

  const navigate = useCallback(
    (changes: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(changes)) {
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
      }

      const url = next.toString() ? `${pathname}?${next.toString()}` : pathname;

      router.push(url);
    },
    [pathname, router, searchParams],
  );

  const resetPage = useCallback(
    (changes: Record<string, string | undefined>) =>
      navigate({
        ...changes,
        page: undefined,
      }),
    [navigate],
  );

  useEffect(() => {
    const pagination = query.data?.pagination;
    if (!pagination || query.isFetching) return;

    const lastPage = Math.max(1, pagination.totalPages);
    if (state.page > lastPage) {
      navigate({ page: String(lastPage) });
    }
  }, [navigate, query.data?.pagination, query.isFetching, state.page]);

  const deleteMutation = useMutation({
    mutationFn: (postId: string) =>
      workspaceId
        ? deletePost(workspaceId, postId)
        : Promise.reject(new Error("No active workspace selected")),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["posts", workspaceId],
      });
    },
  });

  const errorMessage = query.isError
    ? query.error instanceof ApiError
      ? query.error.message
      : "Unable to load posts. Please try again."
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Posts</h1>

          <p className="text-sm text-muted-foreground">
            Manage, search, and track all your content.
          </p>
        </div>

        {canManage && (
          <Link
            href="/posts/new"
            className={cn(
              buttonVariants({
                variant: "default",
              }),
            )}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create post
          </Link>
        )}
      </div>

      <PostsStatusTabs
        status={state.status === "ALL" ? undefined : state.status}
        onChange={(value) =>
          resetPage({
            status: value,
          })
        }
      />

      <PostsFilterBar
        search={state.search}
        platform={state.platform}
        sort={sort}
        onSearch={(value) =>
          resetPage({
            search: value || undefined,
          })
        }
        onPlatform={(value) =>
          resetPage({
            platform: value || undefined,
          })
        }
        onSort={(value) =>
          resetPage({
            sort: value === "updatedAt:desc" ? undefined : value,
          })
        }
        createdFrom={state.createdFrom}
        createdTo={state.createdTo}
        onDateRange={(createdFrom, createdTo) =>
          resetPage({
            createdFrom: createdFrom || undefined,
            createdTo: createdTo || undefined,
          })
        }
        onClear={() =>
          resetPage({
            search: undefined,
            platform: undefined,
            sort: undefined,
            status: undefined,
            createdFrom: undefined,
            createdTo: undefined,
          })
        }
      />

      {query.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border py-16 text-center">
          <p className="text-sm font-medium text-destructive">{errorMessage}</p>

          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : query.data?.posts.length ? (
        <div className="space-y-3">
          {query.data.posts.map((post) => {
            const scheduled = formatDate(post.scheduledAt, post.timezone);

            const failedTargets = post.targets.filter(
              (target) => target.status === "FAILED",
            );

            const hasPendingCancellationTarget = post.targets.some(
              (target) =>
                target.status === "SCHEDULED" || target.status === "RETRYING",
            );
            const canCancel =
              post.status === "SCHEDULED" ||
              (post.status === "PUBLISHING" && hasPendingCancellationTarget);
            return (
              <div
                key={post.id}
                className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/30"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <Link href={`/posts/${post.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {preview(post.content)}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <PostRowStatus post={post} />

                      {scheduled && <span>Scheduled {scheduled}</span>}
                      <span>Updated {formatDate(post.updatedAt, null)}</span>

                      <span>•</span>

                      <span>
                        {post.destinations.length} channel
                        {post.destinations.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </Link>

                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={statusVariants[post.status]}>
                      {statusLabels[post.status]}
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
                        <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                        Schedule
                      </Button>
                    )}

                    {canManage && post.status === "SCHEDULED" && (
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
                        <CalendarCog className="mr-1.5 h-3.5 w-3.5" />
                        Reschedule
                      </Button>
                    )}

                    {canManage && canCancel && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setCancelTarget(post)}
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    )}

                    {canManage &&
                      failedTargets.length > 0 &&
                      (post.status === "FAILED" ||
                        post.status === "PARTIALLY_PUBLISHED") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRetryPostId(post.id)}
                        >
                          Retry
                        </Button>
                      )}

                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Actions for ${preview(post.content)}`}
                            >
                              <MoreHorizontal />
                            </Button>
                          }
                        />

                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/posts/${post.id}`)}
                          >
                            Open
                          </DropdownMenuItem>

                          {canManage && (
                            <DropdownMenuItem
                              onClick={() => duplicate.mutate(post.id)}
                              disabled={duplicate.isPending}
                            >
                              <Copy />
                              Duplicate
                            </DropdownMenuItem>
                          )}

                          {canManage && post.status === "DRAFT" && (
                            <>
                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                onClick={() => router.push(`/posts/${post.id}`)}
                              >
                                Edit
                              </DropdownMenuItem>

                              <AlertDialog>
                                <AlertDialogTrigger
                                  render={
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={(event) =>
                                        event.preventDefault()
                                      }
                                    >
                                      <Trash2 />
                                      Delete
                                    </DropdownMenuItem>
                                  }
                                />

                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Delete this draft?
                                    </AlertDialogTitle>

                                    <AlertDialogDescription>
                                      This action cannot be undone and will
                                      permanently remove this post and its saved
                                      publishing data.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>

                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancel
                                    </AlertDialogCancel>

                                    <AlertDialogAction
                                      onClick={() =>
                                        deleteMutation.mutate(post.id)
                                      }
                                      disabled={deleteMutation.isPending}
                                    >
                                      Delete post
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}

                          {canManage && post.status === "CANCELLED" && (
                            <>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger
                                  render={
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={(event) =>
                                        event.preventDefault()
                                      }
                                    >
                                      <Trash2 />
                                      Delete
                                    </DropdownMenuItem>
                                  }
                                />
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Delete this cancelled post?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone and will
                                      permanently remove this post and its saved
                                      publishing data.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        deleteMutation.mutate(post.id)
                                      }
                                      disabled={deleteMutation.isPending}
                                    >
                                      Delete post
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-20 text-center">
          <div className="rounded-full bg-muted p-3">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>

          <div className="max-w-sm space-y-1">
            <p className="text-sm font-medium">
              {hasFilters ? "No posts found" : "No posts yet"}
            </p>

            <p className="text-xs text-muted-foreground">
              {hasFilters
                ? state.search
                  ? `No posts match “${state.search}”.`
                  : "No posts match your current filters."
                : "Create your first post and start planning your content."}
            </p>
          </div>

          {hasFilters ? (
            <Button
              variant="outline"
              onClick={() =>
                resetPage({
                  search: undefined,
                  platform: undefined,
                  status: undefined,
                  sort: undefined,
                  createdFrom: undefined,
                  createdTo: undefined,
                })
              }
            >
              Clear filters
            </Button>
          ) : (
            canManage && (
              <Link
                href="/posts/new"
                className={cn(
                  buttonVariants({
                    variant: "default",
                  }),
                )}
              >
                Create post
              </Link>
            )
          )}
        </div>
      )}

      {query.data?.pagination && (
        <PostsPagination
          {...query.data.pagination}
          onPage={(page) =>
            navigate({
              page: String(page),
            })
          }
        />
      )}

      {workspaceId && scheduleTarget && (
        <ScheduleDialog
          workspaceId={workspaceId}
          post={scheduleTarget.post}
          mode={scheduleTarget.mode}
          open
          onOpenChange={(open) => {
            if (!open) {
              setScheduleTarget(null);
            }
          }}
        />
      )}

      {workspaceId && cancelTarget && (
        <CancelScheduleDialog
          workspaceId={workspaceId}
          post={cancelTarget}
          open
          onOpenChange={(open) => {
            if (!open) {
              setCancelTarget(null);
            }
          }}
        />
      )}

      {workspaceId && retryPostId && (
        <RetryFailedDialog
          workspaceId={workspaceId}
          postId={retryPostId}
          open
          onOpenChange={(open) => {
            if (!open) {
              setRetryPostId(null);
            }
          }}
          onDone={() =>
            queryClient.invalidateQueries({
              queryKey: ["posts", workspaceId],
            })
          }
        />
      )}
    </div>
  );
}
