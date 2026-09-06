"use client";

import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { isDashboardEmpty } from "@/lib/mock/dashboard";
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state";
import { useWorkspaceContext } from "@/lib/hooks/use-workspace-context";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useDashboardData } from "@/lib/hooks/use-dashboard-data";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  DashboardKpis,
  DashboardKpisSkeleton,
} from "@/components/dashboard/dashboard-kpis";
import {
  UpcomingPosts,
  UpcomingPostsSkeleton,
} from "@/components/dashboard/upcoming-posts";
import {
  ConnectedAccounts,
  ConnectedAccountsSkeleton,
} from "@/components/dashboard/connected-accounts";
import {
  RecentActivity,
  RecentActivitySkeleton,
} from "@/components/dashboard/recent-activity";
import {
  FailedJobs,
  FailedJobsSkeleton,
} from "@/components/dashboard/failed-jobs";

export default function DashboardPage() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const { data: workspace, isError: workspaceError } =
    useWorkspaceContext(activeWorkspaceId);
  const {
    data: dashboardData,
    isLoading,
    isError: dashboardError,
    refetch,
  } = useDashboardData(activeWorkspaceId);

  if (workspaceError) {
    return (
      <p className="text-destructive text-sm">
        You don&apos;t have access to this workspace.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your workspace activity and publishing status.
          </p>
        </div>
        <Link
          href="/posts/new"
          className={cn(buttonVariants({ variant: "default" }))}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Create post
        </Link>
      </div>

      {dashboardError ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border py-16 text-center">
          <p className="text-sm font-medium">Unable to load dashboard</p>
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t load your workspace activity.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading || !dashboardData ? (
        <div className="space-y-6">
          <DashboardKpisSkeleton />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <UpcomingPostsSkeleton />
            <ConnectedAccountsSkeleton />
          </div>
          <RecentActivitySkeleton />
          <FailedJobsSkeleton />
        </div>
      ) : isDashboardEmpty(dashboardData) ? (
        <div className="space-y-6">
          <DashboardKpis data={dashboardData.kpis} />
          <DashboardEmptyState />
        </div>
      ) : (
        <div className="space-y-6">
          <DashboardKpis data={dashboardData.kpis} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <UpcomingPosts posts={dashboardData.upcomingPosts} />
            <ConnectedAccounts accounts={dashboardData.connectedAccounts} />
          </div>
          <RecentActivity items={dashboardData.activity} />
          <FailedJobs jobs={dashboardData.failedJobs} />
        </div>
      )}
    </div>
  );
}
