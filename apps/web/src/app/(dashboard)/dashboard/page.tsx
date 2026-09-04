"use client";

import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useWorkspaceContext } from "@/lib/hooks/use-workspace-context";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { data: user } = useCurrentUser();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const {
    data: workspace,
    isLoading,
    isError,
  } = useWorkspaceContext(activeWorkspaceId);
  const queryClient = useQueryClient();
  const router = useRouter();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], null);
      router.push("/login");
    },
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Welcome, {user?.name}</h1>
        <WorkspaceSwitcher />
      </div>

      {isLoading && (
        <p className="text-muted-foreground">Loading workspace...</p>
      )}
      {isError && (
        <p className="text-destructive text-sm">
          You don&apos;t have access to this workspace.
        </p>
      )}
      {workspace && (
        <p className="text-muted-foreground">
          Workspace: {workspace.name} · Role: {workspace.role}
        </p>
      )}

      <Button onClick={() => logoutMutation.mutate()}>Log out</Button>
    </div>
  );
}
