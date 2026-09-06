import { FaInstagram, FaFacebook, FaLinkedin, FaTwitter } from "react-icons/fa";
import type { Platform } from "@/lib/mock/dashboard";

const PLATFORM_CONFIG: Record<
  Platform,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  INSTAGRAM: { label: "Instagram", icon: FaInstagram },
  FACEBOOK: { label: "Facebook", icon: FaFacebook },
  LINKEDIN: { label: "LinkedIn", icon: FaLinkedin },
  X: { label: "X", icon: FaTwitter },
};

export function PlatformBadge({ platform }: { platform: Platform }) {
  const config = PLATFORM_CONFIG[platform];
  const Icon = config.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}
