import { PLATFORM_RULES } from '@postly/shared';

export { PLATFORM_RULES };

export type SocialProvider = keyof typeof PLATFORM_RULES;

export interface PlatformValidationError {
  provider: SocialProvider;
  reason: 'CONTENT_TOO_LONG' | 'TOO_MANY_MEDIA_ITEMS';
  message: string;
}

/**
 * The single authoritative validation function. The actual rule values
 * live in @postly/shared/platform-rules — both apps/api and apps/web
 * import from that one package, so there is exactly one source of truth
 * for the numbers themselves. This function contains backend-specific
 * validation logic and stays here rather than moving into the shared
 * package, since the frontend has its own lighter-weight live-counter
 * logic that doesn't need this exact function shape.
 */
export function validateAgainstPlatformRules(
  content: string,
  destinations: { provider: SocialProvider }[],
  mediaCount: number,
): PlatformValidationError[] {
  const errors: PlatformValidationError[] = [];
  const uniqueProviders = [...new Set(destinations.map((d) => d.provider))];

  for (const provider of uniqueProviders) {
    const rule = PLATFORM_RULES[provider];

    if (content.length > rule.maxCharacters) {
      errors.push({
        provider,
        reason: 'CONTENT_TOO_LONG',
        message: `Content exceeds the ${rule.maxCharacters}-character limit for ${provider}`,
      });
    }

    if (mediaCount > rule.maxMediaItems) {
      errors.push({
        provider,
        reason: 'TOO_MANY_MEDIA_ITEMS',
        message: `${provider} allows a maximum of ${rule.maxMediaItems} media items`,
      });
    }
  }

  return errors;
}
