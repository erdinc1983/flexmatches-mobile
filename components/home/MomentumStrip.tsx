import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme, SPACE, FONT, RADIUS } from "../../lib/theme";
import { Icon, IconName } from "../Icon";

type Props = {
  streak:         number;
  matchCount:     number;
  workoutsMonth:  number;
};

export function MomentumStrip({ streak, matchCount, workoutsMonth }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[s.strip, { borderColor: c.border, backgroundColor: c.bgCard }]}>
      <Stat icon="streakActive" value={streak}        label="Streak"     color={c.brand}   />
      <View style={[s.div, { backgroundColor: c.border }]} />
      <Stat icon="matchActive"  value={matchCount}    label="Matches"    color="#22C55E"   />
      <View style={[s.div, { backgroundColor: c.border }]} />
      <Stat icon="workout"      value={workoutsMonth} label="This month" color="#A855F7"   />
    </View>
  );
}

function Stat({ icon, value, label, color }: { icon: IconName; value: number; label: string; color: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={s.stat}>
      <Icon name={icon} size={15} color={color} />
      <Text style={[s.value, { color }]}>{value}</Text>
      <Text style={[s.label, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  strip: { flexDirection: "row", alignItems: "center", borderRadius: RADIUS.lg, borderWidth: 1, paddingVertical: SPACE[14] },
  stat:  { flex: 1, alignItems: "center", gap: SPACE[4] },
  div:   { width: 1, height: 30 },
  value: { fontSize: FONT.size.xl, fontWeight: FONT.weight.black },
  label: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
});
