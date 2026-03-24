/**
 * FlexMatches SectionHeader Component
 *
 * Usage:
 *   <SectionHeader title="Requests" count={3} />
 *   <SectionHeader title="Your Matches" action={{ label: "See all", onPress: fn }} />
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme, FONT, SPACE } from "../../lib/theme";

type SectionHeaderProps = {
  title:   string;
  count?:  number;
  action?: { label: string; onPress: () => void };
};

export function SectionHeader({ title, count, action }: SectionHeaderProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        {count != null && count > 0 && (
          <Text style={[styles.count, { color: c.brand }]}>{count}</Text>
        )}
      </View>
      {action && (
        <TouchableOpacity onPress={action.onPress} activeOpacity={0.7}>
          <Text style={[styles.action, { color: c.brand }]}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
  },
  left: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           SPACE[6],
  },
  title: {
    fontSize:   FONT.size.lg,
    fontWeight: FONT.weight.extrabold,
    letterSpacing: -0.2,
  },
  count: {
    fontSize:   FONT.size.lg,
    fontWeight: FONT.weight.extrabold,
  },
  action: {
    fontSize:   FONT.size.sm,
    fontWeight: FONT.weight.semibold,
  },
});
