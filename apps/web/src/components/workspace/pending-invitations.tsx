"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePendingInvitations } from "@/lib/hooks/use-invitations";
import { revokeInvitation } from "@/lib/api/invitations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

function daysUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days <= 1 ? "less than a day" : `${days} days`;
}

export function PendingInvitations({ workspaceId }: { workspaceId: string }) {
  const { data: invitations, isLoading } = usePendingInvitations(workspaceId);
  const queryClient = useQueryClient();

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) =>
      revokeInvitation(workspaceId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations", workspaceId] });
    },
  });

  if (isLoading || !invitations || invitations.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <h2 className="text-sm font-medium text-muted-foreground mb-3">
        Pending invitations
      </h2>
      <div className="space-y-2">
        {invitations.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center justify-between rounded-lg border px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium">{inv.email}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />
                Expires in {daysUntil(inv.expiresAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{inv.role}</Badge>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={revokeMutation.isPending}
                onClick={() => revokeMutation.mutate(inv.id)}
              >
                Revoke
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
