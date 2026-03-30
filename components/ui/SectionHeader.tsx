import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme, TYPE, SPACE } from "../../lib/theme";

type SectionHeaderProps = {
  title:   string;
  count?:  number;
  action?: { label: string; onPress: () => void };
};

export function SectionHeader({ title, count, action }: SectionHeaderProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={s.row}>
      <View style={s.left}>
        <Text style={[TYPE.sectionTitle, { color: c.text }]}>{title}</Text>
        {count != null && count > 0 && (
          <View style={[s.badge, { backgroundColor: c.brandSubtle }]}>
            <Text style={[s.badgeText, { color: c.brand }]}>{count}</Text>
          </View>
        )}
      </View>
      {action && (
        <TouchableOpacity onPress={action.onPress} activeOpacity={0.7}>
          <Text style={[s.action, { color: c.brand }]}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  left:      { flexDirection: "row", alignItems: "center", gap: SPACE[8] },
  badge:     { paddingHorizontal: SPACE[8], paddingVertical: 2, borderRadius: 99 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  action:    { fontSize: 13, fontWeight: "600" as const, letterSpacing: 0.1 },
});
