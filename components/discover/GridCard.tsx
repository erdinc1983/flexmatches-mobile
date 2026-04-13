/**
 * GridCard — 2-column photo-forward card. Matches web PWA discover grid.
 *
 * Layout (portrait photo + info below):
 *   ┌──────────────────┐
 *   │   [PHOTO]        │
 *   │ [gym] [score%]   │
 *   │                  │
 *   │  Name, Age       │  ← gradient overlay
 *   │  [level] ● active│
 *   └──────────────────┘
 *   │ [🎯r] [⚡r]      │
 *   │ [Sport] [Sport]  │
 *   │ [   Connect   ]  │
 *   └──────────────────┘
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../../lib/theme";
import { resolveUrl } from "../Avatar";
import type { DiscoverUser, RequestStatus } from "./PersonCard";

const { width: W } = Dimensions.get("window");
const H_PAD   = SPACE[16];
const COL_GAP = 10;
const CARD_W  = (W - H_PAD * 2 - COL_GAP) / 2;
const PHOTO_H = Math.round(CARD_W * 1.25);

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
  return "✦";
}

const LEVEL_COLOR: Record<string, string> = {
  beginner: "#22C55E", intermediate: "#F59E0B", advanced: "#FF4500",
};

type Props = {
  user:      DiscoverUser;
  status:    RequestStatus;
  onPress:   () => void;
  onConnect: () => void;
  matchId?:  string;
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

  const activeStr   = formatActive(user.last_active);
  const isActiveNow = activeStr === "Active now";
  const levelColor  = user.fitness_level ? LEVEL_COLOR[user.fitness_level] : "#9CA3AF";
  const sports      = (user.sports ?? []).slice(0, 2);
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
      {/* ── Photo ─────────────────────────────────────────────────── */}
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
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0)", "rgba(0,0,0,0.75)"]}
          locations={[0, 0.4, 1]}
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

        {/* Match % — top right */}
        <View style={[s.matchBadge, { backgroundColor: scoreColor + "DD" }]}>
          <Text style={s.matchText}>{user.matchScore}%</Text>
        </View>

        {/* Name overlay */}
        <View style={s.nameOverlay}>
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>{displayName}</Text>
            {user.age != null && (
              <Text style={s.age}>{user.age}</Text>
            )}
          </View>
          <View style={s.metaRow}>
            {user.fitness_level && (
              <View style={[s.levelChip, { backgroundColor: levelColor + "30", borderColor: levelColor + "60" }]}>
                <Text style={[s.levelText, { color: levelColor }]}>{user.fitness_level}</Text>
              </View>
            )}
            {activeStr !== "" && (
              <Text style={[s.activeStr, { color: isActiveNow ? "#4ADE80" : "rgba(255,255,255,0.70)" }]}>
                {isActiveNow ? "●" : activeStr}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* ── Info ──────────────────────────────────────────────────── */}
      <View style={[s.info, { backgroundColor: c.bgCard }]}>

        {/* Reason chips */}
        {user.reasons.length > 0 && (
          <View style={s.reasonsRow}>
            {user.reasons.slice(0, 2).map((r) => (
              <View key={r} style={[s.reasonChip, { backgroundColor: c.brandSubtle, borderColor: c.brandBorder }]}>
                <Text style={[s.reasonText, { color: c.brand }]} numberOfLines={1}>
                  {reasonIcon(r)} {r}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Sports */}
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

        {/* CTA */}
        {status === "none" && (
          <TouchableOpacity
            style={[s.btn, { backgroundColor: c.brand }]}
            onPress={onConnect}
            activeOpacity={0.85}
          >
            <Text style={s.btnText}>Connect</Text>
          </TouchableOpacity>
        )}
        {status === "pending" && (
          <View style={[s.btn, { backgroundColor: c.bgCardAlt, borderWidth: 1, borderColor: c.border }]}>
            <Text style={[s.btnText, { color: c.textMuted }]}>Pending</Text>
          </View>
        )}
        {status === "accepted" && (
          <TouchableOpacity
            style={[s.btn, { backgroundColor: PALETTE.success + "18", borderWidth: 1, borderColor: PALETTE.success + "50" }]}
            onPress={() => matchId && router.push(`/chat/${matchId}` as any)}
            activeOpacity={0.85}
          >
            <Text style={[s.btnText, { color: PALETTE.success }]}>Chat →</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card:        {
    width:        CARD_W,
    borderRadius: RADIUS.xl,
    overflow:     "hidden",
    elevation:    3,
    shadowColor:  "#000",
    shadowOpacity: 0.10,
    shadowRadius:  8,
    shadowOffset:  { width: 0, height: 2 },
  },

  gymBadge:  { position: "absolute", top: SPACE[8], left: SPACE[8], flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.52)", borderRadius: RADIUS.pill, paddingHorizontal: SPACE[6], paddingVertical: 3 },
  gymDot:    { width: 5, height: 5, borderRadius: 3, backgroundColor: "#4ADE80" },
  gymText:   { fontSize: 9, fontWeight: FONT.weight.bold, color: "#fff" },

  matchBadge: { position: "absolute", top: SPACE[8], right: SPACE[8], paddingHorizontal: SPACE[6], paddingVertical: 3, borderRadius: RADIUS.pill },
  matchText:  { fontSize: 10, fontWeight: FONT.weight.extrabold, color: "#fff" },

  nameOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: SPACE[10], gap: 3 },
  nameRow:     { flexDirection: "row", alignItems: "flex-end", gap: SPACE[4] },
  name:        { fontSize: FONT.size.base, fontWeight: FONT.weight.black, color: "#fff", letterSpacing: -0.3, flexShrink: 1 },
  age:         { fontSize: FONT.size.xs, color: "rgba(255,255,255,0.80)", paddingBottom: 1 },
  metaRow:     { flexDirection: "row", alignItems: "center", gap: SPACE[6] },
  levelChip:   { paddingHorizontal: SPACE[6], paddingVertical: 2, borderRadius: RADIUS.pill, borderWidth: 1 },
  levelText:   { fontSize: 9, fontWeight: FONT.weight.extrabold, textTransform: "capitalize" },
  activeStr:   { fontSize: 10, fontWeight: FONT.weight.semibold },

  info:        { padding: SPACE[10], gap: SPACE[8] },

  reasonsRow:  { flexDirection: "row", flexWrap: "wrap", gap: SPACE[4] },
  reasonChip:  { paddingHorizontal: SPACE[6], paddingVertical: 3, borderRadius: RADIUS.pill, borderWidth: 1, maxWidth: CARD_W - SPACE[20] },
  reasonText:  { fontSize: 10, fontWeight: FONT.weight.bold },

  sportsRow:   { flexDirection: "row", flexWrap: "wrap", gap: SPACE[4] },
  sportChip:   { paddingHorizontal: SPACE[6], paddingVertical: 3, borderRadius: RADIUS.sm, borderWidth: 1 },
  sportText:   { fontSize: 10, fontWeight: FONT.weight.medium },

  btn:         { borderRadius: RADIUS.pill, paddingVertical: SPACE[8], alignItems: "center" },
  btnText:     { fontSize: 12, fontWeight: FONT.weight.extrabold, color: "#fff" },
});
