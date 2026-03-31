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
    <View style={s.row}>
      <Chip value={`${streak}d`}      label="Day Streak" c={c} />
      <Chip value={`${matchCount}`}   label="Matches"    c={c} />
      <Chip value={`${weekSessions}`} label="Sessions"   c={c} />
    </View>
  );
}

function Chip({ value, label, c }: {
  value: string;
  label: string;
  c:    ReturnType<typeof useTheme>["theme"]["colors"];
}) {
  return (
    <View style={[s.chip, { backgroundColor: c.bgCard, borderColor: c.border }, SHADOW.sm]}>
      <Text style={[s.value, { color: c.text }]}>{value}</Text>
      <Text style={[s.label, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row:   { flexDirection: "row", gap: SPACE[8] },
  chip:  {
    flex: 1,
    alignItems: "center",
    paddingVertical: SPACE[12],
    paddingHorizontal: SPACE[6],
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    gap: SPACE[2],
  },
  value: { fontSize: FONT.size.xl, fontWeight: FONT.weight.black, letterSpacing: -0.5 },
  label: { fontSize: 11, fontWeight: FONT.weight.semibold, letterSpacing: 0.1, textAlign: "center" },
});
