"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";

import { useMembers } from "@/lib/hooks/use-members";
import { useWorkspaceContext } from "@/lib/hooks/use-workspace-context";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { updateMemberRole, removeMember, type Member } from "@/lib/api/members";
import { ApiError } from "@/lib/api/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, Edit3, Eye } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const ROLE_CONFIG: Record<
  Member["role"],
  {
    variant: "default" | "secondary" | "outline";
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  OWNER: {
    variant: "default",
    label: "Owner",
    icon: ShieldCheck,
  },
  EDITOR: {
    variant: "secondary",
    label: "Editor",
    icon: Edit3,
  },
  VIEWER: {
    variant: "outline",
    label: "Viewer",
    icon: Eye,
  },
};

function RoleBadge({ role }: { role: Member["role"] }) {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className="inline-flex items-center gap-1.5 font-medium px-2 py-0.5 text-xs tracking-wide"
    >
      <Icon className="h-3 w-3 opacity-70" />
      <span>{config.label}</span>
    </Badge>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const CHART_VARIANTS = [
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/15 text-chart-2",
  "bg-chart-3/15 text-chart-3",
  "bg-chart-4/15 text-chart-4",
  "bg-chart-5/15 text-chart-5",
] as const;

function getAvatarChartStyle(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CHART_VARIANTS.length;
  return CHART_VARIANTS[index];
}

export default function TeamPage() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const { data: workspace } = useWorkspaceContext(activeWorkspaceId);
  const { data: members, isLoading } = useMembers(activeWorkspaceId);
  const queryClient = useQueryClient();
  const [errorByMember, setErrorByMember] = useState<Record<string, string>>(
    {},
  );

  const isOwner = workspace?.role === "OWNER";

  const roleMutation = useMutation({
    mutationFn: ({
      membershipId,
      role,
    }: {
      membershipId: string;
      role: Member["role"];
    }) => updateMemberRole(activeWorkspaceId!, membershipId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["members", activeWorkspaceId],
      });
    },
    onError: (err, variables) => {
      const message =
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.";
      setErrorByMember((prev) => ({
        ...prev,
        [variables.membershipId]: message,
      }));
    },
  });

  const removeMutation = useMutation({
    mutationFn: (membershipId: string) =>
      removeMember(activeWorkspaceId!, membershipId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["members", activeWorkspaceId],
      });
    },
  });

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">
            {members?.length ?? 0} member{members?.length === 1 ? "" : "s"} in
            this workspace
          </p>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader className="bg-primary text-primary-foreground">
            <TableRow className="hover:bg-primary/90 border-b-0">
              <TableHead className="text-primary-foreground font-medium">
                Member
              </TableHead>
              <TableHead className="text-primary-foreground font-medium">
                Email
              </TableHead>
              <TableHead className="text-primary-foreground font-medium">
                Role
              </TableHead>
              {isOwner && (
                <TableHead className="text-right text-primary-foreground font-medium">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members?.map((member) => (
              <TableRow key={member.membershipId}>
                <TableCell className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback
                      className={cn(
                        "font-semibold text-xs border border-current/20",
                        getAvatarChartStyle(member.membershipId),
                      )}
                    >
                      {initials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm">{member.name}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.email}
                </TableCell>
                <TableCell>
                  {isOwner && member.role !== "OWNER" ? (
                    <div>
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          roleMutation.mutate({
                            membershipId: member.membershipId,
                            role: value as Member["role"],
                          })
                        }
                      >
                        <SelectTrigger className="w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EDITOR">Editor</SelectItem>
                          <SelectItem value="VIEWER">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      {errorByMember[member.membershipId] && (
                        <p className="text-xs text-destructive mt-1">
                          {errorByMember[member.membershipId]}
                        </p>
                      )}
                    </div>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
                </TableCell>
                {isOwner && (
                  <TableCell className="text-right">
                    {member.role !== "OWNER" && (
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                            >
                              Remove
                            </Button>
                          }
                        />
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Remove {member.name}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              They will immediately lose access to this
                              workspace. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                removeMutation.mutate(member.membershipId)
                              }
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
