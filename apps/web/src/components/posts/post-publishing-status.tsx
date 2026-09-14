"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiError } from "@/lib/api/client";
import { usePostStatus } from "@/lib/hooks/use-post-status";
import { PostTargetStatusRow } from "./post-target-status-row";
import { PublishingStatusSkeleton } from "./publishing-status-skeleton";

interface PostPublishingStatusProps {
  workspaceId: string | null;
  postId: string;
}

export function PostPublishingStatus({
  workspaceId,
  postId,
}: PostPublishingStatusProps) {
  const query = usePostStatus(workspaceId, postId);

  if (query.isPending) return <PublishingStatusSkeleton />;

  if (query.isError && !query.data) {
    const message =
      query.error instanceof ApiError
        ? query.error.statusCode === 404
          ? "This post could not be found."
          : query.error.statusCode === 403
            ? "You no longer have access to this workspace."
            : query.error.message
        : "We couldn't load the publishing status.";

    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>Publishing status</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          {!(
            query.error instanceof ApiError &&
            [403, 404].includes(query.error.statusCode)
          ) && (
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const data = query.data;
  if (!data) return null;

  return (
    <Card aria-live="polite">
      <CardHeader>
        <CardTitle>Publishing status</CardTitle>
        <CardDescription>
          Overall status:{" "}
          <span className="font-medium text-foreground">
            {data.status.replaceAll("_", " ")}
          </span>
          {query.isFetching && (
            <span className="ml-2 text-xs">Refreshing…</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.targets.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            This post has no publishing targets.
          </div>
        ) : (
          <div className="space-y-3">
            {data.targets.map((target) => (
              <PostTargetStatusRow key={target.id} target={target} />
            ))}
          </div>
        )}
        {query.isError && query.data && (
          <p className="mt-3 text-xs text-muted-foreground" role="status">
            We couldn&apos;t refresh the latest status. Showing the last
            successful update.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
