"use client";

import { useRef, useState, useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
  X,
  Upload,
  Loader2,
  AlertCircle,
  Video,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useMediaUpload } from "@/lib/hooks/use-media-upload";
import { deleteMedia, getMediaFileUrl } from "@/lib/api/media";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import type { ComposerFormValues } from "@/lib/validations/composer";

const MAX_MEDIA_COUNT = 4;
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

interface PendingUpload {
  tempId: string;
  file: File;
  previewUrl: string;
  isVideo: boolean;
  status: "uploading" | "error";
  errorMessage?: string;
}

interface MediaUploaderProps {
  workspaceId: string | null;
  form: UseFormReturn<ComposerFormValues>;
}

export function MediaUploader({ workspaceId, form }: MediaUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useMediaUpload(workspaceId);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const watchedMediaIds = form.watch("mediaIds");
  const mediaIds = watchedMediaIds || [];

  // Cleanup object URLs on unmount to prevent browser memory leaks
  useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, [pending]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    if (mediaIds.length + pending.length >= MAX_MEDIA_COUNT) {
      alert(`You can only upload a maximum of ${MAX_MEDIA_COUNT} media files.`);
      return;
    }

    const isVideo = file.type.startsWith("video/");
    const maxSize = isVideo ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;

    if (file.size > maxSize) {
      alert(
        `File size exceeds limit. Maximum allowed size is ${
          isVideo ? "100MB" : "15MB"
        }.`,
      );
      return;
    }

    const tempId = crypto.randomUUID();
    const previewUrl = URL.createObjectURL(file);
    setPending((prev) => [
      ...prev,
      { tempId, file, previewUrl, isVideo, status: "uploading" },
    ]);

    uploadMutation.mutate(file, {
      onSuccess: ({ media }) => {
        const existing = form.getValues("mediaIds") || [];
        form.setValue("mediaIds", [...existing, media.id], {
          shouldDirty: true,
          shouldValidate: true,
        });
        setPending((prev) => {
          const item = prev.find((p) => p.tempId === tempId);
          if (item) URL.revokeObjectURL(item.previewUrl);
          return prev.filter((p) => p.tempId !== tempId);
        });
      },
      onError: (err) => {
        const message =
          err instanceof ApiError
            ? err.message
            : "Upload failed. Please try again.";
        setPending((prev) =>
          prev.map((p) =>
            p.tempId === tempId
              ? { ...p, status: "error", errorMessage: message }
              : p,
          ),
        );
      },
    });
  }

  function removePending(tempId: string) {
    setPending((prev) => {
      const item = prev.find((p) => p.tempId === tempId);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.tempId !== tempId);
    });
  }

  async function removeUploaded(mediaId: string) {
    const current = form.getValues("mediaIds") || [];
    form.setValue(
      "mediaIds",
      current.filter((id) => id !== mediaId),
      { shouldDirty: true, shouldValidate: true },
    );
    if (workspaceId) {
      deleteMedia(workspaceId, mediaId).catch(() => {});
    }
  }

  // Position adjustment logic for reordering media items before submit
  function moveMedia(fromIndex: number, toIndex: number) {
    const current = form.getValues("mediaIds") || [];
    if (toIndex < 0 || toIndex >= current.length) return;

    const updated = [...current];
    const [movedId] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedId);

    form.setValue("mediaIds", updated, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  const isMaxReached = mediaIds.length + pending.length >= MAX_MEDIA_COUNT;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">
          Media ({mediaIds.length}/{MAX_MEDIA_COUNT})
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isMaxReached || uploadMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mr-1.5 h-4 w-4" />
          Add media
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {(mediaIds.length > 0 || pending.length > 0) && (
        <div className="grid grid-cols-4 gap-2">
          {mediaIds.map((id, index) => {
            const url = workspaceId ? getMediaFileUrl(workspaceId, id) : "";
            return (
              <div
                key={id}
                className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="Uploaded media"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    // Fallback visual if media is video format
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />

                {/* Index badge */}
                <span className="absolute left-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[9px] font-bold text-white backdrop-blur-xs">
                  {index + 1}
                </span>

                {/* Action Controls Overlay */}
                <div className="absolute inset-0 flex items-center justify-between px-1 opacity-0 transition-opacity group-hover:opacity-100 bg-black/20">
                  {/* Reorder Left */}
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveMedia(index, index - 1)}
                    aria-label="Move left"
                    className="rounded-full bg-black/60 p-1 text-white disabled:opacity-30"
                  >
                    <ArrowLeft className="h-3 w-3" />
                  </button>

                  {/* Reorder Right */}
                  <button
                    type="button"
                    disabled={index === mediaIds.length - 1}
                    onClick={() => moveMedia(index, index + 1)}
                    aria-label="Move right"
                    className="rounded-full bg-black/60 p-1 text-white disabled:opacity-30"
                  >
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                {/* Remove trigger */}
                <button
                  type="button"
                  onClick={() => removeUploaded(id)}
                  aria-label="Remove media"
                  className="absolute right-1 top-1 z-20 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}

          {pending.map((p) => (
            <div
              key={p.tempId}
              className="relative aspect-square overflow-hidden rounded-md border bg-muted"
            >
              {p.isVideo ? (
                <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-zinc-400">
                  <Video className="h-6 w-6" />
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={p.previewUrl}
                  alt=""
                  className="h-full w-full object-cover opacity-50"
                />
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 p-1 text-center text-white">
                {p.status === "uploading" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <span className="line-clamp-1 text-[10px] text-destructive-foreground">
                      {p.errorMessage}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePending(p.tempId)}
                      className="text-xs underline hover:text-destructive"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
