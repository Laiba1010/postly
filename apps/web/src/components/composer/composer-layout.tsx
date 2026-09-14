"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { UseFormReturn } from "react-hook-form";
import { ArrowLeft, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import type { ComposerFormValues } from "@/lib/validations/composer";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { PlatformSelector } from "./platform-selector";
import { ContentEditor } from "./content-editor";
import { MediaUploader } from "./media-uploader";
import { PostPreview } from "./post-preview";
import type { Post } from "@/lib/api/posts";
import { useSocialConnections } from "@/lib/hooks/use-social-connections";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ComposerLayoutProps {
  workspaceId: string | null;
  canManage?: boolean;
  composer: {
    form: UseFormReturn<ComposerFormValues>;
    isLoadingDraft: boolean;
    existingDraft?: Post | null;
    save: (values: ComposerFormValues, onSaved?: (post: Post) => void) => void;
    isSaving: boolean;
    saveError: unknown;
  };
}

export function ComposerLayout({
  workspaceId,
  canManage = true,
  composer,
}: ComposerLayoutProps) {
  const { form, isLoadingDraft, save, isSaving, saveError } = composer;
  const postStatus = composer.existingDraft?.status;

  const isEditable =
    canManage && (!composer.existingDraft || postStatus === "DRAFT");
  const [savedMessage, setSavedMessage] = useState(false);
  const { data: connections, isLoading: isLoadingConnections } =
    useSocialConnections(workspaceId);

  // Unsaved changes browser prompt
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (form.formState.isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [form.formState.isDirty]);

  if (isLoadingDraft) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-5">
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // Safe fallback for destinations array
  const currentDestinations = form.watch("destinations") || [];

  // Identify active connections and flag disconnected targets
  const activeConnectionIds = new Set((connections ?? []).map((c) => c.id));
  const hasDisconnectedTarget =
    !isLoadingConnections &&
    connections !== undefined &&
    currentDestinations.some(
      (d) => !activeConnectionIds.has(d.socialConnectionId),
    );

  function handleSave(values: ComposerFormValues) {
    if (!isEditable) {
      return;
    }
    setSavedMessage(false);

    // Clean up destinations pointing to removed/disconnected accounts
    const cleanedValues = {
      ...values,
      destinations: (values.destinations || []).filter((d) =>
        activeConnectionIds.has(d.socialConnectionId),
      ),
    };

    save(cleanedValues, (updatedPost) => {
      // Reset form state with freshly saved values
      form.reset(cleanedValues);
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 3000);
    });
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/posts"
          className="inline-flex items-center justify-center rounded-md border p-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Back to posts"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {!composer.existingDraft
              ? "Create post"
              : isEditable
                ? "Edit post"
                : "View post"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEditable
              ? "Craft content, organize channels, and preview formatting prior to publishing."
              : `This ${postStatus?.toLowerCase()} post is read-only.`}
          </p>
        </div>
      </div>

      {/* Disconnected Accounts Banner */}
      {hasDisconnectedTarget && (
        <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            One or more target accounts were disconnected. Saving will
            automatically clean up those targets from this post.
          </span>
        </div>
      )}
      {!isEditable && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-700 dark:text-blue-400">
          This post is read-only because its status is{" "}
          <strong>{postStatus}</strong>.
        </div>
      )}

      {/* Primary Grid Layout */}
      <form
        onSubmit={form.handleSubmit(handleSave, () => {
          form.trigger();
        })}
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        {/* Left Column: Form Controls */}
        <div className="space-y-5">
          <div className={!isEditable ? "pointer-events-none opacity-70" : ""}>
            <PlatformSelector workspaceId={workspaceId} form={form} />
          </div>

          <div className={!isEditable ? "pointer-events-none opacity-70" : ""}>
            <ContentEditor form={form} />
          </div>

          <div className={!isEditable ? "pointer-events-none opacity-70" : ""}>
            <MediaUploader workspaceId={workspaceId} form={form} />
          </div>
        </div>

        {/* Right Column: Dynamic Preview Panel */}
        <div className="lg:sticky lg:top-6 lg:h-fit">
          <PostPreview workspaceId={workspaceId} form={form} />
        </div>

        {/* Feedback Messages */}
        {(saveError || savedMessage) && (
          <div className="col-span-full">
            {Boolean(saveError) && (
              <p className="text-sm font-medium text-destructive">
                {saveError instanceof ApiError
                  ? saveError.message
                  : saveError instanceof Error
                    ? saveError.message
                    : String(
                        saveError ??
                          "We couldn't save your draft. Please try again.",
                      )}
              </p>
            )}

            {savedMessage && (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Draft saved successfully.
              </p>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="col-span-full flex items-center justify-end gap-3 border-t pt-4">
          <Link
            href="/posts"
            className={cn(
              buttonVariants({ variant: "outline" }),
              isSaving && "pointer-events-none opacity-50",
            )}
          >
            Cancel
          </Link>

          {isEditable && (
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Saving...
                </>
              ) : (
                "Save draft"
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
