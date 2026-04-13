/**
 * sportPhotos.ts — Sport-accurate Unsplash photo mapping.
 *
 * Keys MUST match the lowercase version of activity names used in ACTIVITY_CATEGORIES
 * in circles.tsx: "gym", "crossfit", "pilates", "yoga", "running", "cycling",
 * "swimming", "soccer", "basketball", "tennis", "boxing", "chess", "board games",
 * "hiking", "climbing", "kayaking"
 *
 * Photo IDs verified from Unsplash page slugs (format: images.unsplash.com/{slug}).
 */

export const SPORT_PHOTOS: Record<string, string> = {
  // ── Fitness ───────────────────────────────────────────────────────────────────
  gym:           "https://images.unsplash.com/Dueawl5Q75s?w=900&q=80",
  crossfit:      "https://images.unsplash.com/Ovlel6acNac?w=900&q=80",
  pilates:       "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=900&q=80",
  yoga:          "https://images.unsplash.com/VLpbB4YlNiw?w=900&q=80",
  weightlifting: "https://images.unsplash.com/Dueawl5Q75s?w=900&q=80",

  // ── Ball sports ───────────────────────────────────────────────────────────────
  soccer:        "https://images.unsplash.com/AaGE_R9IYAA?w=900&q=80",
  football:      "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=900&q=80",
  basketball:    "https://images.unsplash.com/oXS1f0uZYV4?w=900&q=80",
  volleyball:    "https://images.unsplash.com/ilqtSNQ3PFY?w=900&q=80",
  tennis:        "https://images.unsplash.com/pr9DnsuyoGs?w=900&q=80",

  // ── Combat ────────────────────────────────────────────────────────────────────
  boxing:        "https://images.unsplash.com/lJxnrrjwvc8?w=900&q=80",
  "martial arts":"https://images.unsplash.com/photo-1555597673-b21d5c935865?w=900&q=80",

  // ── Cardio / endurance ────────────────────────────────────────────────────────
  running:       "https://images.unsplash.com/ttbCwN_mWic?w=900&q=80",
  cycling:       "https://images.unsplash.com/VfUN94cUy4o?w=900&q=80",
  swimming:      "https://images.unsplash.com/ZbbhkQ0M2AM?w=900&q=80",
  rowing:        "https://images.unsplash.com/photo-1527056263037-40b4b3a2f365?w=900&q=80",

  // ── Outdoor / adventure ───────────────────────────────────────────────────────
  hiking:        "https://images.unsplash.com/jVY1KeJ6RCY?w=900&q=80",
  climbing:      "https://images.unsplash.com/XSEazbZB0WY?w=900&q=80",
  kayaking:      "https://images.unsplash.com/nBNROOkE0W8?w=900&q=80",

  // ── Mind games ────────────────────────────────────────────────────────────────
  chess:         "https://images.unsplash.com/nAjil1z3eLk?w=900&q=80",
  "board games": "https://images.unsplash.com/nAjil1z3eLk?w=900&q=80",

  // ── Fallback ──────────────────────────────────────────────────────────────────
  default:       "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=900&q=80",
};

/**
 * Look up a sport photo. Tries `sport` first (exact match, then substring),
 * then falls back to `name` (e.g. circle name "Sunday Soccer" → soccer photo).
 * Guaranteed to return a non-empty string.
 */
export function getSportPhoto(sport?: string | null, name?: string | null): string {
  const candidates = [sport, name].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const lower = candidate.toLowerCase().trim();

    // 1. Exact match ("Soccer" → "soccer", "CrossFit" → "crossfit", etc.)
    if (SPORT_PHOTOS[lower]) return SPORT_PHOTOS[lower];

    // 2. Substring match ("Sunday Soccer" → "soccer", "Trail Running" → "running")
    for (const key of Object.keys(SPORT_PHOTOS)) {
      if (key === "default") continue;
      if (lower.includes(key)) return SPORT_PHOTOS[key];
    }
  }

  return SPORT_PHOTOS.default;
}
