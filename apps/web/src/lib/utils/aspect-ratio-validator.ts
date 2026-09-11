export interface MediaMetadata {
  id: string;
  width?: number;
  height?: number;
  type: "IMAGE" | "VIDEO";
}

export interface AspectRatioWarning {
  mediaId: string;
  platform: string;
  recommendedRatio: string;
  currentRatio: string;
  message: string;
}

const PLATFORM_RECOMMENDED_RATIOS: Record<
  string,
  { name: string; targetRatio: number; ratioLabel: string }
> = {
  INSTAGRAM: {
    name: "Instagram Feed",
    targetRatio: 1.0,
    ratioLabel: "1:1 or 4:5",
  },
  TWITTER: { name: "X (Twitter)", targetRatio: 1.77, ratioLabel: "16:9" },
  LINKEDIN: {
    name: "LinkedIn",
    targetRatio: 1.91,
    ratioLabel: "1.91:1 or 1:1",
  },
  FACEBOOK: { name: "Facebook", targetRatio: 1.91, ratioLabel: "1.91:1" },
};

export function checkAspectRatioWarnings(
  mediaList: MediaMetadata[],
  targetPlatforms: string[],
): AspectRatioWarning[] {
  const warnings: AspectRatioWarning[] = [];

  for (const media of mediaList) {
    if (!media.width || !media.height) continue;

    const actualRatio = media.width / media.height;
    const actualRatioFormatted = actualRatio.toFixed(2);

    for (const platform of targetPlatforms) {
      const config = PLATFORM_RECOMMENDED_RATIOS[platform];
      if (!config) continue;

      // Allow 15% tolerance before flagging a soft warning
      const ratioDiff = Math.abs(actualRatio - config.targetRatio);
      if (ratioDiff > 0.35) {
        warnings.push({
          mediaId: media.id,
          platform: config.name,
          recommendedRatio: config.ratioLabel,
          currentRatio: `${actualRatioFormatted}:1 (${media.width}x${media.height})`,
          message: `${media.type === "IMAGE" ? "Image" : "Video"} aspect ratio (${actualRatioFormatted}:1) differs from ${config.name}'s recommended ratio (${config.ratioLabel}). It may be auto-cropped.`,
        });
      }
    }
  }

  return warnings;
}
