import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";

type Props = {
  url?: string | null;
  name: string;
  size?: number;
  color?: string;
};

export function Avatar({ url, name, size = 48, color = "#FF4500" }: Props) {
  const initial = (name ?? "?")[0].toUpperCase();
  const radius = size / 2;

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
      />
    );
  }

  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: radius, backgroundColor: color }]}>
      <Text style={[styles.initial, { fontSize: size * 0.38 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
  initial: { fontWeight: "900", color: "#fff" },
});
