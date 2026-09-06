/**
 * Formats an ISO timestamp relative to now.
 * - Future dates: "In 3h", "In 2d"
 * - Past dates: "3h ago", "2d ago"
 * - Very recent past: "5 min ago"
 */
export function formatRelativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const isFuture = diffMs > 0;
  const absMs = Math.abs(diffMs);

  const minutes = Math.round(absMs / (1000 * 60));
  const hours = Math.round(absMs / (1000 * 60 * 60));
  const days = Math.round(absMs / (1000 * 60 * 60 * 24));

  let value: string;
  if (minutes < 60) {
    value = minutes <= 1 ? "1 min" : `${minutes} min`;
  } else if (hours < 24) {
    value = hours === 1 ? "1 hr" : `${hours} hr`;
  } else {
    value = days === 1 ? "1 day" : `${days} days`;
  }

  return isFuture ? `In ${value}` : `${value} ago`;
}
export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
