/**
 * CirclesPreviewSection
 *
 * Lightweight — shows max 2 circles. One line each.
 * Tapping navigates to the Circles tab.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTheme, SPACE, FONT, RADIUS } from "../../lib/theme";
import { Icon } from "../Icon";
import { SectionHeader } from "../ui/SectionHeader";
import type { CirclePreview } from "./types";

type Props = {
  circles: CirclePreview[];
};

export function CirclesPreviewSection({ circles }: Props) {
  if (circles.length === 0) return null;

  return (
    <View style={{ gap: SPACE[10] }}>
      <SectionHeader
        title="Active Circles"
        action={{ label: "See all", onPress: () => router.push("/(tabs)/circles" as any) }}
      />
      <View style={{ gap: SPACE[8] }}>
        {circles.map((circle) => (
          <CircleRow key={circle.id} circle={circle} />
        ))}
      </View>
    </View>
  );
}

function CircleRow({ circle }: { circle: CirclePreview }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <TouchableOpacity
      style={[s.row, { backgroundColor: c.bgCard, borderColor: c.border }]}
      onPress={() => router.push("/(tabs)/circles" as any)}
      activeOpacity={0.8}
    >
      <View style={[s.iconWrap, { backgroundColor: c.bgCardAlt }]}>
        <Text style={s.icon}>{circle.icon || "🏋️"}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.name, { color: c.text }]} numberOfLines={1}>{circle.name}</Text>
        <Text style={[s.members, { color: c.textMuted }]}>
          {circle.member_count} {circle.member_count === 1 ? "member" : "members"}
        </Text>
      </View>
      <Icon name="chevronRight" size={16} color={c.textFaint} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "center", gap: SPACE[12], borderRadius: RADIUS.lg, padding: SPACE[12], borderWidth: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  icon:     { fontSize: 20 },
  name:     { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold },
  members:  { fontSize: FONT.size.sm },
});
