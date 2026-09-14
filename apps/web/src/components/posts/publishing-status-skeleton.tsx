import { Skeleton } from "@/components/ui/skeleton";

export function PublishingStatusSkeleton() {
  return (
    <div
      className="space-y-3 rounded-xl border bg-card p-6"
      aria-busy="true"
      aria-label="Loading publishing status"
    >
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>

      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between rounded-lg border p-4"
        >
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>

          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
