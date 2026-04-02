/**
 * PersonCard
 *
 * A compact, full-width card for a potential training partner.
 * Designed to feel like a player card / sports context — not a dating profile.
 *
 * Information hierarchy:
 *   0. Match score bar (subtle, full-width)
 *   1. Name + level badge + active time      (who + trust tier)
 *   2. Reason tags (with "New to FlexMatches" fallback)
 *   3. Streak indicator (if notable)         (do they actually show up?)
 *   4. Bio (1 line, optional)               (personal context)
 *   5. Sport chips + Connect button          (action; expandable if >3 sports)
 */

import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../../lib/theme";
import { Icon } from "../Icon";
import { Avatar } from "../Avatar";

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
  lat:                number | null;
  lng:                number | null;
  sessions_completed: number;
  reliability_score:  number;
  matchScore:         number;
  reasons:            string[];
  isNew:              boolean;
};

type Props = {
  user:            DiscoverUser;
  status:          RequestStatus;
  onConnect:       () => void;
  onCancelRequest?: () => void;  // tap Pending to cancel/withdraw
  onPress?:        () => void;
  matchId?:        string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function scoreBarColor(score: number, brand: string, border: string): string {
  if (score >= 35) return brand;
  return border;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function PersonCard({ user, status, onConnect, onCancelRequest, onPress, matchId }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [sportsExpanded, setSportsExpanded] = useState(false);

  const levelColor  = user.fitness_level ? LEVEL_COLOR[user.fitness_level] : c.textMuted;
  const activeStr   = formatActive(user.last_active);
  const allSports   = user.sports ?? [];
  const sports      = sportsExpanded ? allSports : allSports.slice(0, 3);
  const hiddenCount = allSports.length - 3;
  const barColor    = scoreBarColor(user.matchScore, c.brand, c.border);

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.9 : 1}
    >
      {/* ── Score bar — full width, no padding ─────────────────── */}
      <View style={[s.scoreBg, { backgroundColor: c.bgCardAlt }]}>
        <View style={[s.scoreFill, { width: `${user.matchScore}%` as any, backgroundColor: barColor }]} />
      </View>

      {/* ── Content ─────────────────────────────────────────────── */}
      <View style={s.content}>

        {/* ── Row 1: Avatar + identity ─────────────────────────── */}
        <View style={s.topRow}>
          {/* Avatar with badges */}
          <View style={s.avatarWrap}>
            <Avatar url={user.avatar_url} name={user.full_name ?? user.username} size={52} />
            {user.is_at_gym && (
              <View style={[s.gymDot, { backgroundColor: PALETTE.success, borderColor: c.bgCard }]} />
            )}
            {user.isNew && (
              <View style={[s.newBadge, { backgroundColor: c.brand }]}>
                <Text style={s.newBadgeText}>NEW</Text>
              </View>
            )}
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

        {/* ── Row 2: Reason tags (with fallback) ─────────────────── */}
        <View style={s.tagsRow}>
          {user.reasons.length > 0 ? (
            user.reasons.map((reason) => (
              <View key={reason} style={[s.tag, { backgroundColor: c.brandSubtle }]}>
                <Text style={[s.tagText, { color: c.brand }]}>{reason}</Text>
              </View>
            ))
          ) : (
            <View style={[s.tag, { backgroundColor: c.bgCardAlt }]}>
              <Text style={[s.tagText, { color: c.textMuted }]}>New to FlexMatches</Text>
            </View>
          )}
        </View>

        {/* ── Intent chip ────────────────────────────────────────── */}
        {user.training_intent && (
          <View style={s.intentRow}>
            <View style={[s.intentChip, { backgroundColor: c.brandSubtle, borderColor: c.brandBorder }]}>
              <Text style={[s.intentText, { color: c.brand }]}>
                {user.training_intent === "guidance"  ? "Wants guidance" :
                 user.training_intent === "teaching"  ? "Loves helping others" :
                                                        "Equal partner"}
              </Text>
            </View>
          </View>
        )}

        {/* ── Trust badges ────────────────────────────────────────── */}
        {(user.sessions_completed > 0 || user.reliability_score >= 80) && (
          <View style={s.trustRow}>
            {user.sessions_completed > 0 && (
              <View style={[s.trustBadge, { backgroundColor: "#22C55E18" }]}>
                <Text style={{ fontSize: 10, color: "#22C55E", fontWeight: "600" }}>
                  ✓ {user.sessions_completed} session{user.sessions_completed !== 1 ? "s" : ""} completed
                </Text>
              </View>
            )}
            {user.reliability_score >= 80 && user.sessions_completed >= 3 && (
              <View style={[s.trustBadge, { backgroundColor: "#007AFF18" }]}>
                <Text style={{ fontSize: 10, color: "#007AFF", fontWeight: "600" }}>
                  {user.reliability_score}% reliable
                </Text>
              </View>
            )}
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
              <View key={sp} style={[s.sportChip, { backgroundColor: "transparent", borderColor: c.borderMedium }]}>
                <Text style={[s.sportText, { color: c.textSecondary }]}>{sp}</Text>
              </View>
            ))}
            {!sportsExpanded && hiddenCount > 0 && (
              <TouchableOpacity
                style={[s.sportChip, { backgroundColor: "transparent", borderColor: c.brand }]}
                onPress={(e) => { e.stopPropagation(); setSportsExpanded(true); }}
              >
                <Text style={[s.sportText, { color: c.brand }]}>+{hiddenCount}</Text>
              </TouchableOpacity>
            )}
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
            <TouchableOpacity
              style={[s.pendingBtn, { borderColor: c.borderMedium }]}
              onPress={onCancelRequest}
              activeOpacity={onCancelRequest ? 0.75 : 1}
              disabled={!onCancelRequest}
            >
              <Text style={[s.pendingText, { color: c.textMuted }]}>Pending</Text>
              {onCancelRequest && (
                <Text style={[s.pendingText, { color: c.textMuted, fontSize: 10 }]}> ✕</Text>
              )}
            </TouchableOpacity>
          )}
          {status === "accepted" && (
            <TouchableOpacity
              style={[s.messageBtn, { borderColor: "#166534" }]}
              activeOpacity={0.8}
              onPress={() => matchId && router.push(`/chat/${matchId}` as any)}
            >
              <Text style={[s.messageText, { color: "#22C55E" }]}>Chat</Text>
              <Icon name="chevronRight" size={13} color="#22C55E" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  card:        { borderRadius: RADIUS.xl, borderWidth: 1, overflow: "hidden" },
  scoreBg:     { height: 3 },
  scoreFill:   { height: 3 },
  content:     { padding: SPACE[14], gap: SPACE[10] },

  // Top row
  topRow:      { flexDirection: "row", gap: SPACE[12], alignItems: "flex-start" },
  avatarWrap:  { width: 52, height: 52, flexShrink: 0 },
  gymDot:      { position: "absolute", bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, borderWidth: 2, zIndex: 1 },
  newBadge:    { position: "absolute", top: -4, left: -4, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, zIndex: 2 },
  newBadgeText:{ fontSize: 8, fontWeight: "900", color: "#fff", letterSpacing: 0.5 },
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

  // Intent
  intentRow:  { flexDirection: "row" },
  intentChip: { paddingHorizontal: SPACE[10], paddingVertical: 4, borderRadius: RADIUS.pill, borderWidth: 1 },
  intentText: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold },

  // Trust badges
  trustRow:    { flexDirection: "row", flexWrap: "wrap", gap: SPACE[6] },
  trustBadge:  { paddingHorizontal: SPACE[8], paddingVertical: 3, borderRadius: RADIUS.pill },

  // Bio
  bio:         { fontSize: FONT.size.sm, lineHeight: FONT.size.sm * 1.5 },

  // Bottom row
  bottomRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sportsRow:   { flexDirection: "row", gap: SPACE[6], flexWrap: "wrap", flex: 1 },
  sportChip:   { paddingHorizontal: SPACE[8], paddingVertical: 3, borderRadius: RADIUS.sm, borderWidth: 1 },
  sportText:   { fontSize: FONT.size.xs, fontWeight: FONT.weight.medium },

  // Action buttons
  connectBtn:  { paddingHorizontal: SPACE[16], paddingVertical: SPACE[8], borderRadius: RADIUS.pill },
  connectText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.extrabold, color: "#fff" },
  pendingBtn:  { paddingHorizontal: SPACE[16], paddingVertical: SPACE[8], borderRadius: RADIUS.pill, borderWidth: 1 },
  pendingText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium },
  messageBtn:  { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: SPACE[12], paddingVertical: SPACE[8], borderRadius: RADIUS.pill, borderWidth: 1 },
  messageText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
});
