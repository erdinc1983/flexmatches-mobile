import { Image } from "expo-image";
// cartoonAvatar lives in lib/avatarFallback.ts (single source of truth,
// shared with the Discover card components).
import { cartoonAvatar } from "../lib/avatarFallback";

// Warm neutral blurhash — shows while image loads
const BLURHASH = "LKHBBd~q9F%M%MIUofRj00M{D%of";

const WEB_BASE      = "https://flexmatches.com";
const SUPABASE_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

export function resolveUrl(url: string | null | undefined): string | null {
  if (!url || !url.trim()) return null;
  if (url.startsWith("http"))  return url;
  if (url.startsWith("/"))     return `${WEB_BASE}${url}`;
  // Supabase storage relative path (e.g. "avatars/user123.jpg")
  if (SUPABASE_BASE) return `${SUPABASE_BASE}/storage/v1/object/public/${url}`;
  return null;
}

type Props = {
  url?: string | null;
  name: string;
  /** When provided, the fallback cartoon avatar is picked from the matching-
   * gender pool. Without it the hash picks from all 24 and can mismatch. */
  gender?: string | null;
  size?: number;
};

export function Avatar({ url, name, gender, size = 48 }: Props) {
  const radius = size / 2;
  const src    = resolveUrl(url) ?? cartoonAvatar(name, gender);

  return (
    <Image
      source={{ uri: src }}
      placeholder={{ blurhash: BLURHASH }}
      cachePolicy="disk"
      transition={200}
      style={{ width: size, height: size, borderRadius: radius }}
      contentFit="cover"
    />
  );
}
