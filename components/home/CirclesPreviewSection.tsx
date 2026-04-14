/**
 * CirclesPreviewSection — "My Circles"
 * 2-column grid of full sport-photo cards with gradient overlay.
 * Replaces the flat emoji+colour cards with Apple-style photo heroes.
 */

import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ImageBackground, Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "../Icon";
import { router } from "expo-router";
import { useTheme, SPACE, FONT, RADIUS, SHADOW } from "../../lib/theme";
import { SectionHeader } from "../ui/SectionHeader";
import { getSportPhoto } from "../../lib/sportPhotos";
import type { CirclePreview } from "./types";

type Props = {
  circles:    CirclePreview[];
  onPress?:   (circle: CirclePreview) => void;
  onDismiss?: (id: string) => void;
};

export function CirclesPreviewSection({ circles, onPress, onDismiss }: Props) {
  if (circles.length === 0) return null;
  const visible = circles.slice(0, 4);

  return (
    <View style={{ gap: SPACE[12] }}>
      <SectionHeader
        title="My Circles"
        action={{ label: "See all", onPress: () => router.push("/(tabs)/circles" as any) }}
      />
      <View style={s.grid}>
        {visible.map((circle) => (
          <CircleCard key={circle.id} circle={circle} onPress={onPress} onDismiss={onDismiss} />
        ))}
      </View>
    </View>
  );
}

function CircleCard({ circle, onPress, onDismiss }: {
  circle: CirclePreview;
  onPress?: (c: CirclePreview) => void;
  onDismiss?: (id: string) => void;
}) {
  const { theme } = useTheme();
  const _c = theme.colors;

  const photoUri = getSportPhoto(circle.sport, circle.name);

  const hasDate = !!circle.event_date;
  const dateLabel = hasDate ? formatCardDate(circle.event_date!) : null;

  return (
    <TouchableOpacity
      style={[s.card, SHADOW.md]}
      onPress={() => onPress ? onPress(circle) : router.push("/(tabs)/circles" as any)}
      activeOpacity={0.88}
    >
      {/* Dismiss X */}
      {onDismiss && (
        <Pressable
          style={s.dismissBtn}
          onPress={(e) => { e.stopPropagation?.(); onDismiss(circle.id); }}
          hitSlop={8}
        >
          <View style={s.dismissCircle}>
            <Icon name="close" size={10} color="#fff" />
          </View>
        </Pressable>
      )}

      {/* Sport photo background */}
      <ImageBackground
        source={{ uri: photoUri }}
        style={s.photo}
        resizeMode="cover"
      >
        {/* Emoji badge top-left */}
        <View style={s.emojiBadge}>
          <Text style={s.emoji}>{circle.icon ?? "🏟️"}</Text>
        </View>

        {/* Gradient + content */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.78)"]}
          style={s.gradient}
          pointerEvents="none"
        >
          <View style={s.bottomContent}>
            {/* Event date chip */}
            {dateLabel && (
              <View style={s.dateBadge}>
                <Icon name="calendar" size={10} color="rgba(255,255,255,0.85)" />
                <Text style={s.dateText}>{dateLabel}</Text>
              </View>
            )}

            <Text style={s.name} numberOfLines={2}>{circle.name}</Text>

            <View style={s.footer}>
              <View style={s.memberRow}>
                <Icon name="circlesActive" size={11} color="rgba(255,255,255,0.70)" />
                <Text style={s.memberCount}>
                  {circle.member_count} {circle.member_count === 1 ? "member" : "members"}
                </Text>
              </View>

              <View style={s.viewBtn}>
                <Text style={s.viewBtnText}>View</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </TouchableOpacity>
  );
}

function formatCardDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date  = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

const CARD_H = 165;

const s = StyleSheet.create({
  grid:         { flexDirection: "row", gap: SPACE[10] },
  card:         { flex: 1, borderRadius: RADIUS.xl, overflow: "hidden", height: CARD_H },
  photo:        { flex: 1 },

  // Emoji badge
  emojiBadge:   {
    position: "absolute", top: SPACE[10], left: SPACE[10],
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.38)",
    alignItems: "center", justifyContent: "center",
  },
  emoji:        { fontSize: 18 },

  // Dismiss
  dismissBtn:   { position: "absolute", top: SPACE[8], right: SPACE[8], zIndex: 10 },
  dismissCircle:{ width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.50)", alignItems: "center", justifyContent: "center" },

  // Gradient bottom area
  gradient:     { position: "absolute", bottom: 0, left: 0, right: 0, height: CARD_H * 0.70, justifyContent: "flex-end" },
  bottomContent:{ padding: SPACE[12], gap: SPACE[4] },

  name:         { fontSize: 13, fontWeight: FONT.weight.bold, color: "#fff", letterSpacing: -0.2, lineHeight: 17 },

  footer:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: SPACE[4] },
  memberRow:    { flexDirection: "row", alignItems: "center", gap: 4 },
  memberCount:  { fontSize: 11, color: "rgba(255,255,255,0.70)", fontWeight: FONT.weight.semibold },

  viewBtn:      { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: RADIUS.pill, paddingHorizontal: SPACE[10], paddingVertical: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  viewBtnText:  { fontSize: 11, fontWeight: FONT.weight.bold, color: "#fff" },

  dateBadge:    { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: SPACE[2] },
  dateText:     { fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: FONT.weight.semibold },
});
