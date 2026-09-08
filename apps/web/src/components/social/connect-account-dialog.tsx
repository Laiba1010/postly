"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";

import {
  startOAuth,
  completeOAuth,
  type SocialProvider,
  type MockAccount,
} from "@/lib/api/social-connections";
import { ApiError } from "@/lib/api/client";
import { PROVIDER_META, ALL_PROVIDERS } from "./provider-meta";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface ConnectAccountDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step =
  | { name: "select-provider" }
  | {
      name: "authorize";
      displayName: string;
      state: string;
      mockAccounts: MockAccount[];
    };

export function ConnectAccountDialog({
  workspaceId,
  open,
  onOpenChange,
}: ConnectAccountDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>({ name: "select-provider" });
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const startMutation = useMutation({
    mutationFn: (provider: SocialProvider) => startOAuth(workspaceId, provider),
    onSuccess: (data) => {
      setSelectedAccountId(data.mockAccounts[0]?.accountId ?? "");
      setStep({
        name: "authorize",
        displayName: data.displayName,
        state: data.state,
        mockAccounts: data.mockAccounts,
      });
    },
    onError: () =>
      setError("Could not start the connection. Please try again."),
  });

  const completeMutation = useMutation({
    mutationFn: completeOAuth,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["social-connections", workspaceId],
      });
      handleClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "ALREADY_CONNECTED") {
        setError(
          "This account is already connected to your workspace. Choose a different account, or disconnect the existing one first.",
        );
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("We couldn't connect this account. Please try again.");
      }
    },
  });

  function handleClose() {
    setStep({ name: "select-provider" });
    setSelectedAccountId("");
    setError(null);
    onOpenChange(false);
  }

  function handleCancelAuthorize() {
    if (step.name === "authorize") {
      completeOAuth({ state: step.state, cancelled: true }).catch(() => {
        // Best-effort cleanup; the state also expires naturally via Redis TTL either way.
      });
    }
    handleClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}
    >
      <DialogContent>
        {step.name === "select-provider" ? (
          <>
            <DialogHeader>
              <DialogTitle>Connect a social account</DialogTitle>
              <DialogDescription>
                Choose a platform to connect to your workspace.
              </DialogDescription>
            </DialogHeader>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              {ALL_PROVIDERS.map((provider) => {
                const meta = PROVIDER_META[provider];
                const Icon = meta.icon;
                return (
                  <button
                    key={provider}
                    type="button"
                    disabled={startMutation.isPending}
                    onClick={() => {
                      setError(null);
                      startMutation.mutate(provider);
                    }}
                    className="flex flex-col items-center gap-2 rounded-lg border p-4 text-sm hover:bg-accent disabled:opacity-50"
                  >
                    <Icon className="h-6 w-6" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <DialogTitle className="text-center">
                {step.displayName} Mock Authorization
              </DialogTitle>
              <DialogDescription className="text-center">
                This is a simulated OAuth flow for development purposes. No real{" "}
                {step.displayName} account will be accessed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <p className="text-sm font-medium">Choose an account</p>
              <RadioGroup
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
              >
                {step.mockAccounts.map((account) => (
                  <div
                    key={account.accountId}
                    className="flex items-center gap-2"
                  >
                    <RadioGroupItem
                      value={account.accountId}
                      id={account.accountId}
                    />
                    <Label htmlFor={account.accountId}>
                      {account.accountName}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelAuthorize}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={completeMutation.isPending || !selectedAccountId}
                onClick={() => {
                  setError(null);
                  completeMutation.mutate({
                    state: step.state,
                    accountId: selectedAccountId,
                  });
                }}
              >
                {completeMutation.isPending ? "Connecting..." : "Authorize"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
