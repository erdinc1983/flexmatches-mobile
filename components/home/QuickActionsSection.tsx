/**
 * QuickActionsSection
 *
 * 4 tiles: Discover · Chat · Circles · Gym toggle
 *
 * The Gym tile is interactive — it toggles at-gym status without navigation.
 * Chat tile shows an unread badge when applicable.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useTheme, SPACE, FONT, RADIUS } from "../../lib/theme";
import { Icon, IconName } from "../Icon";
import { CountBadge } from "../ui/Badge";
import { SectionHeader } from "../ui/SectionHeader";

type Props = {
  unreadCount: number;
  isAtGym:     boolean;
  gymToggling: boolean;
  onToggleGym: () => void;
};

export function QuickActionsSection({ unreadCount, isAtGym, gymToggling, onToggleGym }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={{ gap: SPACE[10] }}>
      <SectionHeader title="Quick Actions" />
      <View style={s.grid}>
        {/* Discover */}
        <Tile
          icon="discover"
          label="Discover"
          sub="Find partners"
          onPress={() => router.push("/(tabs)/discover")}
        />

        {/* Chat */}
        <Tile
          icon="chat"
          label="Chat"
          sub="Messages"
          badge={unreadCount}
          onPress={() => router.push("/(tabs)/messages")}
        />

        {/* Circles */}
        <Tile
          icon="circles"
          label="Circles"
          sub="Communities"
          onPress={() => router.push("/(tabs)/circles" as any)}
        />

        {/* Gym toggle */}
        <GymTile
          isAtGym={isAtGym}
          toggling={gymToggling}
          onPress={onToggleGym}
        />
      </View>
    </View>
  );
}

// ─── Tile ─────────────────────────────────────────────────────────────────────
function Tile({
  icon, label, sub, onPress, badge,
}: { icon: IconName; label: string; sub: string; onPress: () => void; badge?: number }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <TouchableOpacity
      style={[s.tile, { backgroundColor: c.bgCard, borderColor: c.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={{ position: "relative", alignSelf: "flex-start" }}>
        <View style={[s.tileIcon, { backgroundColor: c.bgCardAlt }]}>
          <Icon name={icon} size={20} color={c.brand} />
        </View>
        {badge != null && badge > 0 && (
          <View style={{ position: "absolute", top: -4, right: -4 }}>
            <CountBadge count={badge} />
          </View>
        )}
      </View>
      <Text style={[s.tileLabel, { color: c.text }]}>{label}</Text>
      <Text style={[s.tileSub, { color: c.textMuted }]}>{sub}</Text>
    </TouchableOpacity>
  );
}

// ─── Gym Tile — special interactive tile ─────────────────────────────────────
function GymTile({ isAtGym, toggling, onPress }: { isAtGym: boolean; toggling: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const activeBg     = "#0D2D1A";
  const activeBorder = "#166534";
  const activeIcon   = "#22C55E";
  const activeText   = "#22C55E";

  return (
    <TouchableOpacity
      style={[
        s.tile,
        isAtGym
          ? { backgroundColor: activeBg, borderColor: activeBorder }
          : { backgroundColor: c.bgCard, borderColor: c.border },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      disabled={toggling}
    >
      <View style={[s.tileIcon, { backgroundColor: isAtGym ? "#16A34A22" : c.bgCardAlt }]}>
        {toggling
          ? <ActivityIndicator size="small" color={isAtGym ? activeIcon : c.brand} />
          : <Icon name={isAtGym ? "gymActive" : "gym"} size={20} color={isAtGym ? activeIcon : c.brand} />
        }
      </View>
      <Text style={[s.tileLabel, { color: isAtGym ? activeText : c.text }]}>
        {isAtGym ? "At Gym" : "Gym"}
      </Text>
      <Text style={[s.tileSub, { color: isAtGym ? "#16A34A" : c.textMuted }]}>
        {isAtGym ? "Checked in" : "Check in"}
      </Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  grid:      { flexDirection: "row", flexWrap: "wrap", gap: SPACE[12] },
  tile:      { width: "47.5%", borderRadius: RADIUS.xl, padding: SPACE[16], gap: SPACE[6], borderWidth: 1 },
  tileIcon:  { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  tileLabel: { fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold, marginTop: SPACE[4] },
  tileSub:   { fontSize: FONT.size.sm },
});
