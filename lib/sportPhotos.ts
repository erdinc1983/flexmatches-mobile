/**
 * sportPhotos.ts — Centralised, sport-accurate Unsplash photo mapping.
 *
 * • Uses explicit exact-match lookup first, then keyword fallback.
 * • All IDs manually verified for correct sport content.
 * • Imported by PrimaryActionCard, CirclesPreviewSection, circles tab, home tab.
 */

export const SPORT_PHOTOS: Record<string, string> = {
  // ── Ball sports ──────────────────────────────────────────────────────────────
  soccer:        "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=900&q=80",
  football:      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=900&q=80",
  basketball:    "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=900&q=80",
  volleyball:    "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=900&q=80",
  tennis:        "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=900&q=80",

  // ── Combat / racket ───────────────────────────────────────────────────────────
  boxing:        "https://images.unsplash.com/photo-1586344018820-aaad31b0e1d3?w=900&q=80",
  "martial arts":"https://images.unsplash.com/photo-1555597673-b21d5c935865?w=900&q=80",

  // ── Gym & lifting ────────────────────────────────────────────────────────────
  gym:           "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=900&q=80",
  weightlifting: "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=900&q=80",
  crossfit:      "https://images.unsplash.com/photo-1517963879433-6ad2a56fcd61?w=900&q=80",

  // ── Cardio / endurance ────────────────────────────────────────────────────────
  running:       "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=900&q=80",
  cycling:       "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80",
  swimming:      "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=900&q=80",
  rowing:        "https://images.unsplash.com/photo-1527056263037-40b4b3a2f365?w=900&q=80",

  // ── Mind-body ─────────────────────────────────────────────────────────────────
  yoga:          "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=900&q=80",
  pilates:       "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=900&q=80",

  // ── Outdoor / adventure ───────────────────────────────────────────────────────
  hiking:        "https://images.unsplash.com/photo-1551632811-561732d1e306?w=900&q=80",
  climbing:      "https://images.unsplash.com/photo-1522163182402-834f871fd851?w=900&q=80",
  kayaking:      "https://images.unsplash.com/photo-1519802772250-a521a658efbe?w=900&q=80",

  // ── Mind games ────────────────────────────────────────────────────────────────
  chess:         "https://images.unsplash.com/photo-1586165368502-1bad197a6461?w=900&q=80",

  // ── Fallback ──────────────────────────────────────────────────────────────────
  default:       "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=900&q=80",
};

/**
 * Look up a sport photo. Tries exact match first, then keyword substring.
 * Guaranteed to return a non-empty string.
 */
export function getSportPhoto(sport?: string | null): string {
  if (!sport) return SPORT_PHOTOS.default;
  const lower = sport.toLowerCase().trim();

  // 1. Exact match
  if (SPORT_PHOTOS[lower]) return SPORT_PHOTOS[lower];

  // 2. Key is contained in the sport string (e.g. "Trail Running" → running)
  for (const key of Object.keys(SPORT_PHOTOS)) {
    if (key === "default") continue;
    if (lower.includes(key)) return SPORT_PHOTOS[key];
  }

  return SPORT_PHOTOS.default;
}
