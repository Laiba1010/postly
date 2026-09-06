import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardKpis as DashboardKpisData } from "@/lib/mock/dashboard";

const KPI_LABELS: { key: keyof DashboardKpisData; label: string }[] = [
  { key: "draftCount", label: "Drafts" },
  { key: "scheduledCount", label: "Scheduled" },
  { key: "publishedCount", label: "Published" },
  { key: "failedCount", label: "Failed" },
];

export function DashboardKpis({ data }: { data: DashboardKpisData }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {KPI_LABELS.map(({ key, label }) => (
        <Card key={key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data[key]}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DashboardKpisSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-16" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-12" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
