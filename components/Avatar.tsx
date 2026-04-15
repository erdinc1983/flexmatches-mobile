import { Image } from "expo-image";

// Warm neutral blurhash — shows while image loads
const BLURHASH = "LKHBBd~q9F%M%MIUofRj00M{D%of";

const WEB_BASE      = "https://flexmatches.com";
const SUPABASE_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

// 12 male + 12 female cartoon avatars on the web server
const MALE_AVATARS   = Array.from({ length: 12 }, (_, i) => `${WEB_BASE}/avatars/male/m${i + 1}.jpeg`);
const FEMALE_AVATARS = Array.from({ length: 12 }, (_, i) => `${WEB_BASE}/avatars/female/f${i + 1}.jpeg`);
const ALL_AVATARS    = [...MALE_AVATARS, ...FEMALE_AVATARS]; // 24 total

function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

function cartoonAvatar(name: string, gender?: string | null): string {
  // Ensure a non-empty seed so hash is stable
  const seed = name?.trim() || "user";
  // Pick from the matching-gender pool when known. Unknown/other falls back
  // to the full 24-avatar pool (50/50 outcome — worse than matched but
  // better than no avatar at all). Bug before this change: a male user
  // could land on a female avatar because we always hashed into ALL.
  const pool =
    gender === "male"   ? MALE_AVATARS   :
    gender === "female" ? FEMALE_AVATARS :
                          ALL_AVATARS;
  return pool[nameHash(seed) % pool.length];
}

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
