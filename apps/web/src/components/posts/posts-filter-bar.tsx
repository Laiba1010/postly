
"use client";

import { useEffect, useState } from "react";
import type { SocialProvider } from "@/lib/api/social-connections";
import { SORT_OPTIONS, PLATFORM_OPTIONS } from "@/lib/posts-url";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

type PostsFilterBarProps = {
  search: string;
  platform?: SocialProvider;
  sort: string;
  createdFrom: string;
  createdTo: string;
  onSearch: (value: string) => void;
  onPlatform: (value?: SocialProvider) => void;
  onSort: (value: string) => void;
  onDateRange: (createdFrom: string, createdTo: string) => void;
  onClear: () => void;
};

export function PostsFilterBar({
  search,
  platform,
  sort,
  createdFrom,
  createdTo,
  onSearch,
  onPlatform,
  onSort,
  onDateRange,
  onClear,
}: PostsFilterBarProps) {
  const [value, setValue] = useState(search);

  useEffect(() => {
    const trimmed = value.trim();

    if (trimmed === search) return;

    const timer = window.setTimeout(() => {
      onSearch(trimmed);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [value, search, onSearch]);

  const dirty =
    Boolean(search) ||
    Boolean(platform) ||
    Boolean(createdFrom) ||
    Boolean(createdTo) ||
    sort !== "updatedAt:desc";

  function clearSearch() {
    setValue("");
    onSearch("");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />

          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Search posts..."
            aria-label="Search posts"
            className="pr-9 pl-9"
          />

          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>

        <Select
          value={platform ?? "ANY"}
          onValueChange={(nextValue) => {
            if (nextValue === null) return;

            onPlatform(
              nextValue === "ANY" ? undefined : (nextValue as SocialProvider),
            );
          }}
        >
          <SelectTrigger
            className="w-full lg:w-44"
            aria-label="Filter by platform"
          >
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="ANY">All platforms</SelectItem>

            {PLATFORM_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sort}
          onValueChange={(nextValue) => {
            if (nextValue !== null) {
              onSort(nextValue);
            }
          }}
        >
          <SelectTrigger className="w-full lg:w-48" aria-label="Sort posts">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {dirty && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start lg:self-auto"
            onClick={() => {
              setValue("");
              onClear();
            }}
          >
            <X className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Clear filters
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-44">
          <label
            htmlFor="posts-created-from"
            className="mb-1.5 block text-xs font-medium text-muted-foreground"
          >
            Created from
          </label>

          <Input
            id="posts-created-from"
            type="date"
            value={createdFrom}
            max={createdTo || undefined}
            onChange={(event) =>
              onDateRange(event.target.value, createdTo)
            }
            aria-label="Created from"
          />
        </div>

        <div className="w-full sm:max-w-44">
          <label
            htmlFor="posts-created-to"
            className="mb-1.5 block text-xs font-medium text-muted-foreground"
          >
            Created to
          </label>

          <Input
            id="posts-created-to"
            type="date"
            value={createdTo}
            min={createdFrom || undefined}
            onChange={(event) =>
              onDateRange(createdFrom, event.target.value)
            }
            aria-label="Created to"
          />
        </div>
      </div>
    </div>
  );
}

