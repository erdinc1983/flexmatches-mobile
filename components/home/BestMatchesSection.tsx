/**
 * BestMatchesSection — "Today's Matches"
 * Horizontally scrollable photo cards with gradient overlay,
 * match reason pill tags, name, and Connect button.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, ScrollView, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useTheme, SPACE, FONT, RADIUS, SHADOW, TYPE } from "../../lib/theme";
import { SectionHeader } from "../ui/SectionHeader";
import type { SuggestedUser } from "./types";

const CARD_W = Dimensions.get("window").width * 0.52;

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

  // Build reason tags: prefer shared sports, then generic reasons. Max 2.
  const tags = [
    ...(user.shared_sports ?? []),
    ...(user.reasons ?? []),
  ]
    .filter((r, i, arr) => arr.indexOf(r) === i)  // dedupe
    .slice(0, 2);

  return (
    <TouchableOpacity style={[s.card, SHADOW.md]} onPress={onPress} activeOpacity={0.88}>
      {user.avatar_url ? (
        <ImageBackground
          source={{ uri: user.avatar_url }}
          style={s.photo}
          imageStyle={{ borderRadius: RADIUS.xl }}
          resizeMode="cover"
        >
          <View style={s.topScrim} />
          <LinearGradient
            colors={["transparent", "rgba(10,5,2,0.78)"]}
            style={s.gradient}
          />
          <CardContent displayName={displayName} tags={tags} onPress={onPress} c={c} />
        </ImageBackground>
      ) : (
        <LinearGradient
          colors={["#D4C4B0", "#C4B49F"]}
          style={[s.photo, s.photoFallback]}
        >
          <Text style={s.initial}>{displayName.charAt(0).toUpperCase()}</Text>
          <LinearGradient
            colors={["transparent", "rgba(60,40,20,0.75)"]}
            style={s.gradient}
          />
          <CardContent displayName={displayName} tags={tags} onPress={onPress} c={c} />
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
}

function CardContent({
  displayName, tags, onPress, c,
}: {
  displayName: string;
  tags:        string[];
  onPress:     () => void;
  c:           ReturnType<typeof useTheme>["theme"]["colors"];
}) {
  return (
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
  );
}

const s = StyleSheet.create({
  card:         { width: CARD_W, height: 240, borderRadius: RADIUS.xl, overflow: "hidden" },
  photo:        { flex: 1, justifyContent: "flex-end", borderRadius: RADIUS.xl, overflow: "hidden" },
  topScrim:     { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.08)" },
  gradient:     { position: "absolute", bottom: 0, left: 0, right: 0, height: 160 },
  photoFallback:{ alignItems: "center", justifyContent: "flex-end" },
  initial:      { fontSize: 52, fontWeight: FONT.weight.black, color: "rgba(255,255,255,0.40)", position: "absolute", top: 16 },
  info:         { padding: SPACE[14], gap: SPACE[6] },
  labelName:    { ...TYPE.cardTitle, color: "#fff", letterSpacing: -0.3 },
  tagsRow:      { flexDirection: "row", gap: SPACE[4], flexWrap: "nowrap" },
  tag:          { backgroundColor: "rgba(255,255,255,0.14)", borderRadius: RADIUS.pill, paddingHorizontal: SPACE[8], paddingVertical: 3, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  tagText:      { fontSize: 11, fontWeight: FONT.weight.semibold, color: "rgba(255,255,255,0.88)" },
  connectBtn:   { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: RADIUS.md, paddingVertical: SPACE[8], alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
  connectText:  { fontSize: 13, fontWeight: FONT.weight.bold, color: "#fff" },
});
