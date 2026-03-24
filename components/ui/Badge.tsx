/**
 * FlexMatches Badge Component
 *
 * CountBadge  — notification dot with number (e.g. "3", "9+")
 * StatusBadge — text label with semantic color (online, new, pro, etc.)
 *
 * Usage:
 *   <CountBadge count={5} />
 *   <StatusBadge label="Online" status="success" />
 *   <StatusBadge label="PRO" status="brand" />
 */

import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { useTheme, FONT, RADIUS } from "../../lib/theme";

// ─── CountBadge ───────────────────────────────────────────────────────────────
type CountBadgeProps = {
  count: number;
  max?:  number;
  style?: ViewStyle;
};

export function CountBadge({ count, max = 9, style }: CountBadgeProps) {
  if (count <= 0) return null;
  const label = count > max ? `${max}+` : String(count);

  return (
    <View style={[styles.countBadge, style]}>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
type BadgeStatus = "success" | "warning" | "error" | "info" | "brand" | "muted";

type StatusBadgeProps = {
  label:  string;
  status?: BadgeStatus;
  style?:  ViewStyle;
};

export function StatusBadge({ label, status = "muted", style }: StatusBadgeProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const bg: Record<BadgeStatus, string> = {
    success: theme.palette.successSubtle,
    warning: theme.palette.warningSubtle,
    error:   theme.palette.errorSubtle,
    info:    theme.palette.infoSubtle,
    brand:   c.brandSubtle,
    muted:   c.bgCardAlt,
  };

  const fg: Record<BadgeStatus, string> = {
    success: theme.palette.success,
    warning: theme.palette.warning,
    error:   theme.palette.error,
    info:    theme.palette.info,
    brand:   c.brand,
    muted:   c.textMuted,
  };

  return (
    <View style={[styles.statusBadge, { backgroundColor: bg[status] }, style]}>
      <Text style={[styles.statusLabel, { color: fg[status] }]}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  countBadge: {
    backgroundColor: "#FF4500",
    borderRadius: RADIUS.pill,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  countLabel: {
    fontSize: FONT.size.xs,
    fontWeight: FONT.weight.black,
    color: "#FFFFFF",
  },
  statusBadge: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  statusLabel: {
    fontSize: FONT.size.xs,
    fontWeight: FONT.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
