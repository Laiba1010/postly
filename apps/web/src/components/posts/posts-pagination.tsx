"use client";
import { Button } from "@/components/ui/button";
export function PostsPagination({
  page,
  totalPages,
  total,
  limit,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1)
    return (
      <div className="text-xs text-muted-foreground">
        {total} result{total === 1 ? "" : "s"}
      </div>
    );
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  );
  const items: (number | "ellipsis")[] = [];
  pages.forEach((p, i) => {
    if (i && p - pages[i - 1] > 1) items.push("ellipsis");
    items.push(p);
  });
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Showing {start}-{end} of {total}
      </p>
      <div className="flex items-center gap-1">
        {" "}
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        {items.map((item, i) =>
          item === "ellipsis" ? (
            <span key={`e-${i}`} className="px-2 text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={item}
              variant={item === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPage(item)}
            >
              {item}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
