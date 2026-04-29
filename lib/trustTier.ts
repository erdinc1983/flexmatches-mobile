/**
 * Trust tier — accumulated-trust signal visible on every user surface.
 *
 * The DB owns the canonical value via a generated column on users
 * (see supabase/sql/16_trust_tier.sql). This module mirrors the same
 * thresholds for places where the client computes from raw fields
 * locally (e.g. constructed test users, optimistic UI). Keep both
 * definitions in sync.
 *
 * Tiers (positive-signal, no scarlet letter):
 *   new       — default; no completed sessions yet
 *   active    — 3+ sessions completed
 *   trusted   — 10+ sessions, reliability ≥ 80, ≤ 1 report
 *   vouched   — 20+ sessions, reliability ≥ 90, 0 reports
 */

export type TrustTier = "new" | "active" | "trusted" | "vouched";

export type TrustTierMeta = {
  label:       string;   // pill copy (e.g. "Trusted")
  color:       string;   // foreground / accent
  bg:          string;   // pill background (semi-transparent)
  border:      string;   // pill border
  description: string;   // tooltip / accessibility
};

export const TRUST_TIER_META: Record<TrustTier, TrustTierMeta> = {
  new: {
    label:       "New",
    color:       "#9CA3AF",   // gray-400 — quiet, not negative
    bg:          "rgba(156,163,175,0.14)",
    border:      "rgba(156,163,175,0.30)",
    description: "Just joined — no completed sessions yet",
  },
  active: {
    label:       "Active",
    color:       "#3B82F6",   // blue-500 — first signal of real use
    bg:          "rgba(59,130,246,0.14)",
    border:      "rgba(59,130,246,0.30)",
    description: "Has completed at least 3 partner sessions",
  },
  trusted: {
    label:       "Trusted",
    color:       "#22C55E",   // green-500 — accumulated reliability
    bg:          "rgba(34,197,94,0.14)",
    border:      "rgba(34,197,94,0.32)",
    description: "10+ sessions, high reliability, clean record",
  },
  vouched: {
    label:       "Vouched",
    color:       "#F59E0B",   // amber-500 — top tier, glow
    bg:          "rgba(245,158,11,0.16)",
    border:      "rgba(245,158,11,0.40)",
    description: "20+ sessions, near-perfect reliability, no reports",
  },
};

/**
 * Compute tier from raw fields. Use only when the DB-computed value is
 * unavailable (e.g. constructed test rows). For real users, prefer the
 * `trust_tier` field returned by SELECT or the get_nearby_users RPC —
 * the DB has fewer ways to drift.
 */
export function computeTrustTier(
  sessionsCompleted: number | null | undefined,
  reliabilityScore: number | null | undefined,
  reportsReceived:  number | null | undefined,
): TrustTier {
  const s = sessionsCompleted ?? 0;
  const r = reliabilityScore ?? 100;
  const x = reportsReceived  ?? 0;
  if (s >= 20 && r >= 90 && x === 0) return "vouched";
  if (s >= 10 && r >= 80 && x <= 1) return "trusted";
  if (s >= 3) return "active";
  return "new";
}

/**
 * Coerce an unknown string from the server into a TrustTier, defaulting
 * to "new" for unrecognized values. Use when reading from rows that may
 * predate the column being added.
 */
export function asTrustTier(v: unknown): TrustTier {
  return v === "vouched" || v === "trusted" || v === "active" || v === "new"
    ? v
    : "new";
}
