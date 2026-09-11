"use client";

import { ArrowLeft, ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MediaItem {
  id: string;
  url: string;
  type: "IMAGE" | "VIDEO";
  width?: number;
  height?: number;
}

interface MediaReorderListProps {
  items: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export function MediaReorderList({
  items,
  onChange,
  onRemove,
  disabled = false,
}: MediaReorderListProps) {
  if (items.length === 0) return null;

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length) return;
    const updated = [...items];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Attached Media ({items.length}/4)</span>
        <span>Reorder attachments before saving</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="group relative flex flex-col overflow-hidden rounded-lg border bg-card"
          >
            {/* Image / Video Thumbnail */}
            <div className="relative aspect-square w-full bg-muted">
              {item.type === "IMAGE" ? (
                <img
                  src={item.url}
                  alt={`Attachment ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <video
                  src={item.url}
                  className="h-full w-full object-cover"
                  muted
                />
              )}

              {/* Index Indicator */}
              <span className="absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-[10px] font-bold backdrop-blur-sm">
                {index + 1}
              </span>

              {/* Delete Trigger */}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                disabled={disabled}
                onClick={() => onRemove(item.id)}
                className="absolute top-2 right-2 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            {/* Reorder Controls */}
            <div className="flex items-center justify-between border-t bg-accent/40 px-2 py-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || index === 0}
                onClick={() => moveItem(index, index - 1)}
                className="h-6 w-6"
                aria-label="Move left"
              >
                <ArrowLeft className="h-3 w-3" />
              </Button>
              <span className="text-[10px] font-medium text-muted-foreground">
                Slot {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || index === items.length - 1}
                onClick={() => moveItem(index, index + 1)}
                className="h-6 w-6"
                aria-label="Move right"
              >
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
