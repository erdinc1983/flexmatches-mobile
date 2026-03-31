import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
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
      <Chip value={`${streak}d`}      label="Day Streak" c={c} onPress={() => router.push("/(tabs)/activity" as any)} />
      <Chip value={`${matchCount}`}   label="Matches"    c={c} onPress={() => router.push("/(tabs)/matches"  as any)} />
      <Chip value={`${weekSessions}`} label="Sessions"   c={c} onPress={() => router.push("/(tabs)/messages"       )} />
    </View>
  );
}

function Chip({ value, label, c, onPress }: {
  value:   string;
  label:   string;
  c:       ReturnType<typeof useTheme>["theme"]["colors"];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.chip, { backgroundColor: c.bgCard, borderColor: c.border }, SHADOW.sm]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[s.value, { color: c.text }]}>{value}</Text>
      <Text style={[s.label, { color: c.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row:   { flexDirection: "row", gap: SPACE[8] },
  chip:  {
    flex: 1,
    alignItems: "center",
    paddingVertical: SPACE[8],
    paddingHorizontal: SPACE[6],
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: 2,
  },
  value: { fontSize: FONT.size.md, fontWeight: FONT.weight.black, letterSpacing: -0.3 },
  label: { fontSize: 10, fontWeight: FONT.weight.medium, letterSpacing: 0.1, textAlign: "center" },
});
