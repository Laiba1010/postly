"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";
import { useWorkspaces } from "@/lib/hooks/use-workspaces";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";

export function WorkspaceSwitcher() {
  const { data: workspaces } = useWorkspaces();
  const { activeWorkspaceId, setActiveWorkspaceId } = useWorkspaceStore();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(
    null,
  );

  const active = workspaces?.find(
    (workspace) => workspace.id === activeWorkspaceId,
  );

  if (!workspaces || workspaces.length === 0) {
    return null;
  }

  return (
    <div ref={setPortalContainer}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" className="w-full justify-between">
              <span className="truncate">
                {active?.name ?? "Select workspace"}
              </span>

              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          }
        />

        {portalContainer && (
          <DropdownMenuPortal container={portalContainer}>
            <DropdownMenuContent className="w-[220px]">
              {workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => setActiveWorkspaceId(workspace.id)}
                  className="justify-between"
                >
                  <span className="truncate">{workspace.name}</span>

                  {workspace.id === activeWorkspaceId && (
                    <Check className="h-4 w-4" />
                  )}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        )}
      </DropdownMenu>

      <CreateWorkspaceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
