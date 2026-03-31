import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useTheme, SPACE, FONT, RADIUS, SHADOW } from "../../lib/theme";

type Props = {
  streak:       number;
  matchCount:   number;
  weekSessions: number;
};

export function MomentumStrip({ streak, matchCount, weekSessions }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
    >
      <Chip emoji="🔥" value={streak}       label="Day Streak"       />
      <Chip emoji="🤝" value={matchCount}   label="Matches"          />
      <Chip emoji="🏋️" value={weekSessions} label="Sessions This Week" />
    </ScrollView>
  );
}

function Chip({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[s.chip, { backgroundColor: c.bgCard, borderColor: c.border }, SHADOW.sm]}>
      <Text style={s.emoji}>{emoji}</Text>
      <Text style={[s.value, { color: c.text }]}>{value}</Text>
      <Text style={[s.label, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row:   { flexDirection: "row", gap: SPACE[10], paddingRight: SPACE[4] },
  chip:  {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE[6],
    paddingVertical: SPACE[10],
    paddingHorizontal: SPACE[14],
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  emoji: { fontSize: 16 },
  value: { fontSize: FONT.size.base, fontWeight: FONT.weight.black },
  label: { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium },
});
