import type { PostListItem, PostTargetStatus } from "@/lib/api/posts";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_OPTIONS } from "@/lib/posts-url";

const labels: Record<PostTargetStatus, string> = {
  SCHEDULED: "Scheduled",
  PUBLISHING: "Publishing",
  RETRYING: "Retrying",
  PUBLISHED: "Published",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const variants: Record<
  PostTargetStatus,
  "secondary" | "default" | "destructive" | "outline"
> = {
  SCHEDULED: "outline",
  PUBLISHING: "default",
  RETRYING: "default",
  PUBLISHED: "default",
  FAILED: "destructive",
  CANCELLED: "outline",
};

function platformLabel(platform: PostListItem["targets"][number]["platform"]) {
  return (
    PLATFORM_OPTIONS.find((option) => option.value === platform)?.label ??
    platform
  );
}

export function PostRowStatus({ post }: { post: PostListItem }) {
  if (!post.targets.length) {
    return <Badge variant="secondary">Draft</Badge>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {post.targets.map((target) => (
        <Badge
          key={target.id}
          variant={variants[target.status]}
          title={`${target.accountName}: ${labels[target.status]}`}
        >
          {platformLabel(target.platform)} · {labels[target.status]}
        </Badge>
      ))}
    </div>
  );
}
