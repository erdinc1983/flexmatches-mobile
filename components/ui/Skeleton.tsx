/**
 * Skeleton shimmer loader — iOS-modern placeholder while data loads.
 *
 * Usage:
 *   <Skeleton width={120} height={16} />              // text line
 *   <Skeleton width={48} height={48} radius={24} />   // avatar circle
 *   <Skeleton width="100%" height={180} radius={20} /> // card
 */

import { useEffect, useRef } from "react";
import { Animated, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../../lib/theme";

type Props = {
  width: number | string;
  height: number;
  radius?: number;
  style?: ViewStyle;
};

export function Skeleton({ width, height, radius = 8, style }: Props) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius: radius,
          backgroundColor: theme.colors.border,
        },
        { opacity: opacity as unknown as number },
        style,
      ]}
    />
  );
}

/**
 * Pre-built skeleton layouts for common screens.
 */

export function HomeSkeleton() {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Animated.View style={[sk.container, { backgroundColor: c.bg }]}>
      {/* Header */}
      <Animated.View style={sk.row}>
        <Skeleton width={50} height={50} radius={25} />
        <Animated.View style={{ gap: 8, flex: 1 }}>
          <Skeleton width={100} height={12} />
          <Skeleton width={160} height={18} />
        </Animated.View>
      </Animated.View>

      {/* Stat row */}
      <Skeleton width="100%" height={72} radius={20} />

      {/* Hero card */}
      <Skeleton width="100%" height={180} radius={24} />

      {/* Gym card */}
      <Skeleton width="100%" height={80} radius={20} />

      {/* Section title + cards */}
      <Skeleton width={140} height={16} />
      <Skeleton width="100%" height={100} radius={20} />

      {/* Match cards row */}
      <Skeleton width={140} height={16} />
      <Animated.View style={sk.row}>
        <Skeleton width={180} height={220} radius={22} />
        <Skeleton width={180} height={220} radius={22} />
      </Animated.View>
    </Animated.View>
  );
}

export function MessagesSkeleton() {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Animated.View style={[sk.container, { backgroundColor: c.bg }]}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Animated.View key={i} style={[sk.row, { paddingVertical: 6 }]}>
          <Skeleton width={52} height={52} radius={26} />
          <Animated.View style={{ gap: 8, flex: 1 }}>
            <Skeleton width={120} height={14} />
            <Skeleton width="80%" height={12} />
          </Animated.View>
          <Skeleton width={40} height={10} />
        </Animated.View>
      ))}
    </Animated.View>
  );
}

export function DiscoverSkeleton() {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Animated.View style={[sk.container, { backgroundColor: c.bg, alignItems: "center" }]}>
      <Skeleton width="90%" height={420} radius={24} />
      <Animated.View style={[sk.row, { justifyContent: "center", gap: 24, marginTop: 16 }]}>
        <Skeleton width={56} height={56} radius={28} />
        <Skeleton width={56} height={56} radius={28} />
        <Skeleton width={56} height={56} radius={28} />
      </Animated.View>
    </Animated.View>
  );
}

export function CirclesSkeleton() {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Animated.View style={[sk.container, { backgroundColor: c.bg }]}>
      {/* Search bar */}
      <Skeleton width="100%" height={44} radius={12} />
      {/* Filter pills */}
      <Animated.View style={[sk.row, { gap: 8 }]}>
        <Skeleton width={70} height={32} radius={16} />
        <Skeleton width={80} height={32} radius={16} />
        <Skeleton width={60} height={32} radius={16} />
        <Skeleton width={75} height={32} radius={16} />
      </Animated.View>
      {/* Circle cards */}
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} width="100%" height={130} radius={20} />
      ))}
    </Animated.View>
  );
}

export function ProfileSkeleton() {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Animated.View style={[sk.container, { backgroundColor: c.bg, alignItems: "center" }]}>
      {/* Avatar */}
      <Skeleton width={96} height={96} radius={48} />
      <Skeleton width={140} height={20} radius={6} style={{ marginTop: 12 }} />
      <Skeleton width={100} height={14} radius={6} />
      {/* Info chips */}
      <Animated.View style={[sk.row, { justifyContent: "center", gap: 8, marginTop: 8 }]}>
        <Skeleton width={80} height={32} radius={16} />
        <Skeleton width={90} height={32} radius={16} />
        <Skeleton width={70} height={32} radius={16} />
      </Animated.View>
      {/* Stats accordion */}
      <Skeleton width="100%" height={56} radius={16} style={{ marginTop: 12 }} />
      <Skeleton width="100%" height={56} radius={16} />
      <Skeleton width="100%" height={56} radius={16} />
    </Animated.View>
  );
}

const sk = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
});
