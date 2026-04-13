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
    <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }, SHADOW.sm]}>
      <Metric
        value={streak > 0 ? `${streak}d` : "—"}
        label="Day Streak"
        emoji="🔥"
        c={c}
        onPress={() => router.push("/(tabs)/activity" as any)}
      />
      <View style={[s.divider, { backgroundColor: c.border }]} />
      <Metric
        value={`${matchCount}`}
        label="Matches"
        emoji="🤝"
        c={c}
        onPress={() => router.push("/(tabs)/matches" as any)}
      />
      <View style={[s.divider, { backgroundColor: c.border }]} />
      <Metric
        value={`${weekSessions}`}
        label="Sessions"
        emoji="📅"
        c={c}
        onPress={() => router.push("/(tabs)/messages")}
      />
    </View>
  );
}

function Metric({ value, label, emoji, c, onPress }: {
  value:   string;
  label:   string;
  emoji:   string;
  c:       ReturnType<typeof useTheme>["theme"]["colors"];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.metric} onPress={onPress} activeOpacity={0.65}>
      <Text style={[s.value, { color: c.text }]}>{value}</Text>
      <Text style={[s.label, { color: c.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection:  "row",
    borderRadius:   RADIUS.xl,
    borderWidth:    1,
    overflow:       "hidden",
  },
  metric: {
    flex:            1,
    alignItems:      "center",
    paddingVertical: SPACE[14],
    gap:             3,
  },
  divider: {
    width:          StyleSheet.hairlineWidth,
    marginVertical: SPACE[10],
  },
  value: {
    fontSize:    FONT.size.xl,
    fontWeight:  FONT.weight.black,
    letterSpacing: -0.5,
  },
  label: {
    fontSize:   10,
    fontWeight: FONT.weight.semibold,
    letterSpacing: 0.1,
  },
});
