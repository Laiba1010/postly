"use client";

import { useMemo } from "react";
import { Check, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AccountOption {
  id: string;
  name: string;
  platform: "TWITTER" | "LINKEDIN" | "INSTAGRAM" | "FACEBOOK";
  handle: string;
}

interface AccountSelectorProps {
  accounts: AccountOption[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  disabled?: boolean;
}

export function AccountSelector({
  accounts,
  selectedIds,
  onChange,
  disabled = false,
}: AccountSelectorProps) {
  const allAccountIds = useMemo(() => accounts.map((a) => a.id), [accounts]);
  const isAllSelected =
    accounts.length > 0 && selectedIds.length === accounts.length;
  const isNoneSelected = selectedIds.length === 0;

  const handleSelectAll = () => onChange(allAccountIds);
  const handleDeselectAll = () => onChange([]);

  const toggleAccount = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">
            Target Channels
          </span>
          <Badge variant="secondary" className="text-xs">
            {selectedIds.length} / {accounts.length}
          </Badge>
        </div>

        {/* Shortcuts */}
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={disabled || isAllSelected}
            className="font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-40"
          >
            Select All
          </button>
          <span className="text-muted-foreground">•</span>
          <button
            type="button"
            onClick={handleDeselectAll}
            disabled={disabled || isNoneSelected}
            className="font-medium text-muted-foreground hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-40"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Account Chips */}
      <div className="flex flex-wrap gap-2">
        {accounts.map((account) => {
          const isSelected = selectedIds.includes(account.id);
          return (
            <button
              key={account.id}
              type="button"
              disabled={disabled}
              onClick={() => toggleAccount(account.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "border-primary bg-primary/10 text-primary dark:bg-primary/20"
                  : "border-border bg-background text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <div
                className={cn(
                  "flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40",
                )}
              >
                {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
              </div>
              <span>{account.name}</span>
              <span className="text-[10px] opacity-60">
                ({account.platform})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
