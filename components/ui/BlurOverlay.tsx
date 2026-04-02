/**
 * BlurOverlay — iOS-style frosted glass backdrop for modals.
 *
 * Wraps children in a full-screen BlurView with a semi-transparent tint.
 * Falls back to a plain dark overlay on Android (where blur is unsupported).
 *
 * Usage inside a <Modal transparent>:
 *   <BlurOverlay onPress={onClose}>
 *     <View style={sheetStyle}>…</View>
 *   </BlurOverlay>
 */

import { Platform, Pressable, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  intensity?: number;
};

export function BlurOverlay({ children, onPress, intensity = 30 }: Props) {
  if (Platform.OS === "ios") {
    return (
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress}>
        <BlurView intensity={intensity} tint="dark" style={s.fill}>
          <Pressable onPress={(e) => e.stopPropagation()} style={s.fill}>
            {children}
          </Pressable>
        </BlurView>
      </Pressable>
    );
  }

  // Android fallback — plain dark overlay
  return (
    <Pressable style={[s.fill, s.androidBg]} onPress={onPress}>
      <Pressable onPress={(e) => e.stopPropagation()} style={s.fill}>
        {children}
      </Pressable>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  androidBg: { backgroundColor: "rgba(0,0,0,0.6)" },
});
