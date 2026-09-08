import type { SocialProvider } from "@/lib/api/social-connections";
import { FaFacebook, FaInstagram, FaLinkedin } from "react-icons/fa";
import { XLogo } from "./x-logo";
export const PROVIDER_META: Record<
  SocialProvider,
  { label: string; icon: any }
> = {
  INSTAGRAM: { label: "Instagram", icon: FaInstagram },
  FACEBOOK: { label: "Facebook", icon: FaFacebook },
  LINKEDIN: { label: "LinkedIn", icon: FaLinkedin },
  X: { label: "X", icon: XLogo },
};

export const ALL_PROVIDERS: SocialProvider[] = [
  "INSTAGRAM",
  "FACEBOOK",
  "LINKEDIN",
  "X",
];
