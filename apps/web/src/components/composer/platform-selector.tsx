"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { Check, Plus, Globe, ExternalLink } from "lucide-react";
import { useSocialConnections } from "@/lib/hooks/use-social-connections";
import { PROVIDER_META } from "@/components/social/provider-meta";
import type { ComposerFormValues } from "@/lib/validations/composer";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface PlatformSelectorProps {
  workspaceId: string | null;
  form: UseFormReturn<ComposerFormValues>;
}

export function PlatformSelector({ workspaceId, form }: PlatformSelectorProps) {
  const { data: connections, isLoading } = useSocialConnections(workspaceId);

  if (isLoading) {
    return <div className="h-16 animate-pulse rounded-md bg-muted" />;
  }

  if (!connections || connections.length === 0) {
    return (
      <div className="rounded-lg border py-8 text-center">
        <p className="text-sm font-medium">No social accounts connected</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect a social account before creating a post.
        </p>
        <Link
          href="/social-accounts"
          className={cn(buttonVariants({ variant: "default" }), "mt-3")}
        >
          Connect social account
        </Link>
      </div>
    );
  }

  return (
    <Controller
      name="destinations"
      control={form.control}
      render={({ field, fieldState }) => {
        const currentDestinations = field.value || [];

        const isSelected = (connectionId: string) =>
          currentDestinations.some(
            (d) => d.socialConnectionId === connectionId,
          );

        function toggle(connectionId: string, provider: string) {
          const nextDestinations = isSelected(connectionId)
            ? currentDestinations.filter(
                (d) => d.socialConnectionId !== connectionId,
              )
            : [
                ...currentDestinations,
                { provider: provider as any, socialConnectionId: connectionId },
              ];

          field.onChange(nextDestinations);
          form.trigger("destinations");
        }

        return (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Select Accounts to Post To
              </label>
              <span className="text-xs text-muted-foreground">
                {currentDestinations.length === 0
                  ? "Click an account to select"
                  : `${currentDestinations.length} selected`}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {connections.map((connection) => {
                const meta = PROVIDER_META[connection.provider] || {
                  label: connection.provider,
                  icon: Globe,
                };
                const Icon = meta.icon;
                const selected = isSelected(connection.id);

                if (connection.isExpired) {
                  return (
                    <Link
                      key={connection.id}
                      href="/social-accounts"
                      className="flex items-center gap-1.5 rounded-md border border-dashed border-destructive/40 bg-destructive/5 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10"
                      title="This connection has expired. Click to reconnect."
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>
                        {meta.label} — {connection.accountName}
                      </span>
                      <span className="text-xs font-medium text-destructive">
                        (Expired)
                      </span>
                      <ExternalLink className="ml-1 h-3 w-3 shrink-0" />
                    </Link>
                  );
                }

                return (
                  <Button
                    key={connection.id}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggle(connection.id, connection.provider)}
                    aria-pressed={selected}
                    aria-label={`${selected ? "Deselect" : "Select"} ${
                      meta.label
                    } ${connection.accountName}`}
                    className={cn(
                      !selected &&
                        "border-dashed text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="mr-1.5 h-4 w-4 shrink-0" />
                    <span>
                      {meta.label} — {connection.accountName}
                    </span>
                    {selected ? (
                      <Check className="ml-1.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Plus className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-50" />
                    )}
                  </Button>
                );
              })}
            </div>

            {fieldState.error && (
              <p className="text-xs font-medium text-destructive">
                {fieldState.error.message}
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
