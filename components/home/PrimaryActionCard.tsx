/**
 * PrimaryActionCard
 *
 * Full-width photo hero card — every variant uses a sport/gym Unsplash photo
 * with a gradient overlay so there's always a rich visual at the top of Home.
 *
 * Variants:
 *   session_today   → sport photo + dark gradient
 *   session_pending → sport photo + blue gradient
 *   match_request   → people-training photo + brand gradient
 *   unread          → gym photo + blue gradient
 *   at_gym_log      → gym photo + green gradient
 *   log_streak      → gym/workout photo + orange gradient
 *   done            → local gym-done.jpeg (unchanged)
 */

import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ImageBackground, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useTheme, SPACE, FONT, RADIUS, TYPE } from "../../lib/theme";
import { Icon, IconName } from "../Icon";
import { getSportPhoto, SPORT_PHOTOS } from "../../lib/sportPhotos";
import type { PrimaryAction } from "./types";

// ─── Local asset ──────────────────────────────────────────────────────────────
const GYM_DONE_PHOTO = require("../../assets/images/gym-done.jpeg");

// ─── Types ────────────────────────────────────────────────────────────────────
type Props = {
  action:       PrimaryAction;
  onLogWorkout: () => void;
  checkingIn?:  boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────
export function PrimaryActionCard({ action, onLogWorkout, checkingIn }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const isLogAction = action.kind === "log_streak" || action.kind === "at_gym_log";

  // ── "done" — local photo, unchanged ─────────────────────────────────────────
  if (action.kind === "done") {
    return (
      <ImageBackground
        source={GYM_DONE_PHOTO}
        style={s.card}
        imageStyle={{ borderRadius: RADIUS.xxl }}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["rgba(0,0,0,0.0)", "rgba(0,0,0,0.68)"]}
          style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.xxl }]}
        />
        <View style={s.content}>
          <View style={s.pill}>
            <Icon name="checkActive" size={12} color="#22C55E" />
            <Text style={[s.pillText, { color: "#22C55E" }]}>Workout Logged</Text>
          </View>
          <Text style={s.title}>
            {action.streak > 0 ? `${action.streak}-day streak` : "First workout done"}
          </Text>
          <Text style={s.sub}>Come back tomorrow to keep it going.</Text>
        </View>
      </ImageBackground>
    );
  }

  // ── All other variants — Unsplash photo + gradient ───────────────────────────
  const cfg = getPhotoConfig(action, onLogWorkout);

  return (
    <ImageBackground
      source={{ uri: cfg.photoUrl }}
      style={s.card}
      imageStyle={{ borderRadius: RADIUS.xxl }}
      resizeMode="cover"
    >
      {/* Gradient overlay */}
      <LinearGradient
        colors={cfg.gradient as [string, string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.xxl }]}
      />

      {/* Content */}
      <View style={s.content}>
        {/* Eyebrow pill */}
        <View style={[s.pill, { backgroundColor: cfg.pillBg }]}>
          <Icon name={cfg.iconName} size={12} color="#fff" />
          <Text style={s.pillText}>{cfg.eyebrow}</Text>
        </View>

        <Text style={s.title}>{cfg.title}</Text>
        <Text style={s.sub}>{cfg.subtitle}</Text>

        {/* CTA */}
        <TouchableOpacity
          style={[s.cta, { backgroundColor: cfg.ctaBg },
            isLogAction && checkingIn && { opacity: 0.6 }]}
          onPress={cfg.ctaAction}
          disabled={isLogAction && checkingIn}
          activeOpacity={0.85}
        >
          {isLogAction && checkingIn
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.ctaText}>{cfg.ctaLabel}</Text>
          }
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

// ─── Photo config per variant ─────────────────────────────────────────────────
type PhotoConfig = {
  photoUrl:  string;
  gradient:  string[];
  pillBg:    string;
  eyebrow:   string;
  title:     string;
  subtitle:  string;
  ctaLabel:  string;
  ctaAction: () => void;
  ctaBg:     string;
  iconName:  IconName;
};

function getPhotoConfig(action: PrimaryAction, onLogWorkout: () => void): PhotoConfig {
  switch (action.kind) {
    case "session_today":
      return {
        photoUrl:  getSportPhoto(action.sport),
        gradient:  ["rgba(0,0,0,0.05)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.82)"],
        pillBg:    "rgba(34,197,94,0.85)",
        eyebrow:   "SESSION TODAY",
        title:     `${action.sport} with ${action.partnerName}`,
        subtitle:  action.time ? `Confirmed · ${action.time}` : "Confirmed — tap to open chat",
        ctaLabel:  "Open Chat",
        ctaAction: () => router.push("/(tabs)/messages"),
        ctaBg:     "#16A34A",
        iconName:  "calendar",
      };

    case "session_pending":
      return {
        photoUrl:  getSportPhoto(action.sport),
        gradient:  ["rgba(0,0,0,0.05)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.82)"],
        pillBg:    "rgba(59,130,246,0.85)",
        eyebrow:   "SESSION REQUEST",
        title:     `${action.partnerName} wants to train`,
        subtitle:  `Proposed a ${action.sport} session — respond now`,
        ctaLabel:  "View Request",
        ctaAction: () => router.push("/(tabs)/matches" as any),
        ctaBg:     "#2563EB",
        iconName:  "calendar",
      };

    case "match_request":
      return {
        photoUrl:  SPORT_PHOTOS.default,
        gradient:  ["rgba(255,69,0,0.15)", "rgba(200,51,0,0.55)", "rgba(160,30,0,0.90)"],
        pillBg:    "rgba(255,69,0,0.85)",
        eyebrow:   "TRAINING REQUEST",
        title:     `${action.requesterName} wants to train with you`,
        subtitle:  "Review their profile and accept to start chatting",
        ctaLabel:  "Review Profile",
        ctaAction: () => router.push("/(tabs)/matches" as any),
        ctaBg:     "#FF4500",
        iconName:  "matchActive",
      };

    case "unread":
      return {
        photoUrl:  SPORT_PHOTOS.gym,
        gradient:  ["rgba(0,0,0,0.05)", "rgba(0,0,0,0.35)", "rgba(15,40,80,0.88)"],
        pillBg:    "rgba(59,130,246,0.85)",
        eyebrow:   "UNREAD MESSAGES",
        title:     `${action.count} message${action.count > 1 ? "s" : ""} waiting`,
        subtitle:  "Your training partners are waiting for you",
        ctaLabel:  "Open Chat",
        ctaAction: () => router.push("/(tabs)/messages"),
        ctaBg:     "#2563EB",
        iconName:  "chatActive",
      };

    case "at_gym_log":
      return {
        photoUrl:  SPORT_PHOTOS.gym,
        gradient:  ["rgba(0,0,0,0.05)", "rgba(0,0,0,0.30)", "rgba(5,30,15,0.88)"],
        pillBg:    "rgba(34,197,94,0.85)",
        eyebrow:   "YOU'RE AT THE GYM",
        title:     action.streak > 0
          ? `${action.streak}-day streak — log this session`
          : "Log this gym session",
        subtitle:  "Quick tap keeps your streak alive",
        ctaLabel:  "Log Workout",
        ctaAction: onLogWorkout,
        ctaBg:     "#16A34A",
        iconName:  "gymActive",
      };

    case "log_streak":
    default:
      return {
        photoUrl:  SPORT_PHOTOS.default,
        gradient:  ["rgba(255,100,0,0.20)", "rgba(220,60,0,0.55)", "rgba(180,30,0,0.92)"],
        pillBg:    "rgba(255,69,0,0.85)",
        eyebrow:   (action as any).streak > 0 ? "KEEP YOUR STREAK" : "START TODAY",
        title:     (action as any).streak > 0
          ? `Day ${(action as any).streak} — don't stop now`
          : "Log your first workout",
        subtitle:  (action as any).streak > 0
          ? "Every session builds the habit. You've got this."
          : "Start your streak today — even 20 minutes counts.",
        ctaLabel:  "Log Workout",
        ctaAction: onLogWorkout,
        ctaBg:     "#CC3700",
        iconName:  "streakActive",
      };
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  card: {
    height:        220,
    borderRadius:  RADIUS.xxl,
    overflow:      "hidden",
    justifyContent:"flex-end",
  },
  content: {
    padding:     SPACE[20],
    paddingTop:  SPACE[16],
    gap:         SPACE[8],
  },
  pill: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            SPACE[4],
    alignSelf:      "flex-start",
    paddingHorizontal: SPACE[10],
    paddingVertical:   4,
    borderRadius:   RADIUS.pill,
    marginBottom:   SPACE[2],
  },
  pillText: {
    fontSize:   11,
    fontWeight: FONT.weight.extrabold,
    color:      "#fff",
    letterSpacing: 0.5,
  },
  title: {
    fontSize:      FONT.size.xl,
    fontWeight:    FONT.weight.black,
    color:         "#fff",
    letterSpacing: -0.4,
    lineHeight:    28,
  },
  sub: {
    fontSize:   FONT.size.sm,
    color:      "rgba(255,255,255,0.80)",
    lineHeight: 20,
  },
  cta: {
    borderRadius:    RADIUS.pill,
    paddingVertical: SPACE[14],
    alignItems:      "center",
    marginTop:       SPACE[4],
  },
  ctaText: {
    ...TYPE.button,
    color: "#fff",
  },
});
