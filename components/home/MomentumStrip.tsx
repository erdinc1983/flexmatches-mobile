import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme, SPACE, FONT, RADIUS, SHADOW } from "../../lib/theme";

type Props = {
  streak:       number;
  matchCount:   number;
  weekSessions: number;
};

export function MomentumStrip({ streak, matchCount, weekSessions }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }, SHADOW.sm]}>
      <StatItem color={c.brand}   value={`${streak}d`}       label="Streak"   />
      <View style={[s.divider, { backgroundColor: c.border }]} />
      <StatItem color="#3B82F6"   value={`${matchCount}`}    label="Matches"  />
      <View style={[s.divider, { backgroundColor: c.border }]} />
      <StatItem color="#22C55E"   value={`${weekSessions}`}  label="Sessions" />
    </View>
  );
}

function StatItem({ color, value, label }: { color: string; value: string; label: string }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={s.item}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={[s.value, { color: c.text }]}>{value}</Text>
      <Text style={[s.label, { color: c.textFaint }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    paddingVertical: SPACE[16],
    paddingHorizontal: SPACE[10],
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: SPACE[4],
  },
  dot:   { width: 8, height: 8, borderRadius: 4 },
  value: { fontSize: FONT.size.xl, fontWeight: FONT.weight.black, letterSpacing: -0.5 },
  label: { fontSize: 11, fontWeight: FONT.weight.semibold, letterSpacing: 0.2 },
  divider: { width: 1, height: 38, marginHorizontal: SPACE[4] },
});
