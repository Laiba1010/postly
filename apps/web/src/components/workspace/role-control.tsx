"use client";

import type { ComponentType } from "react";
import { Edit3, Eye, Loader2, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { cn } from "@/lib/utils";
import type { Member } from "@/lib/api/members";

type RoleConfig = {
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const ROLE_CONFIG: Record<Member["role"], RoleConfig> = {
  OWNER: {
    label: "Owner",
    icon: ShieldCheck,
  },
  EDITOR: {
    label: "Editor",
    icon: Edit3,
  },
  VIEWER: {
    label: "Viewer",
    icon: Eye,
  },
};

/**
 * Shared visual foundation for every role.
 *
 * Keeping the same width/height across Badge and SelectTrigger
 * prevents the Role column from visually jumping between states.
 */
const ROLE_BASE_CLASSES =
  "inline-flex h-9 w-[104px] items-center gap-1.5 rounded-full px-3 text-xs font-medium";

/**
 * Non-editable role appearance.
 *
 * Owner uses this because the owner cannot be changed through
 * this control.
 */
const ROLE_BADGE_CLASSES = "border border-border bg-muted/50 text-foreground";

/**
 * Editable role appearance.
 *
 * The subtle border/background makes it look like an interactive
 * control without making it visually heavier than the rest of
 * the table.
 */
const ROLE_TRIGGER_CLASSES =
  "border border-border bg-background text-foreground shadow-none " +
  "hover:bg-muted/50 " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring " +
  "data-[state=open]:bg-muted/50";

interface RoleControlProps {
  role: Member["role"];
  editable: boolean;
  disabled?: boolean;
  loading?: boolean;
  onChange?: (role: Member["role"]) => void;
}

export function RoleControl({
  role,
  editable,
  disabled = false,
  loading = false,
  onChange,
}: RoleControlProps) {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;

  /*
   * OWNER is intentionally rendered as a badge.
   *
   * It is not editable, so it should not visually pretend to
   * be an interactive control.
   */
  if (!editable) {
    return (
      <Badge
        className={cn(
          ROLE_BASE_CLASSES,
          ROLE_BADGE_CLASSES,
          "justify-start h-9 bg-transparent border-none p-0",
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

        <span className="truncate">{config.label}</span>
      </Badge>
    );
  }

  return (
    <Select
      value={role}
      disabled={disabled || loading}
      onValueChange={(value) => {
        if (!value || value === role) return;

        onChange?.(value as Member["role"]);
      }}
    >
      <SelectTrigger
        aria-label={`Change role from ${config.label}`}
        className={cn(
          ROLE_BASE_CLASSES,
          ROLE_TRIGGER_CLASSES,
          "justify-center cursor-pointer",
          (disabled || loading) && "cursor-not-allowed opacity-60",
        )}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}

        <SelectValue>{config.label}</SelectValue>
      </SelectTrigger>

      <SelectContent align="start">
        <SelectItem value="EDITOR">
          <div className="flex items-center gap-2">
            <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Editor</span>
          </div>
        </SelectItem>

        <SelectItem value="VIEWER">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Viewer</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
