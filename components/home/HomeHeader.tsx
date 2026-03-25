import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTheme, SPACE, FONT } from "../../lib/theme";
import { Avatar } from "../Avatar";

type Props = {
  name:      string;
  greeting:  string;
  avatarUrl?: string | null;
};

export function HomeHeader({ name, greeting, avatarUrl }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={s.row}>
      <View>
        <Text style={[s.greeting, { color: c.textMuted }]}>{greeting}</Text>
        <Text style={[s.name, { color: c.text }]}>{name}</Text>
      </View>
      <TouchableOpacity onPress={() => router.push("/(tabs)/profile")} activeOpacity={0.85}>
        <Avatar url={avatarUrl} name={name || "?"} size={44} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting:{ fontSize: FONT.size.sm, fontWeight: FONT.weight.medium },
  name:    { fontSize: FONT.size.xxxl, fontWeight: FONT.weight.black, letterSpacing: -0.5, marginTop: 2 },
});
