/**
 * PrimaryActionCard
 *
 * Renders the top "what to do next" card.
 * Driven by a PrimaryAction discriminated union — each variant
 * has its own copy, icon, colour, and CTA.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useTheme, SPACE, FONT, RADIUS, TYPE } from "../../lib/theme";
import { Icon, IconName } from "../Icon";
import type { PrimaryAction } from "./types";

// Light-mode friendly green surface tokens (not in PALETTE which is shared/dark-only)
const G = {
  darkBg:     "#0D2D1A",
  darkBorder: "#166534",
  darkIcon:   "#16A34A22",
  lightBg:    "#ECFDF5",
  lightBorder:"#BBF7D0",
  lightIcon:  "#D1FAE5",
  text:       "#16A34A",
  textSub:    "#15803D",
} as const;

type Props = {
  action:     PrimaryAction;
  onLogWorkout: () => void;
};

type CardConfig = {
  eyebrow:   string;
  title:     string;
  subtitle:  string;
  ctaLabel:  string;
  ctaAction: () => void;
  iconName:  IconName;
  iconColor: string;
  iconBg:    string;
  cardBg:    string;
  cardBorder:string;
  ctaBg:     string;
  isHero?:   boolean;
};

export function PrimaryActionCard({ action, onLogWorkout }: Props) {
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const cfg = getConfig(action, c, isDark, onLogWorkout);

  // "done" variant: compact, no CTA button
  if (action.kind === "done") {
    const bg     = isDark ? G.darkBg     : G.lightBg;
    const border = isDark ? G.darkBorder : G.lightBorder;
    return (
      <View style={[s.compact, { backgroundColor: bg, borderColor: border }]}>
        <Icon name="checkActive" size={20} color="#22C55E" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[s.compactTitle, { color: G.text }]}>
            Workout logged · {action.streak}-day streak
          </Text>
          <Text style={[s.compactSub, { color: G.textSub }]}>
            Come back tomorrow to extend it.
          </Text>
        </View>
      </View>
    );
  }

  // Hero variant — full orange gradient (streak / log workout)
  if (cfg.isHero) {
    return (
      <LinearGradient
        colors={["#FFB347", "#FF7C1F", "#E03200"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.hero}
      >
        {/* Bottom wave decoration */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={s.waveBottom1} />
          <View style={s.waveBottom2} />
        </View>

        <Text style={s.heroTitle}>{cfg.title}</Text>
        <Text style={s.heroSub}>{cfg.subtitle}</Text>
        <TouchableOpacity
          style={s.heroBtn}
          onPress={cfg.ctaAction}
          activeOpacity={0.85}
        >
          <Text style={s.heroBtnText}>{cfg.ctaLabel}</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <View style={[s.card, { backgroundColor: cfg.cardBg, borderColor: cfg.cardBorder }]}>
      <View style={s.top}>
        <View style={[s.iconWrap, { backgroundColor: cfg.iconBg }]}>
          <Icon name={cfg.iconName} size={22} color={cfg.iconColor} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[s.eyebrow, { color: cfg.iconColor }]}>{cfg.eyebrow}</Text>
          <Text style={[s.title, { color: c.text }]}>{cfg.title}</Text>
          <Text style={[s.subtitle, { color: c.textMuted }]}>{cfg.subtitle}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[s.cta, { backgroundColor: cfg.ctaBg }]}
        onPress={cfg.ctaAction}
        activeOpacity={0.85}
      >
        <Text style={s.ctaText}>{cfg.ctaLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Config per action kind ────────────────────────────────────────────────────
function getConfig(
  action:       PrimaryAction,
  c:            ReturnType<typeof useTheme>["theme"]["colors"],
  isDark:       boolean,
  onLogWorkout: () => void,
): CardConfig {
  const greenIconBg  = isDark ? G.darkBg     : G.lightIcon;
  const greenBorder  = isDark ? G.darkBorder : G.lightBorder;
  const blueIconBg   = isDark ? "#0D1A2D"    : "#EFF6FF";
  const blueBorder   = isDark ? "#1E40AF44"  : "#BFDBFE";

  switch (action.kind) {
    case "session_today":
      return {
        eyebrow:    "SESSION TODAY",
        title:      `${action.sport} with ${action.partnerName}`,
        subtitle:   action.time ? `Scheduled for ${action.time}` : "Confirmed — open chat to coordinate.",
        ctaLabel:   "Open Chat →",
        ctaAction:  () => router.push("/(tabs)/messages"),
        iconName:   "calendar",
        iconColor:  "#22C55E",
        iconBg:     greenIconBg,
        cardBg:     c.bgCard,
        cardBorder: greenBorder,
        ctaBg:      "#16A34A",
      };
    case "session_pending":
      return {
        eyebrow:    "SESSION REQUEST",
        title:      `${action.partnerName} proposed a ${action.sport} session`,
        subtitle:   "Tap to view the details and respond.",
        ctaLabel:   "View Request →",
        ctaAction:  () => router.push("/(tabs)/matches" as any),
        iconName:   "calendar",
        iconColor:  "#3B82F6",
        iconBg:     blueIconBg,
        cardBg:     c.bgCard,
        cardBorder: blueBorder,
        ctaBg:      "#2563EB",
      };
    case "unread":
      return {
        eyebrow:    "UNREAD MESSAGES",
        title:      `${action.count} unread message${action.count > 1 ? "s" : ""}`,
        subtitle:   "Your training partners are waiting.",
        ctaLabel:   "Open Chat →",
        ctaAction:  () => router.push("/(tabs)/messages"),
        iconName:   "chatActive",
        iconColor:  "#3B82F6",
        iconBg:     blueIconBg,
        cardBg:     c.bgCard,
        cardBorder: blueBorder,
        ctaBg:      "#2563EB",
      };
    case "match_request":
      return {
        eyebrow:    "NEW REQUEST",
        title:      `${action.requesterName} wants to train with you`,
        subtitle:   "Review their profile and respond.",
        ctaLabel:   "Review →",
        ctaAction:  () => router.push("/(tabs)/matches" as any),
        iconName:   "matchActive",
        iconColor:  c.brand,
        iconBg:     c.brandSubtle,
        cardBg:     c.bgCard,
        cardBorder: c.brandBorder,
        ctaBg:      c.brand,
      };
    case "at_gym_log":
      return {
        eyebrow:    "YOU'RE AT THE GYM",
        title:      action.streak > 0 ? `${action.streak}-day streak — log this session` : "Log this gym session",
        subtitle:   "Quick check-in keeps your streak alive.",
        ctaLabel:   "Log Workout →",
        ctaAction:  onLogWorkout,
        iconName:   "gymActive",
        iconColor:  "#22C55E",
        iconBg:     greenIconBg,
        cardBg:     c.bgCard,
        cardBorder: greenBorder,
        ctaBg:      "#16A34A",
      };
    case "log_streak":
    default:
      return {
        eyebrow:    action.streak > 0 ? "DON'T BREAK IT" : "START TODAY",
        title:      action.streak > 0 ? `${action.streak}-day streak on the line` : "Start your first streak",
        subtitle:   action.streak > 0 ? "Every session strengthens the habit. Keep it going." : "Log your first workout to begin your streak.",
        ctaLabel:   "Log Workout",
        ctaAction:  onLogWorkout,
        iconName:   "streakActive",
        iconColor:  c.brand,
        iconBg:     c.brandSubtle,
        cardBg:     c.bgCard,
        cardBorder: c.brandBorder,
        ctaBg:      "#CC3700",
        isHero:     true,
      };
  }
}

const s = StyleSheet.create({
  card:       { borderRadius: RADIUS.xl, padding: SPACE[16], gap: SPACE[14], borderWidth: 1 },
  top:        { flexDirection: "row", alignItems: "flex-start", gap: SPACE[12] },
  iconWrap:   { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  eyebrow:    { ...TYPE.label },
  title:      { ...TYPE.sectionTitle, lineHeight: 26 },
  subtitle:   { ...TYPE.caption, lineHeight: 18 },
  cta:        { borderRadius: RADIUS.pill, paddingVertical: SPACE[16], alignItems: "center" },
  ctaText:    { ...TYPE.button, color: "#fff" },

  // Hero gradient variant
  hero:        { borderRadius: RADIUS.xxl, paddingTop: SPACE[32], paddingBottom: SPACE[28], paddingHorizontal: SPACE[24], gap: SPACE[12], alignItems: "center", overflow: "hidden" },
  heroTitle:   { ...TYPE.screenTitle, color: "#fff", textAlign: "center" },
  heroSub:     { ...TYPE.body, color: "rgba(255,255,255,0.88)", textAlign: "center", lineHeight: 22 },
  heroSubBold: { fontWeight: FONT.weight.bold, color: "#fff" },
  heroBtn:     { backgroundColor: "#C83000", borderRadius: RADIUS.pill, paddingVertical: SPACE[16], paddingHorizontal: SPACE[48], alignItems: "center", marginTop: SPACE[6] },
  heroBtnText: { ...TYPE.button, color: "#fff" },

  // Bottom wave decoration — large warm ellipses clipped at bottom
  waveBottom1: { position: "absolute", width: 500, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.10)", bottom: -120, left: -60 },
  waveBottom2: { position: "absolute", width: 400, height: 160, borderRadius: 80,  backgroundColor: "rgba(255,255,255,0.07)", bottom: -80,  left: 40 },

  // "done" compact variant
  compact:    { flexDirection: "row", alignItems: "center", gap: SPACE[10], borderRadius: RADIUS.lg, padding: SPACE[14], borderWidth: 1 },
  compactTitle:{ flex: 1, fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  compactSub: { fontSize: FONT.size.sm },
});
