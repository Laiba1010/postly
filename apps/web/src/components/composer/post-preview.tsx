"use client";

import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMediaFileUrl } from "@/lib/api/media";
import { PROVIDER_META } from "@/components/social/provider-meta";
import type { ComposerFormValues } from "@/lib/validations/composer";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface PostPreviewProps {
  workspaceId: string | null;
  form: UseFormReturn<ComposerFormValues>;
}

export function PostPreview({ workspaceId, form }: PostPreviewProps) {
  const content = form.watch("content");
  const watchedMediaIds = form.watch("mediaIds");
  const watchedDestinations = form.watch("destinations");

  // Prevent runtime undefined crashes
  const mediaIds = watchedMediaIds || [];
  const destinations = watchedDestinations || [];

  // Track natural image dimensions to calculate aspect ratio warnings
  const [mediaDimensions, setMediaDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});

  // Deduplicate and format social provider names
  const uniqueProviders = Array.from(
    new Set(destinations.map((d) => d.provider)),
  );

  const providerNames = uniqueProviders
    .map((provider) => PROVIDER_META[provider]?.label || provider)
    .join(", ");

  // Identify media aspect ratio warnings based on loaded dimensions
  const aspectRatioWarnings = mediaIds.filter((id) => {
    const dims = mediaDimensions[id];
    if (!dims) return false;
    const ratio = dims.width / dims.height;
    // Flag if aspect ratio strays significantly from standard post dimensions (e.g. 4:5 to 1.91:1)
    return ratio < 0.75 || ratio > 2.1;
  });

  return (
    <Card className="sticky top-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {destinations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Select a platform to see a preview.
          </p>
        ) : (
          <p className="text-xs font-medium text-muted-foreground">
            Posting to {providerNames}
          </p>
        )}

        {/* Aspect Ratio Warning Banner */}
        {aspectRatioWarnings.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle
              className="h-4 w-4 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <span className="font-semibold">Aspect ratio warning</span>
              <p className="mt-0.5 opacity-90 leading-normal">
                {aspectRatioWarnings.length === 1
                  ? "1 attachment has a non-standard ratio and may be auto-cropped."
                  : `${aspectRatioWarnings.length} attachments have non-standard ratios and may be auto-cropped.`}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-md border bg-card p-3 shadow-sm">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {content ? (
              content
            ) : (
              <span className="text-muted-foreground italic">
                Nothing written yet.
              </span>
            )}
          </p>

          {mediaIds.length > 0 && (
            <div
              className={cn("mt-3 grid gap-2", {
                "grid-cols-1": mediaIds.length === 1,
                "grid-cols-2": mediaIds.length === 2 || mediaIds.length === 4,
                "grid-cols-3": mediaIds.length === 3,
              })}
            >
              {mediaIds.map((id) => {
                const mediaUrl = workspaceId
                  ? getMediaFileUrl(workspaceId, id)
                  : null;

                if (!mediaUrl) {
                  return (
                    <div
                      key={id}
                      className="aspect-square rounded-md bg-muted animate-pulse"
                    />
                  );
                }

                return (
                  <div
                    key={id}
                    className="relative aspect-square overflow-hidden rounded-md border bg-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mediaUrl}
                      alt="Post attachment preview"
                      className="h-full w-full object-cover transition-opacity"
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        if (img.naturalWidth && img.naturalHeight) {
                          setMediaDimensions((prev) => ({
                            ...prev,
                            [id]: {
                              width: img.naturalWidth,
                              height: img.naturalHeight,
                            },
                          }));
                        }
                      }}
                      onError={(e) => {
                        // Fallback styling for non-image assets or load errors
                        (e.target as HTMLElement).style.opacity = "0";
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
