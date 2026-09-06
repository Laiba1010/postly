"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ROUTE_TITLES } from "./nav-items";

export function AppHeader() {
  const pathname = usePathname();
  const title = ROUTE_TITLES[pathname] ?? "";

  return (
    <header className="flex h-14 items-center gap-3 border-b px-4">
      <SidebarTrigger aria-label="Toggle sidebar" />
      <h1 className="text-sm font-medium">{title}</h1>
    </header>
  );
}
