import { StyleSheet } from "react-native";
import { Image } from "expo-image";

const WEB_BASE = "https://flexmatches.com";

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
  return ALL_AVATARS[nameHash(name) % ALL_AVATARS.length];
}

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return `${WEB_BASE}${url}`;
  return null;
}

type Props = {
  url?: string | null;
  name: string;
  size?: number;
};

export function Avatar({ url, name, size = 48 }: Props) {
  const radius = size / 2;
  const src    = resolveUrl(url) ?? cartoonAvatar(name ?? "?");

  return (
    <Image
      source={{ uri: src }}
      style={{ width: size, height: size, borderRadius: radius }}
      contentFit="cover"
    />
  );
}

const styles = StyleSheet.create({});
