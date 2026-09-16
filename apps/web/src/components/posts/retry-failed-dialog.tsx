"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { listPostTargets, type PostTarget } from "@/lib/api/posts";
import { useRetryTarget } from "@/lib/hooks/use-retry-target";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RetryResult = {
  success: string[];
  failed: {
    id: string;
    message: string;
  }[];
};

export function RetryFailedDialog({
  workspaceId,
  postId,
  open,
  onOpenChange,
  onDone,
}: {
  workspaceId: string;
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<RetryResult | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const targetsQuery = useQuery({
    queryKey: ["post-targets", workspaceId, postId],
    queryFn: () => listPostTargets(workspaceId, postId),
    enabled: open,
  });

  const retry = useRetryTarget(workspaceId);

  const failedTargets = (targetsQuery.data?.targets ?? []).filter(
    (target) => target.status === "FAILED",
  );

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelected([]);
      setResult(null);
      setIsRetrying(false);
    } else {
      setSelected([]);
      setResult(null);
    }

    onOpenChange(nextOpen);
  }

  function handleSelectAll() {
    if (selected.length === failedTargets.length) {
      setSelected([]);
      return;
    }

    setSelected(failedTargets.map((target) => target.id));
  }

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  async function handleRetry() {
    if (selected.length === 0 || isRetrying) {
      return;
    }

    setIsRetrying(true);

    try {
      const outcomes = await Promise.all(
        selected.map(async (targetId) => {
          try {
            await retry.mutateAsync({
              postId,
              targetId,
            });

            return {
              id: targetId,
              ok: true as const,
            };
          } catch (error) {
            return {
              id: targetId,
              ok: false as const,
              message:
                error instanceof ApiError
                  ? error.message
                  : "Unable to retry this target.",
            };
          }
        }),
      );

      const success = outcomes.filter((item) => item.ok).map((item) => item.id);

      const failed = outcomes
        .filter(
          (
            item,
          ): item is {
            id: string;
            ok: false;
            message: string;
          } => !item.ok,
        )
        .map((item) => ({
          id: item.id,
          message: item.message,
        }));

      setResult({
        success,
        failed,
      });

      await targetsQuery.refetch();

      onDone?.();
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retry failed targets?</DialogTitle>

          <DialogDescription>
            Retry only the targets that are currently failed. Targets that
            changed state on the server will be reported instead of being marked
            successful.
          </DialogDescription>
        </DialogHeader>

        {targetsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">
            Loading target status…
          </p>
        ) : targetsQuery.isError ? (
          <div className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">
            Unable to load the current target states. Close and try again.
          </div>
        ) : result ? (
          <div className="space-y-3 text-sm">
            <p className="font-medium">Retry complete</p>

            {result.success.length > 0 && (
              <p>
                ✓ {result.success.length} target
                {result.success.length === 1 ? "" : "s"} queued.
              </p>
            )}

            {result.failed.length > 0 && (
              <div className="text-destructive">
                <p>
                  ⚠ {result.failed.length} target
                  {result.failed.length === 1 ? "" : "s"} could not be retried.
                </p>

                {result.failed.map((item) => (
                  <p key={item.id} className="mt-1 text-xs">
                    {item.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : failedTargets.length === 0 ? (
          <div className="flex items-start gap-2 rounded-md border p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

            <span>
              No targets are currently failed. The post may have changed since
              this list was loaded.
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Failed targets</p>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                disabled={isRetrying}
              >
                {selected.length === failedTargets.length
                  ? "Clear all"
                  : "Select all"}
              </Button>
            </div>

            {failedTargets.map((target: PostTarget) => (
              <label
                key={target.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(target.id)}
                  onChange={() => toggle(target.id)}
                  disabled={isRetrying}
                />

                <span className="font-medium">{target.platform}</span>

                <span className="text-muted-foreground">
                  {target.retryCount ?? 0} automatic retries
                </span>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isRetrying}
          >
            {result ? "Close" : "Cancel"}
          </Button>

          {!result && (
            <Button
              onClick={handleRetry}
              disabled={isRetrying || selected.length === 0}
            >
              {isRetrying
                ? "Retrying…"
                : `Retry ${selected.length} target${
                    selected.length === 1 ? "" : "s"
                  }`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
