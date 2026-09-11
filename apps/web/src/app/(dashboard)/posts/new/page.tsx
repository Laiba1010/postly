"use client";

import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useComposer } from "@/lib/hooks/use-composer";
import { ComposerLayout } from "@/components/composer/composer-layout";
import { useWorkspaceContext } from "@/lib/hooks/use-workspace-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NewPostPage() {
  const router = useRouter();

  const activeWorkspaceId = useWorkspaceStore(
    (state) => state.activeWorkspaceId,
  );

  const { data: workspace, isLoading } = useWorkspaceContext(activeWorkspaceId);

  const canManage = workspace?.role === "OWNER" || workspace?.role === "EDITOR";

  const composer = useComposer(activeWorkspaceId, null);
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
