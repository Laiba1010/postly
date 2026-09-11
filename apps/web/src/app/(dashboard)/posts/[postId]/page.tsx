"use client";

import { useParams } from "next/navigation";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useComposer } from "@/lib/hooks/use-composer";
import { ComposerLayout } from "@/components/composer/composer-layout";

export default function EditPostPage() {
  const params = useParams<{ postId: string }>();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const composer = useComposer(activeWorkspaceId, params.postId);

  return <ComposerLayout workspaceId={activeWorkspaceId} composer={composer} />;
}
