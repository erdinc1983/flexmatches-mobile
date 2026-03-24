/**
 * FlexMatches EmptyState Component
 *
 * Usage:
 *   <EmptyState
 *     icon="discover"
 *     title="No matches yet"
 *     subtitle="Start discovering gym partners nearby"
 *     action={{ label: "Discover", onPress: fn }}
 *   />
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme, FONT, SPACE } from "../../lib/theme";
import { Icon, IconName } from "../Icon";
import { Button } from "./Button";

type EmptyStateProps = {
  icon?:     IconName;
  title:     string;
  subtitle?: string;
  action?:   { label: string; onPress: () => void };
};

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.container}>
      {icon && (
        <View style={[styles.iconWrap, { backgroundColor: c.brandSubtle }]}>
          <Icon name={icon} size={32} color={c.brand} />
        </View>
      )}
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: c.textMuted }]}>{subtitle}</Text>
      )}
      {action && (
        <Button label={action.label} onPress={action.onPress} style={{ marginTop: SPACE[8] }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems:    "center",
    paddingVertical: SPACE[48],
    paddingHorizontal: SPACE[24],
    gap: SPACE[8],
  },
  iconWrap: {
    width:         72,
    height:        72,
    borderRadius:  36,
    alignItems:    "center",
    justifyContent:"center",
    marginBottom:  SPACE[4],
  },
  title: {
    fontSize:    FONT.size.lg,
    fontWeight:  FONT.weight.bold,
    textAlign:   "center",
  },
  subtitle: {
    fontSize:  FONT.size.base,
    textAlign: "center",
    lineHeight: FONT.size.base * 1.5,
  },
});
