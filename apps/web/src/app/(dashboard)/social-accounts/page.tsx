"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Share2, Plus, X } from "lucide-react";

import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useWorkspaceContext } from "@/lib/hooks/use-workspace-context";
import { useSocialConnections } from "@/lib/hooks/use-social-connections";
import { disconnectSocialConnection } from "@/lib/api/social-connections";
import { ApiError } from "@/lib/api/client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SocialConnectionCard } from "@/components/social/social-connection-card";
import { ConnectAccountDialog } from "@/components/social/connect-account-dialog";

export default function SocialAccountsPage() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const { data: workspace } = useWorkspaceContext(activeWorkspaceId);
  const {
    data: connections,
    isLoading,
    isError,
    refetch,
  } = useSocialConnections(activeWorkspaceId);
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const canManage = workspace?.role === "OWNER" || workspace?.role === "EDITOR";

  const disconnectMutation = useMutation({
    mutationFn: (connectionId: string) =>
      disconnectSocialConnection(activeWorkspaceId!, connectionId),
    onSuccess: () => {
      setDisconnectError(null);
      queryClient.invalidateQueries({
        queryKey: ["social-connections", activeWorkspaceId],
      });
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? err.code === "CONNECTION_NOT_FOUND"
            ? "This account is no longer connected. Your connections have been refreshed."
            : err.code === "INSUFFICIENT_ROLE"
              ? "Your permissions changed and you can no longer manage social accounts."
              : err.message
          : "Something went wrong while disconnecting. Please try again.";
      setDisconnectError(message);
      // Server state is the source of truth after any failure — refresh
      // rather than assume the card's current displayed state is correct.
      queryClient.invalidateQueries({
        queryKey: ["social-connections", activeWorkspaceId],
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Social Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Connect the accounts your workspace uses to publish content.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Connect account
          </Button>
        )}
      </div>

      {!canManage && workspace && (
        <div className="rounded-md border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          You don&apos;t have permission to manage social accounts. Only Owners
          and Editors can connect or disconnect social accounts.
        </div>
      )}

      {disconnectError && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{disconnectError}</span>
          <button
            type="button"
            onClick={() => setDisconnectError(null)}
            aria-label="Dismiss"
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isError ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border py-16 text-center">
          <p className="text-sm font-medium">Unable to load social accounts</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : connections && connections.length > 0 ? (
        <div className="space-y-3">
          {connections.map((connection) => (
            <SocialConnectionCard
              key={connection.id}
              connection={connection}
              canManage={canManage}
              isDisconnecting={
                disconnectMutation.isPending &&
                disconnectMutation.variables === connection.id
              }
              onDisconnect={(id) => disconnectMutation.mutate(id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border py-20 text-center">
          <Share2 className="h-8 w-8 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-sm font-medium">
              No social accounts connected yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect Instagram, Facebook, LinkedIn, or X to get started.
            </p>
          </div>
          {canManage && (
            <Button className="mt-2" onClick={() => setDialogOpen(true)}>
              Connect account
            </Button>
          )}
        </div>
      )}

      {activeWorkspaceId && (
        <ConnectAccountDialog
          workspaceId={activeWorkspaceId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  );
}
