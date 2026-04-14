/**
 * AppModal — standard centered modal for FlexMatches.
 *
 * - Blurred backdrop (iOS native blur, dark overlay on Android)
 * - Centered card with rounded corners
 * - Title + X close button header
 * - Tap outside to close
 *
 * Usage:
 *   <AppModal visible={open} onClose={() => setOpen(false)} title="My Title">
 *     <Text>Content here</Text>
 *   </AppModal>
 */

import React from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
 Pressable } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme, SPACE, FONT, RADIUS } from "../../lib/theme";

type Props = {
  visible:    boolean;
  onClose:    () => void;
  title:      string;
  children:   React.ReactNode;
  danger?:    boolean;
};

export function AppModal({ visible, onClose, title, children, danger }: Props) {
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Blurred backdrop — tap outside closes */}
        <Pressable style={s.backdrop} onPress={onClose}>
          <BlurView
            intensity={isDark ? 40 : 50}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        </Pressable>

        {/* Centered card — taps inside don't close */}
        <Pressable style={s.centerer} onPress={onClose}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }]}
          >
            {/* Header */}
            <View style={s.header}>
              <Text style={[s.title, { color: danger ? "#FF4500" : c.text }]} numberOfLines={1}>
                {title}
              </Text>
              <TouchableOpacity
                style={[s.closeBtn, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[s.closeX, { color: c.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={[s.divider, { backgroundColor: c.border }]} />

            {/* Content */}
            <View style={s.body}>
              {children}
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  centerer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACE[24],
  },
  card: {
    width: "100%",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE[20],
    paddingTop: SPACE[20],
    paddingBottom: SPACE[14],
  },
  title: {
    fontSize: FONT.size.lg,
    fontWeight: FONT.weight.black,
    flex: 1,
    paddingRight: SPACE[12],
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  closeX: {
    fontSize: 13,
    fontWeight: FONT.weight.bold,
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: SPACE[20],
  },
  body: {
    padding: SPACE[20],
    gap: SPACE[14],
  },
});
