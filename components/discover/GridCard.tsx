/**
 * GridCard — compact 2-column profile card for Discover grid view.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../../lib/theme";
import { resolveUrl } from "../Avatar";
import type { DiscoverUser, RequestStatus } from "./PersonCard";

const { width: W } = Dimensions.get("window");
const H_PAD   = 16;
const COL_GAP = 10;
const CARD_W  = (W - H_PAD * 2 - COL_GAP) / 2;
const PHOTO_H = Math.round(CARD_W * 1.1);

// Cartoon fallback
const WEB_BASE       = "https://flexmatches.com";
const MALE_AVATARS   = Array.from({ length: 12 }, (_, i) => `${WEB_BASE}/avatars/male/m${i + 1}.jpeg`);
const FEMALE_AVATARS = Array.from({ length: 12 }, (_, i) => `${WEB_BASE}/avatars/female/f${i + 1}.jpeg`);
const ALL_AVATARS    = [...MALE_AVATARS, ...FEMALE_AVATARS];
function nameHash(n: string) { let h = 0; for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h << 5) - h); return Math.abs(h); }
function cartoonAvatar(name: string) { return ALL_AVATARS[nameHash(name?.trim() || "user") % ALL_AVATARS.length]; }

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
  return "✓";
}

const LEVEL_COLOR: Record<string, string> = {
  beginner: "#22C55E", intermediate: "#F59E0B", advanced: "#FF4500",
};

type Props = {
  user:     DiscoverUser;
  status:   RequestStatus;
  onPress:  () => void;
  onConnect: () => void;
  matchId?: string;
};

export function GridCard({ user, status, onPress, onConnect, matchId }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const rawName     = user.full_name ?? user.username;
  const isUUID      = /^[0-9a-f-]{20,}$/i.test(rawName);
  const displayName = isUUID ? "Member" : rawName;

  const resolvedUrl = resolveUrl(user.avatar_url);
  const fallbackUrl = cartoonAvatar(displayName);
  const photoUrl    = resolvedUrl ?? fallbackUrl;

  const activeStr  = formatActive(user.last_active);
  const isActiveNow = activeStr === "Active now";
  const levelColor = user.fitness_level ? LEVEL_COLOR[user.fitness_level] : "#9CA3AF";
  const sports     = (user.sports ?? []).slice(0, 2);
  const extraSports = (user.sports ?? []).length - 2;

  const scoreColor =
    user.matchScore >= 70 ? PALETTE.success :
    user.matchScore >= 45 ? "#3B82F6" :
    user.matchScore >= 25 ? "#F59E0B" : "#9CA3AF";

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: c.bgCard }]}
      onPress={onPress}
      activeOpacity={0.92}
    >
      {/* Photo */}
      <View style={{ height: PHOTO_H }}>
        <Image
          source={{ uri: photoUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="disk"
          placeholder={{ blurhash: "LKHBBd~q9F%M%MIUofRj00M{D%of" }}
          transition={200}
        />
        <LinearGradient
          colors={["transparent", "transparent", "rgba(0,0,0,0.68)"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* At gym badge */}
        {user.is_at_gym && (
          <View style={s.gymBadge}>
            <View style={s.gymDot} />
            <Text style={s.gymText}>At gym</Text>
          </View>
        )}

        {/* Match % */}
        <View style={[s.matchBadge, { backgroundColor: scoreColor + "E0" }]}>
          <Text style={s.matchText}>{Math.max(0, Math.round(user.matchScore))}%</Text>
        </View>

        {/* Name overlay */}
        <View style={s.nameOverlay}>
          <Text style={s.name} numberOfLines={1}>{displayName}</Text>
          <Text style={[s.activeStr, { color: isActiveNow ? "#4ADE80" : "rgba(255,255,255,0.65)" }]}>
            {isActiveNow ? "● Active now" : activeStr || " "}
          </Text>
        </View>
      </View>

      {/* Info section */}
      <View style={[s.info, { backgroundColor: c.bgCard }]}>

        {/* Level + city + verified */}
        <View style={s.metaRow}>
          {user.fitness_level && (
            <View style={[s.levelChip, { backgroundColor: levelColor + "20", borderColor: levelColor + "50" }]}>
              <Text style={[s.levelText, { color: levelColor }]}>{user.fitness_level}</Text>
            </View>
          )}
          {user.phone_verified && (
            <View style={s.verifiedBadge}>
              <Text style={s.verifiedText}>✓ ID</Text>
            </View>
          )}
          {user.city && (
            <Text style={[s.city, { color: c.textMuted }]} numberOfLines={1}>{user.city}</Text>
          )}
        </View>

        {/* Sports */}
        {sports.length > 0 && (
          <View style={s.sportsRow}>
            {sports.map((sp) => (
              <View key={sp} style={[s.sportChip, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                <Text style={[s.sportText, { color: c.textSecondary }]}>{sp}</Text>
              </View>
            ))}
            {extraSports > 0 && (
              <View style={[s.sportChip, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                <Text style={[s.sportText, { color: c.textMuted }]}>+{extraSports}</Text>
              </View>
            )}
          </View>
        )}

        {/* Trust indicator */}
        {user.sessions_completed > 0 && (
          <Text style={{ fontSize: 10, color: "#22C55E", fontWeight: "600", marginTop: 2 }}>
            ✓ {user.sessions_completed} session{user.sessions_completed !== 1 ? "s" : ""}{user.sessions_completed >= 3 ? ` · ${user.reliability_score}% reliable` : ""}
          </Text>
        )}

        {/* Why this works */}
        <View style={[s.whyBox, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
          <Text style={[s.whyLabel, { color: c.textMuted }]}>✦ Why this works</Text>
          {user.reasons.length > 0 ? (
            user.reasons.slice(0, 3).map((r) => (
              <View key={r} style={s.reasonRow}>
                <Text style={s.reasonIcon}>{reasonIcon(r)}</Text>
                <Text style={[s.reasonText, { color: c.textSecondary }]} numberOfLines={1}>{r}</Text>
              </View>
            ))
          ) : (
            <View style={s.reasonRow}>
              <Text style={s.reasonIcon}>✨</Text>
              <Text style={[s.reasonText, { color: c.textMuted }]}>New to FlexMatches</Text>
            </View>
          )}
        </View>

        {/* Action */}
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
          <View style={[s.connectBtn, { backgroundColor: c.bgCardAlt, borderWidth: 1, borderColor: c.border }]}>
            <Text style={[s.connectText, { color: c.textMuted }]}>Pending</Text>
          </View>
        )}
        {status === "accepted" && (
          <View style={[s.connectBtn, { backgroundColor: PALETTE.success + "20", borderWidth: 1, borderColor: PALETTE.success + "50" }]}>
            <Text style={[s.connectText, { color: PALETTE.success }]}>Connected ✓</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card:        { width: CARD_W, borderRadius: RADIUS.xl, overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },

  gymBadge:    { position: "absolute", top: SPACE[8], left: SPACE[8], flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.50)", borderRadius: RADIUS.pill, paddingHorizontal: SPACE[8], paddingVertical: 3 },
  gymDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4ADE80" },
  gymText:     { fontSize: 10, fontWeight: FONT.weight.bold, color: "#fff" },

  matchBadge:  { position: "absolute", top: SPACE[8], right: SPACE[8], paddingHorizontal: SPACE[6], paddingVertical: 3, borderRadius: RADIUS.pill },
  matchText:   { fontSize: 11, fontWeight: FONT.weight.extrabold, color: "#fff" },

  nameOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: SPACE[10], gap: 2 },
  name:        { fontSize: FONT.size.base, fontWeight: FONT.weight.black, color: "#fff", letterSpacing: -0.3 },
  activeStr:   { fontSize: 10, fontWeight: FONT.weight.semibold },

  info:        { padding: SPACE[10], gap: SPACE[8] },

  metaRow:     { flexDirection: "row", alignItems: "center", gap: SPACE[6], flexWrap: "wrap" },
  levelChip:   { paddingHorizontal: SPACE[6], paddingVertical: 2, borderRadius: RADIUS.pill, borderWidth: 1 },
  levelText:     { fontSize: 10, fontWeight: FONT.weight.extrabold, textTransform: "capitalize" },
  verifiedBadge: { paddingHorizontal: SPACE[6], paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: "rgba(34,197,94,0.18)", borderWidth: 1, borderColor: "rgba(34,197,94,0.50)" },
  verifiedText:  { fontSize: 9, fontWeight: FONT.weight.extrabold, color: "#22C55E" },
  city:          { fontSize: 10, flex: 1 },

  sportsRow:   { flexDirection: "row", gap: SPACE[4], flexWrap: "wrap" },
  sportChip:   { paddingHorizontal: SPACE[6], paddingVertical: 2, borderRadius: RADIUS.sm, borderWidth: 1 },
  sportText:   { fontSize: 10, fontWeight: FONT.weight.medium },

  whyBox:      { borderRadius: RADIUS.md, borderWidth: 1, padding: SPACE[8], gap: SPACE[4] },
  whyLabel:    { fontSize: 9, fontWeight: FONT.weight.extrabold, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 2 },
  reasonRow:   { flexDirection: "row", alignItems: "center", gap: SPACE[6] },
  reasonIcon:  { fontSize: 11, width: 16 },
  reasonText:  { fontSize: 10, fontWeight: FONT.weight.medium, flex: 1 },

  connectBtn:  { borderRadius: RADIUS.pill, paddingVertical: SPACE[8], alignItems: "center" },
  connectText: { fontSize: 12, fontWeight: FONT.weight.extrabold, color: "#fff" },
});
