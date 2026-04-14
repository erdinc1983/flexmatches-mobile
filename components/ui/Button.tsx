/**
 * FlexMatches Button Component
 *
 * Variants: primary | secondary | ghost | danger | brand
 * Sizes:    sm | md | lg
 *
 * Usage:
 *   <Button label="Log Workout" onPress={fn} />
 *   <Button label="Cancel" variant="ghost" size="sm" onPress={fn} />
 *   <Button label="Delete" variant="danger" loading onPress={fn} />
 */

import React from "react";
import {
  TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useTheme , RADIUS, FONT, SPACE } from "../../lib/theme";


type Variant = "primary" | "secondary" | "ghost" | "danger" | "brand";
type Size    = "sm" | "md" | "lg";

type ButtonProps = {
  label:     string;
  onPress:   () => void;
  variant?:  Variant;
  size?:     Size;
  loading?:  boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?:    ViewStyle;
  textStyle?: TextStyle;
};

export function Button({
  label,
  onPress,
  variant   = "primary",
  size      = "md",
  loading   = false,
  disabled  = false,
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const containerStyle: ViewStyle[] = [
    styles.base,
    sizeStyles[size],
    getVariantStyle(variant, c),
    ...(fullWidth ? [{ alignSelf: "stretch" as const }] : []),
    ...(disabled || loading ? [{ opacity: 0.5 }] : []),
    style ?? {},
  ];

  const labelStyle: TextStyle[] = [
    styles.label,
    sizeLabelStyles[size],
    getVariantLabelStyle(variant, c),
    textStyle ?? {},
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator size="small" color={getLabelColor(variant, c)} />
        : <Text style={labelStyle}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getVariantStyle(variant: Variant, c: ReturnType<typeof useTheme>["theme"]["colors"]): ViewStyle {
  switch (variant) {
    case "primary":   return { backgroundColor: c.brand };
    case "secondary": return { backgroundColor: c.bgCardAlt, borderWidth: 1, borderColor: c.border };
    case "ghost":     return { backgroundColor: "transparent" };
    case "danger":    return { backgroundColor: "#EF4444" };
    case "brand":     return { backgroundColor: c.brand };
    default:          return { backgroundColor: c.brand };
  }
}

function getVariantLabelStyle(variant: Variant, c: ReturnType<typeof useTheme>["theme"]["colors"]): TextStyle {
  switch (variant) {
    case "primary":   return { color: "#FFFFFF" };
    case "secondary": return { color: c.text };
    case "ghost":     return { color: c.brand };
    case "danger":    return { color: "#FFFFFF" };
    case "brand":     return { color: "#FFFFFF" };
    default:          return { color: "#FFFFFF" };
  }
}

function getLabelColor(variant: Variant, c: ReturnType<typeof useTheme>["theme"]["colors"]): string {
  if (variant === "secondary") return c.text;
  if (variant === "ghost")     return c.brand;
  return "#FFFFFF";
}

// ─── Static styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  label: {
    fontWeight: FONT.weight.bold,
  },
});

const sizeStyles: Record<Size, ViewStyle> = {
  sm: { paddingHorizontal: SPACE[14], paddingVertical: SPACE[8],  borderRadius: RADIUS.md },
  md: { paddingHorizontal: SPACE[20], paddingVertical: SPACE[14], borderRadius: RADIUS.lg },
  lg: { paddingHorizontal: SPACE[24], paddingVertical: SPACE[16], borderRadius: RADIUS.xl },
};

const sizeLabelStyles: Record<Size, TextStyle> = {
  sm: { fontSize: FONT.size.sm },
  md: { fontSize: FONT.size.base },
  lg: { fontSize: FONT.size.lg },
};
