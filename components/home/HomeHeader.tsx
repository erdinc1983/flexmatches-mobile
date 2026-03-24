import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTheme, SPACE, FONT, RADIUS } from "../../lib/theme";

type Props = {
  name:     string;
  greeting: string;
};

export function HomeHeader({ name, greeting }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const initial = name[0]?.toUpperCase() ?? "?";

  return (
    <View style={s.row}>
      <View>
        <Text style={[s.greeting, { color: c.textMuted }]}>{greeting}</Text>
        <Text style={[s.name, { color: c.text }]}>{name}</Text>
      </View>
      <TouchableOpacity
        style={[s.avatar, { backgroundColor: c.brand }]}
        onPress={() => router.push("/(tabs)/profile")}
        activeOpacity={0.85}
      >
        <Text style={s.initial}>{initial}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting:{ fontSize: FONT.size.sm, fontWeight: FONT.weight.medium },
  name:    { fontSize: FONT.size.xxxl, fontWeight: FONT.weight.black, letterSpacing: -0.5, marginTop: 2 },
  avatar:  { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  initial: { fontSize: FONT.size.lg, fontWeight: FONT.weight.extrabold, color: "#fff" },
});
