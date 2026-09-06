import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformBadge } from "./platform-badge";
import type { ConnectedAccount } from "@/lib/mock/dashboard";

export function ConnectedAccounts({
  accounts,
}: {
  accounts: ConnectedAccount[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Connected accounts</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-center justify-between">
              <PlatformBadge platform={account.platform} />
              <Badge
                variant={account.status === "CONNECTED" ? "default" : "outline"}
              >
                {account.status === "CONNECTED" ? "Connected" : "Not connected"}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ConnectedAccountsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Connected accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
