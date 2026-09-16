"use client";

import { useEffect, useState } from "react";
import type { SocialProvider } from "@/lib/api/social-connections";
import { SORT_OPTIONS, PLATFORM_OPTIONS } from "@/lib/posts-url";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

type PostsFilterBarProps = {
  search: string;
  platform?: SocialProvider;
  sort: string;
  onSearch: (value: string) => void;
  onPlatform: (value?: SocialProvider) => void;
  onSort: (value: string) => void;
  onClear: () => void;
};

export function PostsFilterBar({
  search,
  platform,
  sort,
  onSearch,
  onPlatform,
  onSort,
  onClear,
}: PostsFilterBarProps) {
  const [value, setValue] = useState(search);

  useEffect(() => {
    if (value === search) {
      return;
    }

    const timer = window.setTimeout(() => {
      onSearch(value.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [value, search, onSearch]);

  const dirty =
    Boolean(search) || Boolean(platform) || sort !== "updatedAt:desc";

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search posts..."
          aria-label="Search posts"
          className="pl-9"
        />
      </div>

      <select
        aria-label="Filter by platform"
        value={platform ?? ""}
        onChange={(event) => {
          const nextValue = event.target.value;

          onPlatform(nextValue ? (nextValue as SocialProvider) : undefined);
        }}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">All platforms</option>

        {PLATFORM_OPTIONS.map((platformOption) => (
          <option key={platformOption.value} value={platformOption.value}>
            {platformOption.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Sort posts"
        value={sort}
        onChange={(event) => onSort(event.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {dirty && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setValue("");
            onClear();
          }}
        >
          <X className="mr-1.5 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
