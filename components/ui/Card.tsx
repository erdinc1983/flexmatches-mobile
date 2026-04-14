/**
 * FlexMatches Card Component
 *
 * Base card container used throughout the app.
 * Variants: default | elevated | outlined | accent
 *
 * Usage:
 *   <Card>...</Card>
 *   <Card variant="elevated" onPress={fn}>...</Card>
 *   <Card variant="accent">...</Card>  ← brand-bordered
 */

import React, { ReactNode } from "react";
import { TouchableOpacity, View, StyleSheet, ViewStyle } from "react-native";
import { useTheme, RADIUS, SHADOW } from "../../lib/theme";

type CardVariant = "default" | "elevated" | "outlined" | "accent";

type CardProps = {
  children:  ReactNode;
  variant?:  CardVariant;
  onPress?:  () => void;
  style?:    ViewStyle;
  padding?:  number;
};

export function Card({ children, variant = "default", onPress, style, padding = 16 }: CardProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const containerStyle: ViewStyle[] = [
    styles.base,
    { backgroundColor: c.bgCard, padding },
    ...(variant === "elevated" ? [{ ...SHADOW.md, backgroundColor: c.bgCard }] : []),
    ...(variant === "outlined" ? [{ borderWidth: 1, borderColor: c.border }] : []),
    ...(variant === "accent"   ? [{ borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.bgCard }] : []),
    style ?? {},
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={containerStyle} onPress={onPress} activeOpacity={0.75}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
  },
});
