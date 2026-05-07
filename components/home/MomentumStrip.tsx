/**
 * CommunityHighlights — compact 4-stat horizontal strip.
 * Single card row: icon + number + label, 4 tappable sections.
 */
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useTheme, SPACE, FONT, RADIUS, SHADOW } from "../../lib/theme";
import { Icon } from "../Icon";
import type { IconName } from "../Icon";

type Props = {
  streak:       number;
  matchCount:   number;
  weekSessions: number;
  circlesCount: number;
};

function Stat({
  icon, iconColor, value, label, onPress, noBorder, a11yLabel,
}: {
  icon:       IconName;
  iconColor:  string;
  value:      string;
  label:      string;
  onPress:    () => void;
  noBorder?:  boolean;
  a11yLabel:  string;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <TouchableOpacity
      style={[ss.cell, !noBorder && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.border }]}
      onPress={onPress}
      activeOpacity={0.65}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      <Icon name={icon} size={15} color={iconColor} />
      <Text style={[ss.value, { color: c.text }]}>{value}</Text>
      <Text style={[ss.label, { color: c.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function MomentumStrip({ streak, matchCount, weekSessions, circlesCount }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[ss.card, { backgroundColor: c.bgCard, borderColor: c.border }, SHADOW.sm]}>
      <Stat
        icon="streakActive" iconColor="#F97316"
        value={streak > 0 ? `${streak}` : "—"}
        label="Streak"
        onPress={() => router.push("/(tabs)/activity" as any)}
        a11yLabel={streak > 0 ? `${streak} day streak. Open activity.` : "No active streak. Open activity."}
      />
      <Stat
        icon="matchActive" iconColor="#FF4500"
        value={`${matchCount}`}
        label="Partners"
        onPress={() => router.push("/(tabs)/matches" as any)}
        a11yLabel={`${matchCount} training partner${matchCount === 1 ? "" : "s"}. Open matches.`}
      />
      <Stat
        icon="calendar" iconColor="#06B6D4"
        value={`${weekSessions}`}
        label="Sessions"
        onPress={() => router.push("/(tabs)/messages" as any)}
        a11yLabel={`${weekSessions} session${weekSessions === 1 ? "" : "s"} this week. Open messages.`}
      />
      <Stat
        icon="circlesActive" iconColor="#8B5CF6"
        value={`${circlesCount}`}
        label="Circles"
        onPress={() => router.push("/(tabs)/circles" as any)}
        noBorder
        a11yLabel={`${circlesCount} circle${circlesCount === 1 ? "" : "s"}. Open circles.`}
      />
    </View>
  );
}

const ss = StyleSheet.create({
  card: {
    flexDirection:  "row",
    borderRadius:   RADIUS.xl,
    borderWidth:    1,
    overflow:       "hidden",
  },
  cell: {
    flex:            1,
    alignItems:      "center",
    justifyContent:  "center",
    paddingVertical: SPACE[12],
    gap:             SPACE[4],
  },
  value: {
    fontSize:      FONT.size.lg,
    fontWeight:    FONT.weight.black,
    letterSpacing: -0.5,
  },
  label: {
    fontSize:   10,
    fontWeight: FONT.weight.semibold,
  },
});
