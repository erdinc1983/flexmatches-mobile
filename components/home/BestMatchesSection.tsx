/**
 * BestMatchesSection
 *
 * Horizontal scroll of 2–3 suggested users.
 * Each card leads with the "why this person" reason tags — not just a name + city.
 */

import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTheme, SPACE, FONT, RADIUS } from "../../lib/theme";
import { Icon } from "../Icon";
import { Avatar } from "../Avatar";
import { SectionHeader } from "../ui/SectionHeader";
import type { SuggestedUser } from "./types";

type Props = {
  users:   SuggestedUser[];
  onPress: (user: SuggestedUser) => void;
};

// Tag colour pairs (bg, fg) — rotates through for variety
const TAG_COLORS: Array<[string, string]> = [
  ["#FF450018", "#FF4500"],
  ["#22C55E18", "#22C55E"],
  ["#3B82F618", "#3B82F6"],
  ["#A855F718", "#A855F7"],
];

export function BestMatchesSection({ users, onPress }: Props) {
  if (users.length === 0) return null;

  return (
    <View style={{ gap: SPACE[10] }}>
      <SectionHeader
        title="Top Matches"
        action={{ label: "See all", onPress: () => router.push("/(tabs)/discover") }}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: SPACE[10], paddingRight: SPACE[4] }}
      >
        {users.map((user) => (
          <MatchCard
            key={user.id}
            user={user}
            onPress={() => onPress(user)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function MatchCard({ user, onPress }: { user: SuggestedUser; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Avatar */}
      <Avatar url={user.avatar_url} name={user.full_name ?? user.username} size={48} />

      {/* Name + level */}
      <Text style={[s.name, { color: c.text }]} numberOfLines={1}>
        {user.full_name ?? user.username}
      </Text>
      {user.fitness_level && (
        <Text style={[s.level, { color: c.textMuted }]}>{user.fitness_level}</Text>
      )}

      {/* Reason tags — the "why this person" signal */}
      {user.reasons.length > 0 && (
        <View style={s.tags}>
          {user.reasons.map((reason, i) => {
            const [bg, fg] = TAG_COLORS[i % TAG_COLORS.length];
            return (
              <View key={reason} style={[s.tag, { backgroundColor: bg }]}>
                <Text style={[s.tagText, { color: fg }]}>{reason}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* City footer */}
      {user.city && (
        <View style={s.cityRow}>
          <Icon name="location" size={10} color={c.textFaint} />
          <Text style={[s.city, { color: c.textFaint }]} numberOfLines={1}>{user.city}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card:    { width: 156, borderRadius: RADIUS.lg, padding: SPACE[14], gap: SPACE[6], borderWidth: 1 },
  name:    { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  level:   { fontSize: FONT.size.sm, textTransform: "capitalize" },
  tags:    { flexDirection: "row", flexWrap: "wrap", gap: SPACE[4], marginTop: SPACE[2] },
  tag:     { paddingHorizontal: SPACE[8], paddingVertical: 3, borderRadius: RADIUS.pill },
  tagText: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: SPACE[2] },
  city:    { fontSize: FONT.size.xs },
});
