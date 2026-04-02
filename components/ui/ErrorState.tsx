/**
 * ErrorState — shared error fallback for all screens
 *
 * Usage:
 *   if (error) return <ErrorState onRetry={load} />;
 *   if (error) return <ErrorState message="Could not load messages" onRetry={load} />;
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme, FONT, SPACE, RADIUS, PALETTE } from "../../lib/theme";
import { Button } from "./Button";

type ErrorStateProps = {
  onRetry:  () => void;
  message?: string;
};

export function ErrorState({ onRetry, message }: ErrorStateProps) {
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: isDark ? PALETTE.errorSubtle : "#FDECEC" },
        ]}
      >
        <Text style={styles.icon}>⚠️</Text>
      </View>

      <Text style={[styles.title, { color: c.text }]}>Something went wrong</Text>

      <Text style={[styles.message, { color: c.textMuted }]}>
        {message ?? "We couldn't load this page. Check your connection and try again."}
      </Text>

      <Button label="Try Again" onPress={onRetry} size="md" style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: SPACE[24],
    gap:               SPACE[10],
  },
  iconWrap: {
    width:          64,
    height:         64,
    borderRadius:   32,
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   SPACE[4],
  },
  icon: {
    fontSize: 28,
  },
  title: {
    fontSize:   FONT.size.lg,
    fontWeight:  FONT.weight.bold,
    textAlign:  "center",
  },
  message: {
    fontSize:   FONT.size.base,
    textAlign:  "center",
    lineHeight: FONT.size.base * 1.5,
    paddingHorizontal: SPACE[8],
  },
  button: {
    marginTop:  SPACE[12],
    alignSelf:  "center",
  },
});
