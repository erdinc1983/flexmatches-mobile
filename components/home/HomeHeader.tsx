import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTheme, SPACE, FONT, RADIUS, SHADOW } from "../../lib/theme";
import { Avatar } from "../Avatar";
import { Icon } from "../Icon";

type Props = {
  name:        string;
  avatarUrl?:  string | null;
  unreadCount: number;
};

export function HomeHeader({ name, avatarUrl, unreadCount }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={s.row}>
      {/* Left: avatar + "Hi, Name!" */}
      <TouchableOpacity
        style={s.left}
        onPress={() => router.push("/(tabs)/profile")}
        activeOpacity={0.85}
      >
        <Avatar url={avatarUrl} name={name || "?"} size={50} />
        <Text style={[s.greeting, { color: c.text }]} numberOfLines={1}>
          Hi, {name || "there"}!
        </Text>
      </TouchableOpacity>

      {/* Right: search + bell */}
      <View style={s.rightBtns}>
        <TouchableOpacity
          style={[s.iconBtn, { backgroundColor: c.bgCard, borderColor: c.border }]}
          onPress={() => router.push("/search")}
          activeOpacity={0.8}
        >
          <Icon name="search" size={18} color={c.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.iconBtn, { backgroundColor: c.bgCard, borderColor: c.border }]}
          onPress={() => router.push("/notifications")}
          activeOpacity={0.8}
        >
          <Icon name="notification" size={18} color={unreadCount > 0 ? c.brand : c.textMuted} />
          {unreadCount > 0 && (
            <View style={[s.dot, { backgroundColor: c.brand }]} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  left:     { flexDirection: "row", alignItems: "center", gap: SPACE[12], flex: 1 },
  greeting: { fontSize: FONT.size.xxl, fontWeight: FONT.weight.black, letterSpacing: -0.5, flex: 1 },
  rightBtns:{ flexDirection: "row", gap: SPACE[8] },
  iconBtn:  {
    width: 42, height: 42, borderRadius: RADIUS.pill,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, ...SHADOW.sm, flexShrink: 0,
  },
  dot: {
    position: "absolute", top: 8, right: 8,
    width: 7, height: 7, borderRadius: 3.5,
  },
});
