import type { SocialProvider } from "@/lib/api/posts";

export const POST_STATUSES: {
  value: Exclude<PostsStatusFilter, "ALL"> | undefined;
  label: string;
}[] = [
  {
    value: undefined,
    label: "All",
  },
  {
    value: "DRAFT",
    label: "Draft",
  },
  {
    value: "SCHEDULED",
    label: "Scheduled",
  },
  {
    value: "PUBLISHING",
    label: "Publishing",
  },
  {
    value: "PARTIALLY_PUBLISHED",
    label: "Partially published",
  },
  {
    value: "PUBLISHED",
    label: "Published",
  },
  {
    value: "FAILED",
    label: "Failed",
  },
  {
    value: "CANCELLED",
    label: "Cancelled",
  },
];

export const POST_STATUS_VALUES = [
  "ALL",
  "DRAFT",
  "SCHEDULED",
  "PUBLISHING",
  "PARTIALLY_PUBLISHED",
  "PUBLISHED",
  "FAILED",
  "CANCELLED",
] as const;
export const PLATFORM_OPTIONS: {
  value: SocialProvider;
  label: string;
}[] = [
  {
    value: "INSTAGRAM",
    label: "Instagram",
  },
  {
    value: "FACEBOOK",
    label: "Facebook",
  },
  {
    value: "LINKEDIN",
    label: "LinkedIn",
  },
  {
    value: "X",
    label: "X",
  },
];

export type PostsStatusFilter = (typeof POST_STATUS_VALUES)[number];

export const PLATFORM_VALUES: SocialProvider[] = [
  "INSTAGRAM",
  "FACEBOOK",
  "LINKEDIN",
  "X",
];

export const SORT_OPTIONS = [
  {
    value: "updatedAt:desc",
    sortBy: "updatedAt" as const,
    sortDir: "desc" as const,
    label: "Recently updated",
  },
  {
    value: "createdAt:desc",
    sortBy: "createdAt" as const,
    sortDir: "desc" as const,
    label: "Newest",
  },
  {
    value: "scheduledAt:asc",
    sortBy: "scheduledAt" as const,
    sortDir: "asc" as const,
    label: "Scheduled soonest",
  },
  {
    value: "scheduledAt:desc",
    sortBy: "scheduledAt" as const,
    sortDir: "desc" as const,
    label: "Scheduled latest",
  },
] as const;

export type PostsUrlState = {
  status: PostsStatusFilter;
  platform: SocialProvider | undefined;
  search: string;
  createdFrom: string;
  createdTo: string;
  page: number;
  sortBy: "createdAt" | "scheduledAt" | "updatedAt";
  sortDir: "asc" | "desc";
};

function isStatusFilter(value: string): value is PostsStatusFilter {
  return POST_STATUS_VALUES.includes(value as PostsStatusFilter);
}

function isSocialProvider(value: string): value is SocialProvider {
  return PLATFORM_VALUES.includes(value as SocialProvider);
}

function isSortOption(value: string) {
  return SORT_OPTIONS.some((option) => option.value === value);
}

export function readPostsUrlState(
  searchParams: URLSearchParams,
): PostsUrlState {
  const rawStatus = searchParams.get("status") ?? "ALL";

  const rawPlatform = searchParams.get("platform");

  const rawSearch = searchParams.get("search") ?? "";

  const rawCreatedFrom = searchParams.get("createdFrom") ?? "";
  const rawCreatedTo = searchParams.get("createdTo") ?? "";

  const rawPage = Number(searchParams.get("page") ?? "1");

  const rawSort = searchParams.get("sort") ?? "updatedAt:desc";

  const status = isStatusFilter(rawStatus) ? rawStatus : "ALL";

  const platform =
    rawPlatform && isSocialProvider(rawPlatform) ? rawPlatform : undefined;

  const sortOption = isSortOption(rawSort)
    ? SORT_OPTIONS.find((option) => option.value === rawSort)
    : SORT_OPTIONS[0];

  return {
    status,
    platform,
    search: rawSearch,
    createdFrom: rawCreatedFrom,
    createdTo: rawCreatedTo,
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    sortBy: sortOption!.sortBy,
    sortDir: sortOption!.sortDir,
  };
}
