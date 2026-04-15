/**
 * Pro entitlement helpers.
 *
 * The server is the source of truth (cron `referral-pro-expiry` flips
 * is_pro=false hourly when pro_expires_at < now), but until that cron
 * fires the client may have a stale row showing is_pro=true even though
 * the user's referral Pro window has closed. isProActive() is the
 * client-safe gate to use everywhere we display or grant Pro features.
 */

type ProShape = {
  is_pro:         boolean | null;
  pro_source:     string | null;
  pro_expires_at: string | null;
};

/**
 * True when the user genuinely has Pro right now:
 *   • Founding members: forever
 *   • Anything else (referral_3, referral_6, paid): only while
 *     pro_expires_at is in the future
 *   • Missing/null pro_source with is_pro=true: trust is_pro (legacy rows
 *     before pro_source was added — harmless).
 */
export function isProActive(u: ProShape | null | undefined): boolean {
  if (!u || !u.is_pro) return false;
  if (u.pro_source === "founding_member") return true;
  if (!u.pro_expires_at) return true; // legacy rows, no expiry recorded
  return new Date(u.pro_expires_at).getTime() > Date.now();
}

/**
 * Human label for the Pro badge:
 *   founding_member → "FOUNDING"
 *   referral_3 / _6 → "PRO"
 *   anything else   → "PRO"
 */
export function proBadgeLabel(source: string | null | undefined): string {
  return source === "founding_member" ? "FOUNDING" : "PRO";
}
