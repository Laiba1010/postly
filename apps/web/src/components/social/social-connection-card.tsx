"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PROVIDER_META } from "./provider-meta";
import type { SocialConnection } from "@/lib/api/social-connections";

interface SocialConnectionCardProps {
  connection: SocialConnection;
  canManage: boolean;
  onDisconnect: (connectionId: string) => void;
  isDisconnecting: boolean;
}

export function SocialConnectionCard({
  connection,
  canManage,
  onDisconnect,
  isDisconnecting,
}: SocialConnectionCardProps) {
  const meta = PROVIDER_META[connection.provider];
  const Icon = meta.icon;

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{meta.label}</p>
            <p className="truncate text-sm text-muted-foreground">
              {connection.accountName}
            </p>
            {connection.isExpired && (
              <p className="mt-0.5 text-xs text-destructive">
                Reconnect this account to keep publishing to it.
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {connection.isExpired ? (
            <Badge variant="destructive">Expired</Badge>
          ) : (
            <Badge variant="secondary">Connected</Badge>
          )}
          {canManage && (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isDisconnecting}
                  >
                    Disconnect
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect {meta.label}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the connection to{" "}
                    <strong>{connection.accountName}</strong> from this
                    workspace. You won&apos;t be able to publish to this account
                    until it is connected again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDisconnect(connection.id)}
                  >
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
