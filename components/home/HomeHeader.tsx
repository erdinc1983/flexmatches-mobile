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
  streak:      number;
  isAtGym:     boolean;
};

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function dynamicSubtitle(streak: number, isAtGym: boolean): string {
  if (isAtGym)     return "You're at the gym — let's go";
  if (streak >= 7) return `${streak} days strong — you're on fire`;
  if (streak >= 3) return `Day ${streak} — keep the momentum`;
  if (streak === 1) return "Day 1! Great start";
  return "Ready to train today?";
}

export function HomeHeader({ name, avatarUrl, unreadCount, streak, isAtGym }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={s.row}>
      {/* Left: avatar + greeting block */}
      <TouchableOpacity
        style={s.left}
        onPress={() => router.push("/(tabs)/profile")}
        activeOpacity={0.85}
      >
        <Avatar url={avatarUrl} name={name || "?"} size={48} />
        <View style={s.greetingBlock}>
          <Text style={[s.greeting, { color: c.text }]} numberOfLines={1}>
            {timeGreeting()}, {name || "there"}
          </Text>
          <Text style={[s.subtitle, { color: c.textMuted }]} numberOfLines={1}>
            {dynamicSubtitle(streak, isAtGym)}
          </Text>
        </View>
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
  row:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  left:          { flexDirection: "row", alignItems: "center", gap: SPACE[12], flex: 1 },
  greetingBlock: { flex: 1, gap: 2 },
  greeting:      { fontSize: FONT.size.xl, fontWeight: FONT.weight.black, letterSpacing: -0.5 },
  subtitle:      { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium },
  rightBtns:     { flexDirection: "row", gap: SPACE[8] },
  iconBtn:       {
    width: 42, height: 42, borderRadius: RADIUS.pill,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, ...SHADOW.sm, flexShrink: 0,
  },
  dot: {
    position: "absolute", top: 8, right: 8,
    width: 7, height: 7, borderRadius: 3.5,
  },
});
