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

  useEffect(() => {
    if (!userLoading && user === null) {
      router.replace("/login");
    }
  }, [userLoading, user, router]);

  useEffect(() => {
    if (workspacesLoading || !workspaces) return;

    const activeStillValid = workspaces.some((w) => w.id === activeWorkspaceId);

    if (workspaces.length === 0 && pathname !== "/workspace/new") {
      router.replace("/workspace/new");
    } else if (workspaces.length > 0 && !activeStillValid) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [
    workspaces,
    workspacesLoading,
    activeWorkspaceId,
    pathname,
    router,
    setActiveWorkspaceId,
  ]);

  if (userLoading || (user && workspacesLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
