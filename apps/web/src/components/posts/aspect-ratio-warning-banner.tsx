"use client";

import { AlertTriangle } from "lucide-react";
import { AspectRatioWarning } from "@/lib/utils/aspect-ratio-validator";

interface AspectRatioWarningBannerProps {
  warnings: AspectRatioWarning[];
}

export function AspectRatioWarningBanner({
  warnings,
}: AspectRatioWarningBannerProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
      <div className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
        <span>Aspect Ratio Warnings ({warnings.length})</span>
      </div>
      <ul className="mt-2 space-y-1 pl-6 list-disc">
        {warnings.map((w, index) => (
          <li key={`${w.mediaId}-${w.platform}-${index}`}>
            <span className="font-medium">{w.platform}:</span> {w.message}
          </li>
        ))}
      </ul>
    </div>
  );
}