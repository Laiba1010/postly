"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useMembers } from "@/lib/hooks/use-members";
import { useWorkspaceContext } from "@/lib/hooks/use-workspace-context";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { removeMember, updateMemberRole, type Member } from "@/lib/api/members";
import { ApiError } from "@/lib/api/client";

import { Button } from "@/components/ui/button";
import { InviteMemberDialog } from "@/components/workspace/invite-member-dialog";
import { PendingInvitations } from "@/components/workspace/pending-invitations";
import { RoleControl } from "@/components/workspace/role-control";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Uses the existing shadcn chart tokens from your theme.
 *
 * We intentionally keep avatar styling separate from role styling.
 */
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

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function TeamPage() {
  const activeWorkspaceId = useWorkspaceStore(
    (state) => state.activeWorkspaceId,
  );

  const { data: workspace } = useWorkspaceContext(activeWorkspaceId);

  const { data: members, isLoading, isError } = useMembers(activeWorkspaceId);

  const queryClient = useQueryClient();

  /**
   * Stores errors per membership instead of showing one global error.
   *
   * This is important because one failed role update should only
   * affect that particular row.
   */
  const [errorByMember, setErrorByMember] = useState<Record<string, string>>(
    {},
  );

  /**
   * Tracks which member is currently being updated.
   *
   * We don't want the entire table to look disabled when only
   * one member's role is changing.
   */
  const [updatingMembershipId, setUpdatingMembershipId] = useState<
    string | null
  >(null);

  const isOwner = workspace?.role === "OWNER";

  /* ------------------------------------------------------------------------ */
  /* Role mutation                                                            */
  /* ------------------------------------------------------------------------ */

  const roleMutation = useMutation({
    mutationFn: ({
      membershipId,
      role,
    }: {
      membershipId: string;
      role: Member["role"];
    }) => {
      return updateMemberRole(activeWorkspaceId!, membershipId, role);
    },

    onMutate: ({ membershipId }) => {
      setUpdatingMembershipId(membershipId);

      /**
       * Remove an old error before attempting the new request.
       */
      setErrorByMember((previous) => {
        const next = { ...previous };

        delete next[membershipId];

        return next;
      });
    },

    onSuccess: (_, variables) => {
      /**
       * Refresh only this workspace's member list.
       */
      queryClient.invalidateQueries({
        queryKey: ["members", activeWorkspaceId],
      });

      /**
       * Clean up any previous error for this member.
       */
      setErrorByMember((previous) => {
        const next = { ...previous };

        delete next[variables.membershipId];

        return next;
      });
    },

    onError: (error, variables) => {
      const message =
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again.";

      setErrorByMember((previous) => ({
        ...previous,
        [variables.membershipId]: message,
      }));
    },

    onSettled: () => {
      setUpdatingMembershipId(null);
    },
  });

  /* ------------------------------------------------------------------------ */
  /* Remove member mutation                                                   */
  /* ------------------------------------------------------------------------ */

  const removeMutation = useMutation({
    mutationFn: (membershipId: string) => {
      return removeMember(activeWorkspaceId!, membershipId);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["members", activeWorkspaceId],
      });
    },
  });

  /* ------------------------------------------------------------------------ */
  /* Loading state                                                             */
  /* ------------------------------------------------------------------------ */

  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">Loading team…</p>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Error state                                                               */
  /* ------------------------------------------------------------------------ */

  if (isError) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">
            Unable to load your team.
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            Please refresh the page and try again.
          </p>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="p-8">
      {/* ------------------------------------------------------------------ */}
      {/* Page header                                                         */}
      {/* ------------------------------------------------------------------ */}

      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {members?.length ?? 0} member
            {members?.length === 1 ? "" : "s"} in this workspace
          </p>
        </div>

        {isOwner && activeWorkspaceId && (
          <InviteMemberDialog workspaceId={activeWorkspaceId} />
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Team table                                                          */}
      {/* ------------------------------------------------------------------ */}

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          {/* -------------------------------------------------------------- */}
          {/* Header                                                         */}
          {/* -------------------------------------------------------------- */}

          <TableHeader className="bg-primary">
            <TableRow className="border-b-0 hover:bg-primary">
              <TableHead className="font-medium text-primary-foreground">
                Member
              </TableHead>

              <TableHead className="font-medium text-primary-foreground">
                Email
              </TableHead>

              <TableHead className="font-medium text-primary-foreground">
                Role
              </TableHead>

              {isOwner && (
                <TableHead className="text-right font-medium text-primary-foreground">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          {/* -------------------------------------------------------------- */}
          {/* Body                                                           */}
          {/* -------------------------------------------------------------- */}

          <TableBody>
            {members?.map((member) => {
              const isUpdating = updatingMembershipId === member.membershipId;

              const memberError = errorByMember[member.membershipId];

              const canEditRole = isOwner && member.role !== "OWNER";

              const canRemoveMember = isOwner && member.role !== "OWNER";

              return (
                <TableRow key={member.membershipId} className="group">
                  {/* ---------------------------------------------------- */}
                  {/* Member                                                 */}
                  {/* ---------------------------------------------------- */}

                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback
                          className={cn(
                            "border border-current/20 text-xs font-semibold",
                            getAvatarChartStyle(member.membershipId),
                          )}
                        >
                          {initials(member.name)}
                        </AvatarFallback>
                      </Avatar>

                      <span className="text-sm font-medium">{member.name}</span>
                    </div>
                  </TableCell>

                  {/* ---------------------------------------------------- */}
                  {/* Email                                                   */}
                  {/* ---------------------------------------------------- */}

                  <TableCell className="text-sm text-muted-foreground">
                    {member.email}
                  </TableCell>

                  {/* ---------------------------------------------------- */}
                  {/* Role                                                    */}
                  {/* ---------------------------------------------------- */}

                  <TableCell>
                    <div className="flex flex-col items-start">
                      <RoleControl
                        role={member.role}
                        editable={canEditRole}
                        loading={isUpdating}
                        disabled={roleMutation.isPending && !isUpdating}
                        onChange={(role) => {
                          roleMutation.mutate({
                            membershipId: member.membershipId,
                            role,
                          });
                        }}
                      />

                      {memberError && (
                        <p
                          role="alert"
                          className="mt-1.5 max-w-[220px] text-xs text-destructive"
                        >
                          {memberError}
                        </p>
                      )}
                    </div>
                  </TableCell>

                  {/* ---------------------------------------------------- */}
                  {/* Actions                                                 */}
                  {/* ---------------------------------------------------- */}

                  {isOwner && (
                    <TableCell className="text-right">
                      {canRemoveMember && (
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                                disabled={removeMutation.isPending}
                                onClick={() => {
                                  removeMutation.mutate(member.membershipId);
                                }}
                              >
                                {removeMutation.isPending
                                  ? "Removing…"
                                  : "Remove"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}

            {/* ------------------------------------------------------------ */}
            {/* Empty state                                                   */}
            {/* ------------------------------------------------------------ */}

            {(!members || members.length === 0) && (
              <TableRow>
                <TableCell
                  colSpan={isOwner ? 4 : 3}
                  className="h-24 text-center"
                >
                  <p className="text-sm text-muted-foreground">
                    No team members yet.
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Pending invitations                                                 */}
      {/* ------------------------------------------------------------------ */}

      {isOwner && activeWorkspaceId && (
        <PendingInvitations workspaceId={activeWorkspaceId} />
      )}
    </div>
  );
}
