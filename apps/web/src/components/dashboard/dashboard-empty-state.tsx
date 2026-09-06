import Link from "next/link";
import { FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border py-20 text-center">
      <FileText className="h-8 w-8 text-muted-foreground" aria-hidden />
      <div>
        <p className="text-sm font-medium">No posts yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first post to start building your publishing workflow.
        </p>
      </div>
      <Link
        href="/posts/new"
        className={cn(buttonVariants({ variant: "default" }), "mt-2")}
      >
        Create post
      </Link>
    </div>
  );
}
