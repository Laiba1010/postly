"use client";

import { AlertCircle, CheckCircle2, Clock3, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PostStatusTarget } from "@/lib/api/posts";

const STATUS_LABELS = {
  SCHEDULED: "Scheduled",
  PUBLISHING: "Publishing",
  RETRYING: "Retrying",
  PUBLISHED: "Published",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
} as const;

function formatRetryTime(value: string | null): string | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  const seconds = Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
  if (seconds <= 0) return "next";
  if (seconds < 60) return `in ${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return `in ${minutes}m`;
}

function StatusIcon({ status }: { status: PostStatusTarget["status"] }) {
  if (status === "PUBLISHED") return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
  if (status === "FAILED") return <AlertCircle className="h-4 w-4" aria-hidden="true" />;
  if (status === "CANCELLED") return <XCircle className="h-4 w-4" aria-hidden="true" />;
  if (status === "RETRYING") return <RotateCcw className="h-4 w-4" aria-hidden="true" />;
  if (status === "PUBLISHING") return <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
  return <Clock3 className="h-4 w-4" aria-hidden="true" />;
}

export function PostTargetStatusRow({ target }: { target: PostStatusTarget }) {
  const retryTime = formatRetryTime(target.retry.nextRetryAt);
  const error = target.attempt?.errorMessage ?? target.attempt?.errorCode ?? null;

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{target.platform}</p>
          <p className="truncate text-xs text-muted-foreground">{target.accountName}</p>
        </div>
        <Badge
          variant={
            target.status === "FAILED"
              ? "destructive"
              : target.status === "PUBLISHED"
                ? "default"
                : "outline"
          }
          className="w-fit"
        >
          <StatusIcon status={target.status} />
          {STATUS_LABELS[target.status]}
        </Badge>
      </div>

      {(target.status === "PUBLISHING" || target.status === "RETRYING" || target.status === "FAILED") && (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {target.attempt && (
            <p>
              Attempt {target.attempt.number} of {target.retry.maxAttempts}
            </p>
          )}
          {target.status === "RETRYING" && retryTime && (
            <p>Next retry {retryTime}.</p>
          )}
          {error && (
            <p className="text-destructive">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
