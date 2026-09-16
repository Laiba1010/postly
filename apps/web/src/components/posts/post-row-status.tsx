import type { PostListItem, PostTargetStatus } from "@/lib/api/posts";
import { Badge } from "@/components/ui/badge";
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
export function PostRowStatus({ post }: { post: PostListItem }) {
  if (!post.targets.length) return <Badge variant="secondary">Draft</Badge>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {post.targets.map((target) => (
        <Badge
          key={target.id}
          variant={variants[target.status]}
          title={`${target.accountName}: ${labels[target.status]}`}
        >
          {target.platform === "INSTAGRAM"
            ? "Instagram"
            : target.platform === "FACEBOOK"
              ? "Facebook"
              : target.platform === "LINKEDIN"
                ? "LinkedIn"
                : "X"}{" "}
          · {labels[target.status]}
        </Badge>
      ))}
    </div>
  );
}
