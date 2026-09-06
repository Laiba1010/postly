"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { AppSidebarNav } from "./app-sidebar-nav";
import { AppHeader } from "./app-header";
import { UserMenu } from "./user-menu";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          {/* Brand */}
          <div className="flex items-center  group-data-[collapsible=icon]:justify-center gap-2 px-2 pt-1.5 group-data-[collapsible=icon]:px-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              P
            </div>

            <span className="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
              Postly
            </span>
          </div>

          {/* Workspace */}
          <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
            <WorkspaceSwitcher />
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 group-data-[collapsible=icon]:px-0">
          <AppSidebarNav />
        </SidebarContent>

        <SidebarFooter>
          <UserMenu />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <AppHeader />

        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
