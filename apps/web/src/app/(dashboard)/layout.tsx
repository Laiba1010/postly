"use client";

import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useWorkspaces } from "@/lib/hooks/use-workspaces";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: workspaces, isLoading: workspacesLoading } = useWorkspaces();
  const { activeWorkspaceId, setActiveWorkspaceId } = useWorkspaceStore();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect unauthenticated users
  useEffect(() => {
    if (!userLoading && user === null) {
      router.replace("/login");
    }
  }, [userLoading, user, router]);

  // Redirect users with zero workspaces
  useEffect(() => {
    if (workspacesLoading || !workspaces) return;
    if (workspaces.length === 0 && pathname !== "/workspace/new") {
      router.replace("/workspace/new");
    }
  }, [workspaces, workspacesLoading, pathname, router]);

  // Self-heal an invalid/stale activeWorkspaceId
  useEffect(() => {
    if (workspacesLoading || !workspaces || workspaces.length === 0) return;
    const activeStillValid = workspaces.some((w) => w.id === activeWorkspaceId);
    if (!activeStillValid) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, workspacesLoading, activeWorkspaceId, setActiveWorkspaceId]);

  // Derived (not stored) — computed fresh every render, no setState needed
  const activeStillValid =
    !!workspaces &&
    workspaces.length > 0 &&
    workspaces.some((w) => w.id === activeWorkspaceId);

  const contextResolved =
    !workspacesLoading &&
    !!workspaces &&
    (workspaces.length === 0 || activeStillValid || workspaces.length > 0);

  const stillCorrecting =
    !workspacesLoading &&
    !!workspaces &&
    workspaces.length > 0 &&
    !activeStillValid;

  if (userLoading || (user && (workspacesLoading || stillCorrecting))) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
