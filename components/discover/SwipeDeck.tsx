/**
 * SwipeDeck
 *
 * Tinder-style card stack for Discover.
 *   - Swipe right → Like (sends match request)
 *   - Swipe left  → Pass (records in passes table)
 *   - Fast velocity swipe also triggers, not just distance
 *   - Top card rotates while dragging; LIKED / NOPE overlays appear
 *   - Cards 2 & 3 scale up as card 1 leaves
 *   - Action buttons: ✕ Pass · ℹ Info · ❤ Like
 */

import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Animated, PanResponder,
  TouchableOpacity, Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../../lib/theme";
import { resolveUrl } from "../Avatar";
import { Icon } from "../Icon";
import type { DiscoverUser, RequestStatus } from "./PersonCard";

// Cartoon avatar fallback — same as Avatar.tsx
const WEB_BASE = "https://flexmatches.com";
const MALE_AVATARS   = Array.from({ length: 12 }, (_, i) => `${WEB_BASE}/avatars/male/m${i + 1}.jpeg`);
const FEMALE_AVATARS = Array.from({ length: 12 }, (_, i) => `${WEB_BASE}/avatars/female/f${i + 1}.jpeg`);
const ALL_AVATARS    = [...MALE_AVATARS, ...FEMALE_AVATARS];
function nameHash(n: string) { let h = 0; for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h << 5) - h); return Math.abs(h); }
function cartoonAvatar(name: string) { return ALL_AVATARS[nameHash(name?.trim() || "user") % ALL_AVATARS.length]; }
function reasonIcon(r: string): string {
  const l = r.toLowerCase();
  if (l.includes("sport") || l.includes("shared")) return "🎯";
  if (l.includes("level"))                          return "⚡";
  if (l.includes("near") || l.includes("city") || l.includes("km")) return "📍";
  if (l.includes("train") || l.includes("morning") || l.includes("afternoon") || l.includes("evening") || l.includes("weekend")) return "📅";
  if (l.includes("mentor") || l.includes("partner")) return "🤝";
  return "✓";
}

const { width: W, height: H } = Dimensions.get("window");
const CARD_H          = H * 0.60;
const PHOTO_H         = Math.round(CARD_H * 0.54);
const SWIPE_THRESHOLD = 100;
const SWIPE_DURATION  = 230;

const LEVEL_COLOR: Record<string, string> = {
  beginner: "#22C55E", intermediate: "#F59E0B", advanced: "#FF4500",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Props = {
  users:       DiscoverUser[];
  statuses:    Record<string, RequestStatus>;
  onLike:      (userId: string) => void;
  onPass:      (userId: string) => void;
  onCardPress: (user: DiscoverUser) => void;
  canUndo?:    boolean;
  onUndo?:     () => void;
};

export type SwipeDeckRef = { undoLast: () => void };

// ─── SwipeDeck ────────────────────────────────────────────────────────────────
export const SwipeDeck = forwardRef<SwipeDeckRef, Props>(function SwipeDeck(
  { users, statuses, onLike, onPass, onCardPress, canUndo = false, onUndo }, ref
) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [currentIndex, setCurrentIndex] = useState(0);
  const pan = useRef(new Animated.ValueXY()).current;

  // ── Refs so the stale PanResponder closure always reads latest values ────────
  // PanResponder is created once (useRef), so any direct captures would be stale.
  // Storing commitSwipe in a ref means the PanResponder always calls the current version.
  const commitSwipeRef = useRef<(direction: "right" | "left") => void>(() => {});

  useImperativeHandle(ref, () => ({
    undoLast: () => setCurrentIndex((i) => Math.max(0, i - 1)),
  }));

  const rotate = pan.x.interpolate({
    inputRange: [-300, 0, 300],
    outputRange: ["-14deg", "0deg", "14deg"],
    extrapolate: "clamp",
  });
  const likeOpacity = pan.x.interpolate({ inputRange: [20, 100], outputRange: [0, 1], extrapolate: "clamp" });
  const passOpacity = pan.x.interpolate({ inputRange: [-100, -20], outputRange: [1, 0], extrapolate: "clamp" });
  const nextScale   = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
    outputRange: [1, 0.94, 1],
    extrapolate: "clamp",
  });

  // PanResponder calls commitSwipeRef.current — always the latest commitSwipe.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, { dx, vx }) => {
        const hardSwipe = Math.abs(dx) > SWIPE_THRESHOLD;
        const fastSwipe = Math.abs(vx) > 0.6 && Math.abs(dx) > 50;
        if (hardSwipe || fastSwipe) {
          commitSwipeRef.current(dx > 0 ? "right" : "left");
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 5 }).start();
        }
      },
    })
  ).current;

  // commitSwipe is redefined each render — so users & currentIndex are always fresh.
  // We update the ref so the PanResponder picks up the latest version.
  function commitSwipe(direction: "right" | "left") {
    const toX = direction === "right" ? W + 100 : -(W + 100);
    Animated.timing(pan, { toValue: { x: toX, y: 0 }, duration: SWIPE_DURATION, useNativeDriver: false }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      const user = users[currentIndex];
      if (user) {
        if (direction === "right") onLike(user.id);
        else onPass(user.id);
      }
      setCurrentIndex((i) => i + 1);
    });
  }
  commitSwipeRef.current = commitSwipe;

  if (currentIndex >= users.length) {
    return (
      <View style={[deck.empty, { backgroundColor: c.bg }]}>
        <Text style={deck.emptyEmoji}>🎉</Text>
        <Text style={[deck.emptyTitle, { color: c.text }]}>You've seen everyone!</Text>
        <Text style={[deck.emptySub, { color: c.textMuted }]}>Pull to refresh for new matches.</Text>
      </View>
    );
  }

  return (
    <View style={deck.root}>
      {/* Cards — rendered bottom-up so index+0 is on top */}
      <View style={deck.stack}>
        {[2, 1, 0].map((offset) => {
          const idx = currentIndex + offset;
          if (idx >= users.length) return null;
          const user = users[idx];
          const status = statuses[user.id] ?? "none";

          if (offset === 0) {
            return (
              <Animated.View
                key={user.id}
                style={[deck.card, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] }]}
                {...panResponder.panHandlers}
              >
                {/* Overlays */}
                <Animated.View style={[deck.likeOverlay, { opacity: likeOpacity }]}>
                  <Text style={deck.likeText}>LIKED ✦</Text>
                </Animated.View>
                <Animated.View style={[deck.passOverlay, { opacity: passOpacity }]}>
                  <Text style={deck.passText}>NOPE ✕</Text>
                </Animated.View>
                <SwipeCardContent user={user} status={status} onInfoPress={() => onCardPress(user)} />
              </Animated.View>
            );
          }

          // Background cards
          const scale     = offset === 1 ? nextScale : 0.88;
          const translateY = offset === 1 ? -12 : -24;
          return (
            <Animated.View
              key={user.id}
              pointerEvents="none"
              style={[deck.card, deck.bgCard, { transform: [{ scale: scale as any }, { translateY }] }]}
            >
              <SwipeCardContent user={user} status={status} onInfoPress={() => {}} />
            </Animated.View>
          );
        })}
      </View>

      {/* Action buttons */}
      <View style={deck.actions}>
        {/* Undo last swipe — always visible, grayed when nothing to undo */}
        <ActionBtn
          emoji="↩"
          bg={canUndo ? "#3B82F618" : "transparent"}
          border={canUndo ? "#3B82F6" : "#9CA3AF44"}
          color={canUndo ? "#3B82F6" : "#9CA3AF55"}
          size={46}
          onPress={() => canUndo && onUndo?.()}
        />
        <ActionBtn emoji="✕"  bg="#FF450020" border="#FF4500" color="#FF4500" size={58} onPress={() => commitSwipe("left")} />
        <ActionBtn emoji="ℹ️" bg="transparent" border="#9CA3AF" color="#9CA3AF" size={46} onPress={() => onCardPress(users[currentIndex])} />
        <ActionBtn emoji="✦" bg={PALETTE.success + "20"} border={PALETTE.success} color={PALETTE.success} size={58} onPress={() => commitSwipe("right")} />
      </View>
    </View>
  );
});

// ─── Card content ─────────────────────────────────────────────────────────────
function SwipeCardContent({ user, status, onInfoPress }: {
  user: DiscoverUser; status: RequestStatus; onInfoPress: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const rawName     = user.full_name ?? user.username;
  const isUUID      = /^[0-9a-f-]{20,}$/i.test(rawName);
  const displayName = isUUID ? "Member" : rawName;

  const resolvedUrl = resolveUrl(user.avatar_url);
  const fallbackUrl = cartoonAvatar(displayName);
  const photoUrl    = resolvedUrl ?? fallbackUrl;

  const levelColor = user.fitness_level ? LEVEL_COLOR[user.fitness_level] : "#9CA3AF";
  const activeStr  = formatActive(user.last_active);
  const sports     = (user.sports ?? []).slice(0, 4);

  const scoreColor =
    user.matchScore >= 70 ? PALETTE.success :
    user.matchScore >= 45 ? "#3B82F6" :
    user.matchScore >= 25 ? "#F59E0B" : "#9CA3AF";

  return (
    <View style={[card.root, { backgroundColor: c.bgCard }]}>

      {/* ── Photo section ──────────────────────────────────────────── */}
      <View style={{ height: PHOTO_H }}>
        <Image
          source={{ uri: photoUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          placeholder={{ uri: fallbackUrl }}
          transition={200}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.0)", "rgba(0,0,0,0.0)", "rgba(0,0,0,0.72)"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* At gym badge — top left */}
        {user.is_at_gym && (
          <View style={card.gymBadge}>
            <View style={card.gymDot} />
            <Text style={card.gymBadgeText}>At gym</Text>
          </View>
        )}

        {/* Match score — top right */}
        <View style={[card.scorePill, { backgroundColor: scoreColor + "DD" }]}>
          <Text style={card.scoreText}>{user.matchScore}% match</Text>
        </View>

        {/* Name + meta overlay — bottom of photo */}
        <View style={card.nameOverlay}>
          <View style={card.nameRow}>
            <Text style={card.name} numberOfLines={1}>{displayName}</Text>
            {user.age != null && <Text style={card.age}>{user.age}</Text>}
          </View>
          <View style={card.metaRow}>
            {user.fitness_level && (
              <View style={[card.levelBadge, { backgroundColor: levelColor + "30", borderColor: levelColor + "70" }]}>
                <Text style={[card.levelText, { color: levelColor }]}>{user.fitness_level}</Text>
              </View>
            )}
            {activeStr !== "" && (
              <Text style={[card.activeTime, { color: activeStr === "Active now" ? "#4ADE80" : "rgba(255,255,255,0.70)" }]}>
                {activeStr === "Active now" ? "● Active now" : activeStr}
              </Text>
            )}
            {user.city && (
              <Text style={card.cityText} numberOfLines={1}>· {user.city}</Text>
            )}
          </View>
        </View>
      </View>

      {/* ── Info section ───────────────────────────────────────────── */}
      <View style={[card.info, { backgroundColor: c.bgCard }]}>

        {/* Why this works header */}
        <View style={card.whyRow}>
          <Text style={[card.whyLabel, { color: c.textMuted }]}>✦ Why this works</Text>
          <View style={[card.matchPill, { backgroundColor: scoreColor + "20", borderColor: scoreColor + "50" }]}>
            <Text style={[card.matchPillText, { color: scoreColor }]}>{user.matchScore}% match</Text>
          </View>
        </View>

        {/* Reasons */}
        {user.reasons.length > 0 ? (
          <View style={card.reasons}>
            {user.reasons.map((r) => (
              <View key={r} style={card.reasonRow}>
                <Text style={card.reasonIcon}>{reasonIcon(r)}</Text>
                <Text style={[card.reasonText, { color: c.textSecondary }]}>{r}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={card.reasons}>
            <View style={card.reasonRow}>
              <Text style={card.reasonIcon}>✨</Text>
              <Text style={[card.reasonText, { color: c.textMuted }]}>New to FlexMatches</Text>
            </View>
          </View>
        )}

        {/* Sports chips */}
        {sports.length > 0 && (
          <View style={card.sports}>
            {sports.map((sp) => (
              <View key={sp} style={[card.sportChip, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                <Text style={[card.sportText, { color: c.textSecondary }]}>{sp}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Status row */}
        {status === "pending" && (
          <View style={[card.statusRow, { backgroundColor: "#F59E0B18", borderColor: "#F59E0B44" }]}>
            <Icon name="clock" size={13} color="#F59E0B" />
            <Text style={[card.statusText, { color: "#F59E0B" }]}>Request pending</Text>
          </View>
        )}
        {status === "accepted" && (
          <View style={[card.statusRow, { backgroundColor: PALETTE.success + "18", borderColor: PALETTE.success + "44" }]}>
            <Icon name="checkActive" size={13} color={PALETTE.success} />
            <Text style={[card.statusText, { color: PALETTE.success }]}>Connected ✓ — Open chat</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function ActionBtn({ emoji, bg, border, color, size, onPress }: {
  emoji: string; bg: string; border: string; color: string; size: number; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[deck.actionBtn, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderColor: border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={{ fontSize: size * 0.42 }}>{emoji}</Text>
    </TouchableOpacity>
  );
}

function formatActive(iso: string | null): string {
  if (!iso) return "";
  const hrs = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (hrs < 1)   return "Active now";
  if (hrs < 24)  return `${Math.floor(hrs)}h ago`;
  if (hrs < 168) return `${Math.floor(hrs / 24)}d ago`;
  return "";
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const deck = StyleSheet.create({
  root:     { flex: 1 },
  stack:    { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingHorizontal: SPACE[16], paddingTop: SPACE[8] },
  card:     { position: "absolute", width: W - SPACE[32], height: CARD_H, borderRadius: RADIUS.xxl, overflow: "hidden", elevation: 4, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  bgCard:   { elevation: 1 },

  likeOverlay: { position: "absolute", top: SPACE[24], left: SPACE[20], zIndex: 10, transform: [{ rotate: "-20deg" }], borderWidth: 3, borderColor: "#22C55E", borderRadius: RADIUS.md, paddingHorizontal: SPACE[12], paddingVertical: SPACE[4] },
  likeText:    { fontSize: FONT.size.xxl, fontWeight: FONT.weight.black, color: "#22C55E" },
  passOverlay: { position: "absolute", top: SPACE[24], right: SPACE[20], zIndex: 10, transform: [{ rotate: "20deg" }], borderWidth: 3, borderColor: "#FF4500", borderRadius: RADIUS.md, paddingHorizontal: SPACE[12], paddingVertical: SPACE[4] },
  passText:    { fontSize: FONT.size.xxl, fontWeight: FONT.weight.black, color: "#FF4500" },

  actions:   { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: SPACE[28], paddingVertical: SPACE[20] },
  actionBtn: { alignItems: "center", justifyContent: "center", borderWidth: 2 },

  empty:      { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE[10] },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: FONT.size.xl, fontWeight: FONT.weight.black },
  emptySub:   { fontSize: FONT.size.base },
});

const card = StyleSheet.create({
  root:       { flex: 1, overflow: "hidden" },

  // Photo overlays
  gymBadge:     { position: "absolute", top: SPACE[12], left: SPACE[12], flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.50)", borderRadius: RADIUS.pill, paddingHorizontal: SPACE[10], paddingVertical: 5 },
  gymDot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4ADE80" },
  gymBadgeText: { fontSize: 12, fontWeight: FONT.weight.bold, color: "#fff" },

  scorePill:  { position: "absolute", top: SPACE[12], right: SPACE[12], paddingHorizontal: SPACE[10], paddingVertical: 5, borderRadius: RADIUS.pill },
  scoreText:  { fontSize: 12, fontWeight: FONT.weight.extrabold, color: "#fff" },

  nameOverlay:{ position: "absolute", bottom: 0, left: 0, right: 0, padding: SPACE[14], gap: SPACE[4] },
  nameRow:    { flexDirection: "row", alignItems: "flex-end", gap: SPACE[8] },
  name:       { fontSize: FONT.size.xxl, fontWeight: FONT.weight.black, color: "#fff", letterSpacing: -0.4, flexShrink: 1 },
  age:        { fontSize: FONT.size.lg, fontWeight: FONT.weight.medium, color: "rgba(255,255,255,0.80)", paddingBottom: 2 },
  metaRow:    { flexDirection: "row", alignItems: "center", gap: SPACE[8], flexWrap: "wrap" },
  levelBadge: { paddingHorizontal: SPACE[8], paddingVertical: 2, borderRadius: RADIUS.pill, borderWidth: 1 },
  levelText:  { fontSize: FONT.size.xs, fontWeight: FONT.weight.extrabold, textTransform: "capitalize" },
  activeTime: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
  cityText:   { fontSize: FONT.size.xs, color: "rgba(255,255,255,0.70)", fontWeight: FONT.weight.medium },

  // Info section
  info:       { flex: 1, padding: SPACE[14], gap: SPACE[10] },

  whyRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  whyLabel:   { fontSize: 11, fontWeight: FONT.weight.bold, letterSpacing: 0.3, textTransform: "uppercase" },
  matchPill:  { paddingHorizontal: SPACE[8], paddingVertical: 3, borderRadius: RADIUS.pill, borderWidth: 1 },
  matchPillText: { fontSize: 11, fontWeight: FONT.weight.extrabold },

  reasons:    { gap: SPACE[4] },
  reasonRow:  { flexDirection: "row", alignItems: "center", gap: SPACE[8] },
  reasonIcon: { fontSize: 13, width: 18 },
  reasonText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium, flex: 1 },

  sports:     { flexDirection: "row", flexWrap: "wrap", gap: SPACE[6] },
  sportChip:  { paddingHorizontal: SPACE[8], paddingVertical: 3, borderRadius: RADIUS.sm, borderWidth: 1 },
  sportText:  { fontSize: FONT.size.xs, fontWeight: FONT.weight.medium },

  statusRow:  { flexDirection: "row", alignItems: "center", gap: SPACE[6], borderRadius: RADIUS.md, borderWidth: 1, padding: SPACE[10] },
  statusText: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
});
