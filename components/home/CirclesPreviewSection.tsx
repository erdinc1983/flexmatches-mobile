/**
 * CirclesPreviewSection — "Local Circles"
 * 2 side-by-side cards with emoji, name, member count, Join button.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTheme, SPACE, FONT, RADIUS, SHADOW, TYPE } from "../../lib/theme";
import { SectionHeader } from "../ui/SectionHeader";
import type { CirclePreview } from "./types";

type Props = {
  circles:  CirclePreview[];
  onPress?: (circle: CirclePreview) => void;
};

export function CirclesPreviewSection({ circles, onPress }: Props) {
  if (circles.length === 0) return null;
  const visible = circles.slice(0, 4);

  return (
    <View style={{ gap: SPACE[10] }}>
      <SectionHeader
        title="Local Circles"
        action={{ label: "See all", onPress: () => router.push("/(tabs)/circles" as any) }}
      />
      <View style={s.grid}>
        {visible.map((circle) => (
          <CircleCard key={circle.id} circle={circle} onPress={onPress} />
        ))}
      </View>
    </View>
  );
}

function CircleCard({ circle, onPress }: { circle: CirclePreview; onPress?: (c: CirclePreview) => void }) {
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const BG_LIGHT: Record<string, string> = {
    "🏋️": "#E8F4FD",
    "🏃": "#FFF3E0",
    "⚽": "#E8F5E9",
    "🧘": "#F3E5F5",
    "🚴": "#E0F2F1",
    "🏊": "#E3F2FD",
  };
  const BG_DARK: Record<string, string> = {
    "🏋️": "#0D1A2D",
    "🏃": "#1A1200",
    "⚽": "#0D2D1A",
    "🧘": "#1A0D20",
    "🚴": "#091A18",
    "🏊": "#0A1520",
  };
  const emoji = circle.icon ?? "🏟️";
  const bg    = isDark ? (BG_DARK[emoji] ?? "#1A1610") : (BG_LIGHT[emoji] ?? "#F5F0EA");

  return (
    <TouchableOpacity
      style={[s.card, { borderColor: c.border, ...SHADOW.sm }]}
      onPress={() => onPress ? onPress(circle) : router.push("/(tabs)/circles" as any)}
      activeOpacity={0.85}
    >
      {/* Warm gradient-ish header area */}
      <View style={[s.cardTop, { backgroundColor: bg }]}>
        <Text style={s.emoji}>{emoji}</Text>
      </View>

      {/* Content */}
      <View style={[s.cardBody, { backgroundColor: c.bgCard }]}>
        <Text style={[s.name, { color: c.text }]} numberOfLines={1}>{circle.name}</Text>
        <Text style={[s.members, { color: c.textMuted }]}>
          {circle.member_count} Members Nearby
        </Text>
        <View style={[s.viewBtn, { backgroundColor: c.brand }]}>
          <Text style={s.joinText}>View Details</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  grid:    { flexDirection: "row", gap: SPACE[10] },
  card:    { flex: 1, borderRadius: RADIUS.xl, borderWidth: 1, overflow: "hidden" },
  cardTop: { height: 72, alignItems: "center", justifyContent: "center" },
  emoji:   { fontSize: 32 },
  cardBody:{ padding: SPACE[12], gap: SPACE[6] },
  name:    { ...TYPE.cardTitle },
  members: { ...TYPE.caption },
  viewBtn: { borderRadius: RADIUS.pill, paddingVertical: SPACE[10], alignItems: "center", marginTop: SPACE[6] },
  joinText:{ color: "#fff", ...TYPE.caption, fontWeight: FONT.weight.bold },
});
