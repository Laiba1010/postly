import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformBadge } from "./platform-badge";
import type { UpcomingPost } from "@/lib/mock/dashboard";
import { formatRelativeTime } from "@/lib/format";

export function UpcomingPosts({ posts }: { posts: UpcomingPost[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upcoming posts</CardTitle>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No upcoming posts scheduled.
          </p>
        ) : (
          <ul className="space-y-3">
            {posts.map((post) => (
              <li
                key={post.id}
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{post.title}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <PlatformBadge platform={post.platform} />
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(post.scheduledAt)}
                    </span>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  Scheduled
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function UpcomingPostsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upcoming posts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
