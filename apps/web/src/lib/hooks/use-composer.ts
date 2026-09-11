import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import {
  composerSchema,
  type ComposerFormValues,
} from "../validations/composer";
import { useSaveDraft } from "./use-save-draft";
import { useDraft } from "./use-draft";
import type { Post } from "../api/posts";

export function useComposer(workspaceId: string | null, postId: string | null) {
  const router = useRouter();
  const { data: existingDraft, isLoading: draftLoading } = useDraft(
    workspaceId,
    postId,
  );
  const saveMutation = useSaveDraft(workspaceId, postId);
  const initialLoadedRef = useRef(false);

  const form = useForm<ComposerFormValues>({
    resolver: zodResolver(composerSchema),
    defaultValues: { content: "", destinations: [], mediaIds: [] },
  });

  // Reset form when workspace ID changes to prevent cross-workspace payload leakage
  useEffect(() => {
    form.reset({ content: "", destinations: [], mediaIds: [] });
    initialLoadedRef.current = false;
  }, [workspaceId, form]);

  // Populate form only on initial draft load (prevents overwriting user typing during route transition)
  useEffect(() => {
    if (existingDraft && !initialLoadedRef.current) {
      form.reset({
        content: existingDraft.content,
        destinations: existingDraft.destinations.map((d) => ({
          provider: d.provider,
          socialConnectionId: d.socialConnectionId,
        })),
        mediaIds: existingDraft.mediaIds,
      });
      initialLoadedRef.current = true;
    }
  }, [existingDraft, form]);

  function save(values: ComposerFormValues, onSaved?: (post: Post) => void) {
    saveMutation.mutate(values, {
      onSuccess: ({ post }) => {
        onSaved?.(post);
        if (!postId) {
          router.replace(`/posts/${post.id}`);
        }
      },
    });
  }

  return {
    form,
    existingDraft,
    isLoadingDraft: draftLoading,
    save,
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error,
  };
}
