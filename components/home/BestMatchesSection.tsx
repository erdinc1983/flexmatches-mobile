/**
 * BestMatchesSection — "Today's Matches"
 * Horizontally scrollable photo cards. Uses expo-image (same as Avatar)
 * so Supabase URLs resolve correctly.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useTheme, SPACE, FONT, RADIUS, SHADOW, TYPE } from "../../lib/theme";
import { SectionHeader } from "../ui/SectionHeader";
import { resolveUrl } from "../Avatar";
import type { SuggestedUser } from "./types";

const SCREEN_W = Dimensions.get("window").width;
const H_PAD    = 20; // home screen's paddingHorizontal SPACE[20]
const CARD_GAP = 12; // gap in contentContainerStyle SPACE[12]
const CARD_W   = (SCREEN_W - H_PAD * 2 - CARD_GAP) / 2;

// Cartoon fallback — same logic as Avatar.tsx
const WEB_BASE = "https://flexmatches.com";
const MALE_AVATARS   = Array.from({ length: 12 }, (_, i) => `${WEB_BASE}/avatars/male/m${i + 1}.jpeg`);
const FEMALE_AVATARS = Array.from({ length: 12 }, (_, i) => `${WEB_BASE}/avatars/female/f${i + 1}.jpeg`);
const ALL_AVATARS    = [...MALE_AVATARS, ...FEMALE_AVATARS];
function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}
function cartoonAvatar(name: string): string {
  return ALL_AVATARS[nameHash(name?.trim() || "user") % ALL_AVATARS.length];
}

type Props = {
  users:   SuggestedUser[];
  onPress: (user: SuggestedUser) => void;
};

export function BestMatchesSection({ users, onPress }: Props) {
  if (users.length === 0) return null;

  return (
    <View style={{ gap: SPACE[12] }}>
      <SectionHeader
        title="Today's Matches"
        action={{ label: "See all", onPress: () => router.push("/(tabs)/discover") }}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: SPACE[12], paddingRight: 4 }}
      >
        {users.map((user) => (
          <MatchPhotoCard key={user.id} user={user} onPress={() => onPress(user)} />
        ))}
      </ScrollView>
    </View>
  );
}

function MatchPhotoCard({ user, onPress }: { user: SuggestedUser; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const rawName     = user.full_name?.split(" ")[0] ?? user.username;
  const isUUID      = /^[0-9a-f-]{20,}$/i.test(rawName);
  const displayName = isUUID ? "Member" : rawName;

  // Resolve URL — same logic as Avatar component
  const resolvedUrl = resolveUrl(user.avatar_url);
  const fallbackUrl = cartoonAvatar(displayName);
  const photoUrl    = resolvedUrl ?? fallbackUrl;

  const tags = [
    ...(user.shared_sports ?? []),
    ...(user.reasons ?? []),
  ]
    .filter((r, i, arr) => arr.indexOf(r) === i)
    .slice(0, 2);

  return (
    <TouchableOpacity style={[s.card, { backgroundColor: c.bgCard }, SHADOW.md]} onPress={onPress} activeOpacity={0.88}>
      {/* expo-image as background — handles Supabase URLs same as Avatar */}
      <Image
        source={{ uri: photoUrl }}
        style={s.photo}
        contentFit="cover"
        placeholder={{ blurhash: "LKHBBd~q9F%M%MIUofRj00M{D%of" }}
        transition={200}
      />

      {/* Gradient overlay */}
      <LinearGradient
        colors={["transparent", "rgba(10,5,2,0.80)"]}
        style={s.gradient}
        pointerEvents="none"
      />

      {/* Content */}
      <View style={s.info}>
        <Text style={s.labelName} numberOfLines={1}>{displayName}</Text>
        {tags.length > 0 && (
          <View style={s.tagsRow}>
            {tags.map((tag) => (
              <View key={tag} style={s.tag}>
                <Text style={s.tagText} numberOfLines={1}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity style={s.connectBtn} onPress={onPress} activeOpacity={0.85}>
          <Text style={s.connectText}>Connect</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card:      { width: CARD_W, height: 240, borderRadius: RADIUS.xl, overflow: "hidden" },
  photo:     { position: "absolute", top: 0, left: 0, width: CARD_W, height: 240 },
  gradient:  { position: "absolute", bottom: 0, left: 0, right: 0, height: 160 },
  info:      { position: "absolute", bottom: 0, left: 0, right: 0, padding: SPACE[14], gap: SPACE[6] },
  labelName: { ...TYPE.cardTitle, color: "#fff", letterSpacing: -0.3 },
  tagsRow:   { flexDirection: "row", gap: SPACE[4] },
  tag:       { backgroundColor: "rgba(255,255,255,0.14)", borderRadius: RADIUS.pill, paddingHorizontal: SPACE[8], paddingVertical: 3, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  tagText:   { fontSize: 11, fontWeight: FONT.weight.semibold, color: "rgba(255,255,255,0.88)" },
  connectBtn:{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: RADIUS.md, paddingVertical: SPACE[8], alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
  connectText:{ fontSize: 13, fontWeight: FONT.weight.bold, color: "#fff" },
});
