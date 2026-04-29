/**
 * PersonCard
 *
 * Full-width photo-forward card — matches web PWA design language.
 *
 * Layout:
 *   ┌─────────────────────────────┐
 *   │  [PHOTO — full width]       │
 *   │  [GYM badge]   [XX% match]  │
 *   │                             │
 *   │  Name, Age                  │  ← gradient overlay
 *   │  [level] ● Active  · City   │
 *   └─────────────────────────────┘
 *   │ [🎯 reason] [⚡ reason]     │
 *   │ [Sport] [Sport] +N          │
 *   │ [       Connect       ]     │
 *   └─────────────────────────────┘
 */

import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../../lib/theme";
import { resolveUrl } from "../Avatar";
import { cartoonAvatar } from "../../lib/avatarFallback";
import { TrustTierBadge } from "../TrustTierBadge";

// ─── Types ────────────────────────────────────────────────────────────────────
export type RequestStatus = "none" | "pending" | "accepted";

export type DiscoverUser = {
  id:              string;
  username:        string;
  full_name:       string | null;
  avatar_url:      string | null;
  bio:             string | null;
  city:            string | null;
  fitness_level:   "beginner" | "intermediate" | "advanced" | null;
  age:             number | null;
  gender:          string | null;
  sports:          string[] | null;
  current_streak:  number;
  last_active:     string | null;
  is_at_gym:       boolean;
  availability:    Record<string, boolean> | null;
  training_intent: string | null;
  // lat/lng intentionally omitted for peer users — DiscoverUser is the peer
  // shape and exact peer coords must never reach the client. Caller's own
  // coords live separately on MyProfile (see app/(tabs)/discover.tsx).
  lat:                null;
  lng:                null;
  // Server-supplied distance (via get_nearby_users RPC). NULL when caller
  // has no coords or peer has no coords. Use this for distance UX instead
  // of computing client-side from raw coords.
  distance_km:        number | null;
  sessions_completed: number;
  reliability_score:  number;
  phone_verified:     boolean;
  /** Server-computed via generated column on users.trust_tier
   *  (see supabase/sql/16_trust_tier.sql). Falls back to "new" for any
   *  row that predates the column or returns an unrecognized value. */
  trust_tier:         "new" | "active" | "trusted" | "vouched";
  matchScore:         number;
  reasons:            string[];
  isNew:              boolean;
};

/**
 * Supabase column list for selecting a full DiscoverUser row.
 * Keep in sync with DiscoverUser fields. Use with .select(DISCOVER_USER_COLUMNS).
 *
 * Intentionally excludes lat/lng — peer-user coordinates must never be fetched
 * by the client. For nearby-user discovery use the get_nearby_users RPC, which
 * returns server-fuzzed marker coords and server-computed distance. Callers
 * that spread this through toDiscoverUser() get lat:null / lng:null, which is
 * the correct default.
 */
export const DISCOVER_USER_COLUMNS =
  "id, username, full_name, avatar_url, bio, city, fitness_level, age, gender, sports, current_streak, last_active, is_at_gym, availability, training_intent, sessions_completed, reliability_score, phone_verified, trust_tier";

/**
 * Build a DiscoverUser from a raw Supabase row. Fills required numeric/
 * boolean fields with safe defaults so callers never produce partial types.
 * Callers should spread their match-specific fields after: { ...toDiscoverUser(row), matchScore: 85, reasons: [...], isNew: true }
 */
export function toDiscoverUser(
  row: Record<string, any>,
  extras?: Partial<Pick<DiscoverUser, "matchScore" | "reasons" | "isNew">>
): DiscoverUser {
  return {
    id:                 row.id,
    username:           row.username,
    full_name:          row.full_name ?? null,
    avatar_url:         row.avatar_url ?? null,
    bio:                row.bio ?? null,
    city:               row.city ?? null,
    fitness_level:      row.fitness_level ?? null,
    age:                row.age ?? null,
    gender:             row.gender ?? null,
    sports:             row.sports ?? null,
    current_streak:     row.current_streak ?? 0,
    last_active:        row.last_active ?? null,
    is_at_gym:          row.is_at_gym ?? false,
    availability:       row.availability ?? null,
    training_intent:    row.training_intent ?? null,
    lat:                null,
    lng:                null,
    distance_km:        row.distance_km ?? null,
    sessions_completed: row.sessions_completed ?? 0,
    reliability_score:  row.reliability_score ?? 100,
    phone_verified:     row.phone_verified ?? false,
    trust_tier:         (row.trust_tier === "vouched" || row.trust_tier === "trusted" || row.trust_tier === "active" ? row.trust_tier : "new") as DiscoverUser["trust_tier"],
    matchScore:         extras?.matchScore ?? 0,
    reasons:            extras?.reasons ?? [],
    isNew:              extras?.isNew ?? false,
  };
}

type Props = {
  user:             DiscoverUser;
  status:           RequestStatus;
  onConnect:        () => void;
  onCancelRequest?: () => void;
  onPress?:         () => void;
  matchId?:         string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const { width: W } = Dimensions.get("window");
const CARD_W  = W - SPACE[32];
const PHOTO_H = Math.round(CARD_W * 0.82);

// cartoonAvatar lives in lib/avatarFallback.ts (shared, gender-aware)

const LEVEL_COLOR: Record<string, string> = {
  beginner:     "#22C55E",
  intermediate: "#F59E0B",
  advanced:     "#FF4500",
};

function formatActive(iso: string | null): string {
  if (!iso) return "";
  const hrs = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (hrs < 1)   return "Active now";
  if (hrs < 24)  return `${Math.floor(hrs)}h ago`;
  if (hrs < 168) return `${Math.floor(hrs / 24)}d ago`;
  return "";
}

function reasonIcon(r: string): string {
  const l = r.toLowerCase();
  if (l.includes("sport") || l.includes("shared")) return "🎯";
  if (l.includes("level"))                          return "⚡";
  if (l.includes("near") || l.includes("city") || l.includes("km")) return "📍";
  if (l.includes("train") || l.includes("morning") || l.includes("afternoon") || l.includes("evening") || l.includes("weekend")) return "📅";
  if (l.includes("mentor") || l.includes("partner")) return "🤝";
  if (l.includes("verified"))                        return "✓";
  return "✦";
}

// ─── Component ────────────────────────────────────────────────────────────────
export function PersonCard({ user, status, onConnect, onCancelRequest, onPress, matchId }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const rawName     = user.full_name ?? user.username;
  const isUUID      = /^[0-9a-f-]{20,}$/i.test(rawName);
  const displayName = isUUID ? "Member" : rawName;

  const resolvedUrl = resolveUrl(user.avatar_url);
  const fallbackUrl = cartoonAvatar(displayName, user.gender);
  const photoUrl    = resolvedUrl ?? fallbackUrl;

  const levelColor = user.fitness_level ? LEVEL_COLOR[user.fitness_level] : "#9CA3AF";
  const activeStr  = formatActive(user.last_active);
  const isActiveNow = activeStr === "Active now";
  const sports     = (user.sports ?? []).slice(0, 3);
  const extraSports = (user.sports ?? []).length - 3;

  const scoreColor =
    user.matchScore >= 70 ? PALETTE.success :
    user.matchScore >= 45 ? "#3B82F6" :
    user.matchScore >= 25 ? "#F59E0B" : "#9CA3AF";

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.92 : 1}
    >
      {/* ── Photo section ──────────────────────────────────────────── */}
      <View style={{ height: PHOTO_H }}>
        <Image
          source={{ uri: photoUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top center"
          cachePolicy="disk"
          placeholder={{ blurhash: "LKHBBd~q9F%M%MIUofRj00M{D%of" }}
          transition={200}
        />
        {/* Gradient for name readability */}
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.78)"]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* At gym — top left */}
        {user.is_at_gym && (
          <View style={s.gymBadge}>
            <View style={s.gymDot} />
            <Text style={s.gymText}>At gym</Text>
          </View>
        )}

        {/* NEW — top left (if not at gym) */}
        {user.isNew && !user.is_at_gym && (
          <View style={[s.newBadge, { backgroundColor: c.brand }]}>
            <Text style={s.newText}>NEW</Text>
          </View>
        )}

        {/* Match score — top right */}
        <View style={[s.scorePill, { backgroundColor: scoreColor + "DD" }]}>
          <Text style={s.scoreText}>{user.matchScore}%</Text>
        </View>

        {/* Name + meta overlay — bottom of photo */}
        <View style={s.nameOverlay}>
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>{displayName}</Text>
            {user.age != null && (
              <Text style={s.age}>{user.age}</Text>
            )}
          </View>
          <View style={s.metaRow}>
            {user.fitness_level && (
              <View style={[s.levelBadge, { backgroundColor: levelColor + "30", borderColor: levelColor + "60" }]}>
                <Text style={[s.levelText, { color: levelColor }]}>{user.fitness_level}</Text>
              </View>
            )}
            <TrustTierBadge tier={user.trust_tier} size="sm" hideNew />
            {user.phone_verified && (
              <View style={s.verifiedBadge}>
                <Text style={s.verifiedText}>✓ Verified</Text>
              </View>
            )}
            {activeStr !== "" && (
              <Text style={[s.activeTime, { color: isActiveNow ? "#4ADE80" : "rgba(255,255,255,0.70)" }]}>
                {isActiveNow ? "● Active now" : activeStr}
              </Text>
            )}
            {user.city && (
              <Text style={s.cityText} numberOfLines={1}>· {user.city}</Text>
            )}
          </View>
        </View>
      </View>

      {/* ── Info section ───────────────────────────────────────────── */}
      <View style={[s.info, { backgroundColor: c.bgCard }]}>

        {/* Reason chips */}
        {user.reasons.length > 0 && (
          <View style={s.reasonsRow}>
            {user.reasons.slice(0, 3).map((r) => (
              <View key={r} style={[s.reasonChip, { backgroundColor: c.brandSubtle, borderColor: c.brandBorder }]}>
                <Text style={[s.reasonText, { color: c.brand }]}>{reasonIcon(r)} {r}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Sport chips */}
        {sports.length > 0 && (
          <View style={s.sportsRow}>
            {sports.map((sp) => (
              <View key={sp} style={[s.sportChip, { backgroundColor: c.bgCardAlt, borderColor: c.borderMedium }]}>
                <Text style={[s.sportText, { color: c.textSecondary }]}>{sp}</Text>
              </View>
            ))}
            {extraSports > 0 && (
              <View style={[s.sportChip, { backgroundColor: c.bgCardAlt, borderColor: c.borderMedium }]}>
                <Text style={[s.sportText, { color: c.textMuted }]}>+{extraSports}</Text>
              </View>
            )}
          </View>
        )}

        {/* Trust line */}
        {user.sessions_completed >= 1 && (
          <Text style={{ fontSize: 11, color: "#22C55E", fontWeight: "600" }}>
            ✓ {user.sessions_completed} session{user.sessions_completed !== 1 ? "s" : ""} completed
            {user.sessions_completed >= 3 && user.reliability_score >= 80 ? ` · ${user.reliability_score}% reliable` : ""}
          </Text>
        )}

        {/* CTA */}
        <View style={s.actionRow}>
          {status === "none" && (
            <TouchableOpacity
              style={[s.connectBtn, { backgroundColor: c.brand }]}
              onPress={onConnect}
              activeOpacity={0.85}
            >
              <Text style={s.connectText}>Connect</Text>
            </TouchableOpacity>
          )}
          {status === "pending" && (
            <TouchableOpacity
              style={[s.pendingBtn, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}
              onPress={onCancelRequest}
              activeOpacity={onCancelRequest ? 0.75 : 1}
              disabled={!onCancelRequest}
            >
              <Text style={[s.connectText, { color: c.textMuted }]}>
                Pending{onCancelRequest ? "  ✕" : ""}
              </Text>
            </TouchableOpacity>
          )}
          {status === "accepted" && (
            <TouchableOpacity
              style={[s.acceptedBtn, { backgroundColor: PALETTE.success + "18", borderColor: PALETTE.success + "50" }]}
              activeOpacity={0.8}
              onPress={() => matchId && router.push(`/chat/${matchId}` as any)}
            >
              <Text style={[s.connectText, { color: PALETTE.success }]}>Open Chat →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  card:        {
    borderRadius: RADIUS.xl,
    borderWidth:  1,
    overflow:     "hidden",
    elevation:    3,
    shadowColor:  "#000",
    shadowOpacity: 0.10,
    shadowRadius:  10,
    shadowOffset:  { width: 0, height: 3 },
  },

  // Photo badges
  gymBadge:    { position: "absolute", top: SPACE[10], left: SPACE[10], flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.52)", borderRadius: RADIUS.pill, paddingHorizontal: SPACE[8], paddingVertical: 3 },
  gymDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4ADE80" },
  gymText:     { fontSize: 10, fontWeight: FONT.weight.bold, color: "#fff" },
  newBadge:    { position: "absolute", top: SPACE[10], left: SPACE[10], paddingHorizontal: SPACE[8], paddingVertical: 3, borderRadius: RADIUS.pill },
  newText:     { fontSize: 10, fontWeight: FONT.weight.black, color: "#fff", letterSpacing: 0.5 },
  scorePill:   { position: "absolute", top: SPACE[10], right: SPACE[10], paddingHorizontal: SPACE[8], paddingVertical: 3, borderRadius: RADIUS.pill },
  scoreText:   { fontSize: 11, fontWeight: FONT.weight.extrabold, color: "#fff" },

  // Name overlay
  nameOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: SPACE[14], gap: SPACE[6] },
  nameRow:     { flexDirection: "row", alignItems: "flex-end", gap: SPACE[8] },
  name:        { fontSize: FONT.size.xxl, fontWeight: FONT.weight.black, color: "#fff", letterSpacing: -0.5, flexShrink: 1 },
  age:         { fontSize: FONT.size.lg, fontWeight: FONT.weight.medium, color: "rgba(255,255,255,0.80)", paddingBottom: 2 },
  metaRow:     { flexDirection: "row", alignItems: "center", gap: SPACE[8], flexWrap: "wrap" },
  levelBadge:  { paddingHorizontal: SPACE[8], paddingVertical: 2, borderRadius: RADIUS.pill, borderWidth: 1 },
  levelText:   { fontSize: FONT.size.xs, fontWeight: FONT.weight.extrabold, textTransform: "capitalize" },
  activeTime:    { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
  cityText:      { fontSize: FONT.size.xs, color: "rgba(255,255,255,0.65)" },
  verifiedBadge: { paddingHorizontal: SPACE[6], paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: "rgba(34,197,94,0.25)", borderWidth: 1, borderColor: "rgba(34,197,94,0.60)" },
  verifiedText:  { fontSize: 9, fontWeight: FONT.weight.extrabold, color: "#4ADE80", letterSpacing: 0.3 },

  // Info section
  info:        { padding: SPACE[14], gap: SPACE[10] },

  reasonsRow:  { flexDirection: "row", flexWrap: "wrap", gap: SPACE[6] },
  reasonChip:  { paddingHorizontal: SPACE[10], paddingVertical: 4, borderRadius: RADIUS.pill, borderWidth: 1 },
  reasonText:  { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold },

  sportsRow:   { flexDirection: "row", flexWrap: "wrap", gap: SPACE[6] },
  sportChip:   { paddingHorizontal: SPACE[10], paddingVertical: 5, borderRadius: RADIUS.md, borderWidth: 1 },
  sportText:   { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },

  actionRow:   { marginTop: SPACE[2] },
  connectBtn:  { borderRadius: RADIUS.pill, paddingVertical: SPACE[12], alignItems: "center" },
  pendingBtn:  { borderRadius: RADIUS.pill, paddingVertical: SPACE[12], alignItems: "center", borderWidth: 1 },
  acceptedBtn: { borderRadius: RADIUS.pill, paddingVertical: SPACE[12], alignItems: "center", borderWidth: 1 },
  connectText: { fontSize: FONT.size.base, fontWeight: FONT.weight.extrabold, color: "#fff" },
});
