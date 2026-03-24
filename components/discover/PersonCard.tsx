/**
 * PersonCard
 *
 * A compact, full-width card for a potential training partner.
 * Designed to feel like a player card / sports context — not a dating profile.
 *
 * Information hierarchy:
 *   1. Name + level badge + active time      (who + trust tier)
 *   2. Reason tags                           (why this person specifically)
 *   3. Streak indicator (if notable)         (do they actually show up?)
 *   4. Bio (1 line, optional)               (personal context)
 *   5. Sport chips + Connect button          (action)
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme, SPACE, FONT, RADIUS } from "../../lib/theme";
import { Icon } from "../Icon";

// ─── Types ────────────────────────────────────────────────────────────────────
export type RequestStatus = "none" | "pending" | "accepted";

export type DiscoverUser = {
  id:            string;
  username:      string;
  full_name:     string | null;
  bio:           string | null;
  city:          string | null;
  fitness_level: "beginner" | "intermediate" | "advanced" | null;
  age:           number | null;
  sports:        string[] | null;
  current_streak: number;
  last_active:   string | null;
  is_at_gym:     boolean;
  availability:  Record<string, boolean> | null;
  matchScore:    number;
  reasons:       string[];
};

type Props = {
  user:      DiscoverUser;
  status:    RequestStatus;
  onConnect: () => void;
  onPress?:  () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const LEVEL_COLOR: Record<string, string> = {
  beginner:     "#22C55E",
  intermediate: "#F59E0B",
  advanced:     "#FF4500",
};

// Reason tag colours cycle through 3 pairs
const TAG_PALETTE: Array<[string, string]> = [
  ["#FF450018", "#FF4500"],
  ["#22C55E18", "#22C55E"],
  ["#3B82F618", "#3B82F6"],
];

function formatActive(iso: string | null): string {
  if (!iso) return "";
  const hrs = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (hrs < 1)   return "Active now";
  if (hrs < 24)  return `${Math.floor(hrs)}h ago`;
  if (hrs < 168) return `${Math.floor(hrs / 24)}d ago`;
  return "";
}

// ─── Component ────────────────────────────────────────────────────────────────
export function PersonCard({ user, status, onConnect, onPress }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const initial    = (user.full_name ?? user.username)[0]?.toUpperCase() ?? "?";
  const levelColor = user.fitness_level ? LEVEL_COLOR[user.fitness_level] : c.textMuted;
  const activeStr  = formatActive(user.last_active);
  const sports     = (user.sports ?? []).slice(0, 3);

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.9 : 1}
    >

      {/* ── Row 1: Avatar + identity ───────────────────────────── */}
      <View style={s.topRow}>
        {/* Avatar */}
        <View style={[s.avatar, { backgroundColor: c.brandSubtle, borderColor: c.brandBorder }]}>
          {user.is_at_gym && (
            <View style={[s.gymDot, { backgroundColor: "#22C55E", borderColor: c.bgCard }]} />
          )}
          <Text style={[s.initial, { color: c.brand }]}>{initial}</Text>
        </View>

        {/* Identity column */}
        <View style={s.identity}>
          {/* Name + age */}
          <View style={s.nameRow}>
            <Text style={[s.name, { color: c.text }]} numberOfLines={1}>
              {user.full_name ?? user.username}
            </Text>
            {user.age != null && (
              <Text style={[s.age, { color: c.textMuted }]}>{user.age}</Text>
            )}
          </View>

          {/* Level badge + active time */}
          <View style={s.metaRow}>
            {user.fitness_level && (
              <View style={[s.levelBadge, { backgroundColor: levelColor + "20", borderColor: levelColor + "50" }]}>
                <Text style={[s.levelText, { color: levelColor }]}>
                  {user.fitness_level}
                </Text>
              </View>
            )}
            {activeStr !== "" && (
              <Text style={[s.activeTime, { color: activeStr === "Active now" ? "#22C55E" : c.textMuted }]}>
                {activeStr}
              </Text>
            )}
          </View>

          {/* City + streak row */}
          <View style={s.metaRow}>
            {user.city && (
              <View style={s.cityRow}>
                <Icon name="location" size={10} color={c.textMuted} />
                <Text style={[s.cityText, { color: c.textMuted }]} numberOfLines={1}>{user.city}</Text>
              </View>
            )}
            {user.current_streak >= 3 && (
              <View style={s.streakRow}>
                <Icon name="streakActive" size={12} color={c.brand} />
                <Text style={[s.streakText, { color: c.brand }]}>
                  {user.current_streak}d
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── Row 2: Reason tags ─────────────────────────────────── */}
      {user.reasons.length > 0 && (
        <View style={s.tagsRow}>
          {user.reasons.map((reason, i) => {
            const [bg, fg] = TAG_PALETTE[i % TAG_PALETTE.length];
            return (
              <View key={reason} style={[s.tag, { backgroundColor: bg }]}>
                <Text style={[s.tagText, { color: fg }]}>{reason}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Row 3: Bio ─────────────────────────────────────────── */}
      {user.bio ? (
        <Text style={[s.bio, { color: c.textSecondary }]} numberOfLines={1}>
          {user.bio}
        </Text>
      ) : null}

      {/* ── Row 4: Sports chips + action ──────────────────────── */}
      <View style={s.bottomRow}>
        <View style={s.sportsRow}>
          {sports.map((sp) => (
            <View key={sp} style={[s.sportChip, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
              <Text style={[s.sportText, { color: c.textSecondary }]}>{sp}</Text>
            </View>
          ))}
        </View>

        {status === "none" && (
          <TouchableOpacity
            style={[s.connectBtn, { backgroundColor: c.brand }]}
            onPress={onConnect}
            activeOpacity={0.85}
          >
            <Text style={s.connectText}>Send Request</Text>
          </TouchableOpacity>
        )}
        {status === "pending" && (
          <View style={[s.pendingBtn, { borderColor: c.borderMedium }]}>
            <Text style={[s.pendingText, { color: c.textMuted }]}>Pending</Text>
          </View>
        )}
        {status === "accepted" && (
          <TouchableOpacity
            style={[s.messageBtn, { borderColor: "#166534" }]}
            activeOpacity={0.8}
          >
            <Text style={[s.messageText, { color: "#22C55E" }]}>Matched</Text>
            <Icon name="chevronRight" size={13} color="#22C55E" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  card:        { borderRadius: RADIUS.xl, padding: SPACE[14], borderWidth: 1, gap: SPACE[10] },

  // Top row
  topRow:      { flexDirection: "row", gap: SPACE[12], alignItems: "flex-start" },
  avatar:      { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", borderWidth: 1.5, flexShrink: 0 },
  gymDot:      { position: "absolute", bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, borderWidth: 2, zIndex: 1 },
  initial:     { fontSize: FONT.size.xxl, fontWeight: FONT.weight.black },
  identity:    { flex: 1, gap: SPACE[4] },
  nameRow:     { flexDirection: "row", alignItems: "flex-end", gap: SPACE[6] },
  name:        { fontSize: FONT.size.lg, fontWeight: FONT.weight.extrabold, flexShrink: 1 },
  age:         { fontSize: FONT.size.base, fontWeight: FONT.weight.medium, paddingBottom: 1 },
  metaRow:     { flexDirection: "row", alignItems: "center", gap: SPACE[8] },
  levelBadge:  { paddingHorizontal: SPACE[8], paddingVertical: 2, borderRadius: RADIUS.pill, borderWidth: 1 },
  levelText:   { fontSize: FONT.size.xs, fontWeight: FONT.weight.extrabold, textTransform: "capitalize", letterSpacing: 0.3 },
  activeTime:  { fontSize: FONT.size.xs, fontWeight: FONT.weight.medium },
  cityRow:     { flexDirection: "row", alignItems: "center", gap: 3 },
  cityText:    { fontSize: FONT.size.xs },
  streakRow:   { flexDirection: "row", alignItems: "center", gap: SPACE[4] },
  streakText:  { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },

  // Reason tags
  tagsRow:     { flexDirection: "row", flexWrap: "wrap", gap: SPACE[6] },
  tag:         { paddingHorizontal: SPACE[10], paddingVertical: 4, borderRadius: RADIUS.pill },
  tagText:     { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold },

  // Bio
  bio:         { fontSize: FONT.size.sm, lineHeight: FONT.size.sm * 1.5 },

  // Bottom row
  bottomRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sportsRow:   { flexDirection: "row", gap: SPACE[6], flexWrap: "wrap", flex: 1 },
  sportChip:   { paddingHorizontal: SPACE[8], paddingVertical: 3, borderRadius: RADIUS.sm, borderWidth: 1 },
  sportText:   { fontSize: FONT.size.xs, fontWeight: FONT.weight.medium },

  // Action buttons
  connectBtn:  { paddingHorizontal: SPACE[16], paddingVertical: SPACE[8], borderRadius: RADIUS.lg },
  connectText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.extrabold, color: "#fff" },
  pendingBtn:  { paddingHorizontal: SPACE[16], paddingVertical: SPACE[8], borderRadius: RADIUS.lg, borderWidth: 1 },
  pendingText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium },
  messageBtn:  { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: SPACE[12], paddingVertical: SPACE[8], borderRadius: RADIUS.lg, borderWidth: 1 },
  messageText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
});
