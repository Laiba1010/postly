export interface PlatformRule {
  provider: "instagram" | "facebook" | "linkedin" | "twitter";
  displayName: string;
  maxCharacters: number;
  maxMediaItems: number;
  supportedMediaTypes: string[];
  urlCharacterWeight: number | null; // e.g. Twitter t.co fixed 23 chars
}

export interface PlatformValidationError {
  provider: string;
  code: "CHARACTER_LIMIT_EXCEEDED" | "MEDIA_LIMIT_EXCEEDED";
  message: string;
}

export const PLATFORM_RULES: Record<string, PlatformRule> = {
  twitter: {
    provider: "twitter",
    displayName: "X (Twitter)",
    maxCharacters: 280,
    maxMediaItems: 4,
    supportedMediaTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/quicktime",
    ],
    urlCharacterWeight: 23,
  },
  instagram: {
    provider: "instagram",
    displayName: "Instagram",
    maxCharacters: 2200,
    maxMediaItems: 4,
    supportedMediaTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/quicktime",
    ],
    urlCharacterWeight: null,
  },
  facebook: {
    provider: "facebook",
    displayName: "Facebook",
    maxCharacters: 63206,
    maxMediaItems: 4,
    supportedMediaTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/quicktime",
    ],
    urlCharacterWeight: null,
  },
  linkedin: {
    provider: "linkedin",
    displayName: "LinkedIn",
    maxCharacters: 3000,
    maxMediaItems: 4,
    supportedMediaTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/quicktime",
    ],
    urlCharacterWeight: null,
  },
};

export function calculateCharacterCount(
  text: string,
  provider: string,
): number {
  const rule = PLATFORM_RULES[provider];
  if (!rule || !rule.urlCharacterWeight) return text.length;

  // Replace URLs with dummy string of fixed length (e.g. 23 for Twitter t.co)
  const urlRegex = /https?:\/\/[^\s]+/g;
  const dummyUrl = "a".repeat(rule.urlCharacterWeight);
  return text.replace(urlRegex, dummyUrl).length;
}

/**
 * Validates text content and media count against selected platform destination rules.
 */
export function validateAgainstPlatformRules(
  content: string,
  destinations: { provider: string }[],
  mediaCount: number = 0,
): PlatformValidationError[] {
  const errors: PlatformValidationError[] = [];

  for (const destination of destinations) {
    const rule = PLATFORM_RULES[destination.provider];
    if (!rule) continue;

    const charCount = calculateCharacterCount(content, destination.provider);
    if (charCount > rule.maxCharacters) {
      errors.push({
        provider: destination.provider,
        code: "CHARACTER_LIMIT_EXCEEDED",
        message: `${rule.displayName} post exceeds limit of ${rule.maxCharacters} characters (current: ${charCount})`,
      });
    }

    if (mediaCount > rule.maxMediaItems) {
      errors.push({
        provider: destination.provider,
        code: "MEDIA_LIMIT_EXCEEDED",
        message: `${rule.displayName} allows a maximum of ${rule.maxMediaItems} media attachments (attached: ${mediaCount})`,
      });
    }
  }

  return errors;
}
