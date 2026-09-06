import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformBadge } from "./platform-badge";
import type { FailedJob } from "@/lib/mock/dashboard";
import { formatRelativeTime } from "@/lib/format";

export function FailedJobs({ jobs }: { jobs: FailedJob[] }) {
  if (jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Failed publishing jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No failed jobs right now.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Failed publishing jobs</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job.id} className="flex items-start gap-3">
              <AlertTriangle
                className="h-4 w-4 shrink-0 text-destructive mt-0.5"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{job.postTitle}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <PlatformBadge platform={job.platform} />
                  <span className="text-xs text-destructive">{job.reason}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(job.timestamp)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function FailedJobsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Failed publishing jobs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
