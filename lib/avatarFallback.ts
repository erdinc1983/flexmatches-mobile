/**
 * cartoonAvatar — shared fallback avatar picker.
 *
 * Mara's call: gender-matched fallback when known, neutral pool when unknown.
 * Previously each Discover card duplicated this logic without a gender param,
 * so a male user could land on a female cartoon. Centralized here so every
 * peer-display surface uses the same rules.
 */

const WEB_BASE       = "https://flexmatches.com";
const MALE_AVATARS   = Array.from({ length: 12 }, (_, i) => `${WEB_BASE}/avatars/male/m${i + 1}.jpeg`);
const FEMALE_AVATARS = Array.from({ length: 12 }, (_, i) => `${WEB_BASE}/avatars/female/f${i + 1}.jpeg`);
const ALL_AVATARS    = [...MALE_AVATARS, ...FEMALE_AVATARS];

function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

export function cartoonAvatar(name: string | null | undefined, gender?: string | null): string {
  const seed = (name ?? "").trim() || "user";
  const pool =
    gender === "male"   ? MALE_AVATARS   :
    gender === "female" ? FEMALE_AVATARS :
                          ALL_AVATARS;
  return pool[nameHash(seed) % pool.length];
}
