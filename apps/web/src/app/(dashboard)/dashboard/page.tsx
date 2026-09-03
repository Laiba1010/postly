"use client";

import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useWorkspaces } from "@/lib/hooks/use-workspaces";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { data: user } = useCurrentUser();
  const { data: workspaces } = useWorkspaces();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const queryClient = useQueryClient();
  const router = useRouter();

  const activeWorkspace = workspaces?.find((w) => w.id === activeWorkspaceId);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], null);
      router.push("/login");
    },
  });

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Welcome, {user?.name}</h1>
      {activeWorkspace && (
        <p className="text-muted-foreground mt-1">
          Workspace: {activeWorkspace.name} · Role: {activeWorkspace.role}
        </p>
      )}
      <Button onClick={() => logoutMutation.mutate()} className="mt-4">
        Log out
      </Button>
    </div>
  );
}
