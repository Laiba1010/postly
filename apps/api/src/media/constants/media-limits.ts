export const MEDIA_LIMITS = {
  MAX_IMAGE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  MAX_VIDEO_SIZE_BYTES: 100 * 1024 * 1024, // 100MB
  MAX_MEDIA_PER_POST: 4,
  ALLOWED_IMAGE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ] as const,
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/quicktime'] as const,
  ORPHAN_TTL_HOURS: 24,
} as const;

export function extensionForMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
  };
  return map[mimeType] ?? '';
}
