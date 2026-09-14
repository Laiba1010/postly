"use client";

import { useParams } from "next/navigation";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useComposer } from "@/lib/hooks/use-composer";
import { useWorkspaceContext } from "@/lib/hooks/use-workspace-context";
import { ComposerLayout } from "@/components/composer/composer-layout";
import { PostPublishingStatus } from "@/components/posts/post-publishing-status";
import { Skeleton } from "@/components/ui/skeleton";

export default function PostDetailPage() {
  const params = useParams<{ postId: string }>();
  const activeWorkspaceId = useWorkspaceStore(
    (state) => state.activeWorkspaceId,
  );
  const {
    data: workspace,
    isLoading: workspaceLoading,
    isError: workspaceError,
  } = useWorkspaceContext(activeWorkspaceId);
  const composer = useComposer(activeWorkspaceId, params.postId);

  const canManage = workspace?.role === "OWNER" || workspace?.role === "EDITOR";

  if (workspaceLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading post">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (workspaceError || !workspace || !activeWorkspaceId) {
    return (
      <div className="rounded-xl border p-8 text-center" role="alert">
        <h1 className="text-lg font-semibold">Unable to open this post</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You may no longer have access to this workspace.
        </p>
      </div>
    );
  }

  const showPublishingStatus = Boolean(
    composer.existingDraft && composer.existingDraft.status !== "DRAFT",
  );

  return (
    <div className="space-y-6">
      {showPublishingStatus && (
        <PostPublishingStatus
          workspaceId={activeWorkspaceId}
          postId={params.postId}
        />
      )}
      <ComposerLayout
        workspaceId={activeWorkspaceId}
        canManage={canManage}
        composer={composer}
      />
      {!canManage && (
        <p className="sr-only">
          This post is read-only for your workspace role.
        </p>
      )}
    </div>
  );
}
