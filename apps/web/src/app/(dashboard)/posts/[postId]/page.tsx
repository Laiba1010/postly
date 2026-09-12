"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useComposer } from "@/lib/hooks/use-composer";
import { useWorkspaceContext } from "@/lib/hooks/use-workspace-context";
import { ComposerLayout } from "@/components/composer/composer-layout";

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams<{ postId: string }>();

  const activeWorkspaceId = useWorkspaceStore(
    (state) => state.activeWorkspaceId,
  );

  const { data: workspace, isLoading } = useWorkspaceContext(activeWorkspaceId);

  const canManage = workspace?.role === "OWNER" || workspace?.role === "EDITOR";

  const composer = useComposer(activeWorkspaceId, params.postId);

  useEffect(() => {
    if (!isLoading && workspace && !canManage) {
      router.replace("/posts");
    }
  }, [isLoading, workspace, canManage, router]);

  if (isLoading || !workspace || !canManage) {
    return null;
  }

  return <ComposerLayout workspaceId={activeWorkspaceId} composer={composer} />;
}
