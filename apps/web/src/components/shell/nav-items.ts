import {
  LayoutDashboard,
  FileText,
  Calendar,
  Share2,
  Users,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Publishing",
    items: [
      { label: "Posts", href: "/posts", icon: FileText },
      { label: "Calendar", href: "/calendar", icon: Calendar },
    ],
  },
  {
    label: "Manage",
    items: [
      { label: "Social Accounts", href: "/social-accounts", icon: Share2 },
      { label: "Team", href: "/team", icon: Users },
    ],
  },
  {
    label: "Analytics",
    items: [{ label: "Analytics", href: "/analytics", icon: BarChart3 }],
  },
  {
    label: "Settings",
    items: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
];

/**
 * Flat route -> label lookup, derived from NAV_GROUPS so the sidebar
 * and header can never disagree about a page's title. Routes not
 * present in the sidebar (e.g. sub-pages like /posts/new) are added
 * as manual extras below.
 */
export const ROUTE_TITLES: Record<string, string> = {
  ...Object.fromEntries(
    NAV_GROUPS.flatMap((group) =>
      group.items.map((item) => [item.href, item.label]),
    ),
  ),
  "/posts/new": "New Post",
  "/workspace/new": "Create Workspace",
};
