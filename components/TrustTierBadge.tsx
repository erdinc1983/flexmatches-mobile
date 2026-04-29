/**
 * TrustTierBadge — small pill that signals accumulated reliability.
 *
 * Positive-only: even "New" is rendered as a quiet gray pill rather than
 * being absent, so users learn that the system exists and that they'll
 * earn higher tiers as they complete sessions.
 *
 * Two sizes:
 *   sm — tight, fits in card overlays / chat headers / lists
 *   md — slightly larger for profile-sheet-style display
 */

import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { TRUST_TIER_META, asTrustTier, type TrustTier } from "../lib/trustTier";
import { FONT } from "../lib/theme";

type Props = {
  /** Either a TrustTier literal or any string from the server (asTrustTier
   * coerces unknown values to "new"). */
  tier:    TrustTier | string | null | undefined;
  size?:   "sm" | "md";
  /** Hide the "New" tier entirely. Useful in cards where you don't want
   * to clutter every brand-new user with a gray pill. */
  hideNew?: boolean;
  style?:   ViewStyle;
};

export function TrustTierBadge({ tier, size = "sm", hideNew = false, style }: Props) {
  const t = asTrustTier(tier);
  if (hideNew && t === "new") return null;
  const meta = TRUST_TIER_META[t];
  const isVouched = t === "vouched";

  return (
    <View
      accessibilityLabel={meta.description}
      style={[
        s.pill,
        size === "md" ? s.pillMd : s.pillSm,
        { backgroundColor: meta.bg, borderColor: meta.border },
        style,
      ]}
    >
      {isVouched && (
        <Text style={[s.glyph, size === "md" ? s.glyphMd : s.glyphSm, { color: meta.color }]}>★</Text>
      )}
      <Text
        style={[
          size === "md" ? s.labelMd : s.labelSm,
          { color: meta.color },
        ]}
      >
        {meta.label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection:   "row",
    alignItems:      "center",
    borderWidth:     1,
    alignSelf:       "flex-start",
  },
  pillSm: {
    paddingHorizontal: 6,
    paddingVertical:   1,
    borderRadius:      6,
    gap:               3,
  },
  pillMd: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      8,
    gap:               4,
  },
  labelSm: {
    fontSize:       10,
    fontWeight:     FONT.weight.bold,
    letterSpacing:  0.4,
    textTransform:  "uppercase",
  },
  labelMd: {
    fontSize:       11,
    fontWeight:     FONT.weight.bold,
    letterSpacing:  0.4,
    textTransform:  "uppercase",
  },
  glyph: { fontWeight: FONT.weight.bold },
  glyphSm: { fontSize: 10 },
  glyphMd: { fontSize: 12 },
});
