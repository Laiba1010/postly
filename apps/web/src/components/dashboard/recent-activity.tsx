import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformBadge } from "./platform-badge";
import type { ActivityItem } from "@/lib/mock/dashboard";
import { formatRelativeTime } from "@/lib/format";

const ACTION_CONFIG = {
  PUBLISHED: {
    icon: CheckCircle2,
    className: "text-green-600",
    label: "Post published",
  },
  FAILED: {
    icon: XCircle,
    className: "text-destructive",
    label: "Publishing failed",
  },
  PUBLISHING: {
    icon: Loader2,
    className: "text-muted-foreground animate-spin",
    label: "Publishing",
  },
} as const;

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent publishing activity</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recent activity yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const config = ACTION_CONFIG[item.action];
              const Icon = config.icon;
              return (
                <li key={item.id} className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${config.className}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-medium">{config.label}</span>{" "}
                      <span className="text-muted-foreground">
                        — {item.postTitle}
                      </span>
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <PlatformBadge platform={item.platform} />
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentActivitySkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent publishing activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
