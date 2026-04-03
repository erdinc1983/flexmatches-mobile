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

function cartoonAvatar(name: string): string {
  // Ensure a non-empty seed so hash is stable
  const seed = name?.trim() || "user";
  return ALL_AVATARS[nameHash(seed) % ALL_AVATARS.length];
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
  size?: number;
};

export function Avatar({ url, name, size = 48 }: Props) {
  const radius = size / 2;
  const src    = resolveUrl(url) ?? cartoonAvatar(name);

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
