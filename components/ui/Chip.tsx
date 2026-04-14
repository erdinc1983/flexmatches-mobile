/**
 * FlexMatches Chip Component
 *
 * Variants: filter | tag | selection
 *
 * Usage:
 *   <Chip label="Running" selected onPress={fn} />
 *   <Chip label="Beginner" variant="tag" />
 */

import React from "react";
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from "react-native";
import { useTheme, RADIUS, FONT, SPACE } from "../../lib/theme";

type ChipVariant = "filter" | "tag" | "selection";

type ChipProps = {
  label:     string;
  selected?: boolean;
  onPress?:  () => void;
  variant?:  ChipVariant;
  style?:    ViewStyle;
};

export function Chip({ label, selected = false, onPress, variant = "filter", style }: ChipProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const isInteractive = variant === "filter" || variant === "selection";

  const containerStyle: ViewStyle[] = [
    styles.base,
    selected
      ? { backgroundColor: c.brand, borderColor: c.brand }
      : { backgroundColor: c.bgCardAlt, borderColor: c.border },
    ...(variant === "tag" ? [{ borderRadius: RADIUS.sm }] : []),
    style ?? {},
  ];

  const labelColor = selected ? "#FFFFFF" : c.textSecondary;

  const content = (
    <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
  );

  if (isInteractive && onPress) {
    return (
      <TouchableOpacity style={containerStyle} onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return (
    // Non-interactive tag
    <TouchableOpacity style={containerStyle} activeOpacity={1}>
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: SPACE[12],
    paddingVertical:   SPACE[6],
    borderRadius:      RADIUS.pill,
    borderWidth:       1,
    alignSelf:         "flex-start",
  },
  label: {
    fontSize:   FONT.size.sm,
    fontWeight: FONT.weight.semibold,
  },
});
