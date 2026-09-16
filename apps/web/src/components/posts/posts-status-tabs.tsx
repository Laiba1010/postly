"use client";
import type { PostStatus } from "@/lib/api/posts";
import { POST_STATUSES } from "@/lib/posts-url";
import { cn } from "@/lib/utils";

export function PostsStatusTabs({
  status,
  onChange,
}: {
  status?: PostStatus;
  onChange: (status?: PostStatus) => void;
}) {
  return (
    <div className="w-full overflow-x-auto">
      <div
        role="tablist"
        aria-label="Post status"
        className="flex min-w-max gap-1 border-b"
      >
        {POST_STATUSES.map((item) => {
          const active = item.value === status;
          return (
            <button
              key={item.label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.value)}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
