"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import Link from "next/link";

import { previewInvitation, acceptInvitation } from "@/lib/api/invitations";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { ApiError } from "@/lib/api/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AcceptInvitationPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const autoAcceptTriggered = useRef(false);

  const shouldAutoAccept = searchParams.get("autoAccept") === "true";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["invitation-preview", params.token],
    queryFn: async () => {
      const { invitation } = await previewInvitation(params.token);
      return invitation;
    },
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptInvitation(params.token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      router.push("/dashboard");
    },
  });

  const emailMismatch =
    user && data && user.email.toLowerCase() !== data.email.toLowerCase();

  // Auto-accept exactly once, only when it's actually safe to do so:
  // authenticated, correct account, invitation loaded, not already running.
  useEffect(() => {
    if (
      shouldAutoAccept &&
      !autoAcceptTriggered.current &&
      user &&
      data &&
      !emailMismatch &&
      !acceptMutation.isPending &&
      !acceptMutation.isSuccess
    ) {
      autoAcceptTriggered.current = true;
      acceptMutation.mutate();
    }
  }, [shouldAutoAccept, user, data, emailMismatch, acceptMutation]);

  if (isLoading || userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading invitation...</p>
      </div>
    );
  }

  if (isError || !data) {
    const message =
      error instanceof ApiError
        ? error.message
        : "This invitation link is invalid.";
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Invitation not found</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Auto-accept in progress — show a lightweight loading state, not the full card
  if (
    shouldAutoAccept &&
    (acceptMutation.isPending ||
      (user && !emailMismatch && !acceptMutation.isError))
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Accepting invitation...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>You&apos;re invited to join</CardTitle>
          <CardDescription className="text-base font-medium text-foreground">
            {data.workspaceName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Role</span>
            <Badge variant="secondary">{data.role}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Invited email</span>
            <span className="font-medium">{data.email}</span>
          </div>

          {emailMismatch && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              This invitation was sent to <strong>{data.email}</strong>.
              You&apos;re currently signed in as <strong>{user.email}</strong>.
              Please sign in with the invited account to accept.
            </div>
          )}

          {acceptMutation.isError && (
            <p className="text-sm text-destructive">
              {acceptMutation.error instanceof ApiError
                ? acceptMutation.error.message
                : "Something went wrong."}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-2">
          {!user && (
            <>
              <Link
                href={`/signup?redirect=${encodeURIComponent(`/invitations/${params.token}?autoAccept=true`)}`}
                className={cn(buttonVariants({ variant: "default" }), "w-full")}
              >
                Accept & sign up
              </Link>
              <Link
                href={`/login?redirect=${encodeURIComponent(`/invitations/${params.token}?autoAccept=true`)}`}
                className={cn(buttonVariants({ variant: "outline" }), "w-full")}
              >
                Log in to accept
              </Link>
            </>
          )}

          {user && !emailMismatch && (
            <Button
              className="w-full"
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending ? "Accepting..." : "Accept invitation"}
            </Button>
          )}

          {user && emailMismatch && (
            <Link
              href={`/login?redirect=${encodeURIComponent(`/invitations/${params.token}?autoAccept=true`)}`}
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              Sign in with a different account
            </Link>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
