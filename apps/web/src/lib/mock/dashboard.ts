export type Platform = "INSTAGRAM" | "FACEBOOK" | "LINKEDIN" | "X";
export type PostStatus =
  "DRAFT" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED";

export interface DashboardKpis {
  draftCount: number;
  scheduledCount: number;
  publishedCount: number;
  failedCount: number;
}

export interface UpcomingPost {
  id: string;
  title: string;
  scheduledAt: string;
  platform: Platform;
  status: PostStatus;
}

export interface ActivityItem {
  id: string;
  postTitle: string;
  action: "PUBLISHED" | "FAILED" | "PUBLISHING";
  platform: Platform;
  timestamp: string;
}

export interface ConnectedAccount {
  id: string;
  platform: Platform;
  displayName: string;
  status: "CONNECTED" | "NOT_CONNECTED";
}

export interface FailedJob {
  id: string;
  postTitle: string;
  platform: Platform;
  reason: string;
  timestamp: string;
}

export interface DashboardData {
  kpis: DashboardKpis;
  upcomingPosts: UpcomingPost[];
  activity: ActivityItem[];
  connectedAccounts: ConnectedAccount[];
  failedJobs: FailedJob[];
}

const MOCK_DASHBOARD_DATA: DashboardData = {
  kpis: {
    draftCount: 12,
    scheduledCount: 8,
    publishedCount: 42,
    failedCount: 2,
  },
  upcomingPosts: [
    {
      id: "p1",
      title: "Product launch announcement",
      scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 20).toISOString(),
      platform: "INSTAGRAM",
      status: "SCHEDULED",
    },
    {
      id: "p2",
      title: "Weekly customer spotlight",
      scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 44).toISOString(),
      platform: "LINKEDIN",
      status: "SCHEDULED",
    },
    {
      id: "p3",
      title: "Behind the scenes reel",
      scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 68).toISOString(),
      platform: "X",
      status: "SCHEDULED",
    },
  ],
  activity: [
    {
      id: "a1",
      postTitle: "Summer sale teaser",
      action: "PUBLISHED",
      platform: "INSTAGRAM",
      timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    },
    {
      id: "a2",
      postTitle: "Team hiring update",
      action: "PUBLISHED",
      platform: "LINKEDIN",
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
    {
      id: "a3",
      postTitle: "New feature announcement",
      action: "FAILED",
      platform: "FACEBOOK",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
  ],
  connectedAccounts: [
    {
      id: "c1",
      platform: "INSTAGRAM",
      displayName: "@postly.demo",
      status: "CONNECTED",
    },
    {
      id: "c2",
      platform: "FACEBOOK",
      displayName: "Postly Demo Page",
      status: "CONNECTED",
    },
    {
      id: "c3",
      platform: "LINKEDIN",
      displayName: "Postly Inc.",
      status: "CONNECTED",
    },
    { id: "c4", platform: "X", displayName: "", status: "NOT_CONNECTED" },
  ],
  failedJobs: [
    {
      id: "f1",
      postTitle: "New feature announcement",
      platform: "FACEBOOK",
      reason: "Rate limit exceeded",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: "f2",
      postTitle: "Weekly newsletter recap",
      platform: "INSTAGRAM",
      reason: "Publishing failed",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
  ],
};

/**
 * Simulates fetching dashboard data for a given workspace.
 * Signature deliberately matches what a real API call would look like
 * (`workspaceId` in, `Promise<DashboardData>` out) so this can be swapped
 * for a real endpoint later without touching any component.
 */
export async function getDashboardData(
  workspaceId: string,
): Promise<DashboardData> {
  await new Promise((resolve) => setTimeout(resolve, 400)); // simulate network latency
  return MOCK_DASHBOARD_DATA;
}
export function isDashboardEmpty(data: DashboardData): boolean {
  return (
    data.kpis.draftCount === 0 &&
    data.kpis.scheduledCount === 0 &&
    data.kpis.publishedCount === 0 &&
    data.kpis.failedCount === 0 &&
    data.upcomingPosts.length === 0 &&
    data.activity.length === 0 &&
    data.failedJobs.length === 0
  );
}
