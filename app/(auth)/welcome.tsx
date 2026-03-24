import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

const FEATURES = [
  { emoji: "🔍", text: "Swipe to find gym partners" },
  { emoji: "💬", text: "Chat & plan sessions" },
  { emoji: "🏆", text: "Track goals & streaks" },
];

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      <View style={styles.hero}>
        {/* Glow */}
        <View style={styles.glow} />

        <View style={styles.logoWrap}>
          <Text style={styles.logoEmoji}>💪</Text>
        </View>

        <Text style={styles.title}>FlexMatches</Text>
        <Text style={styles.subtitle}>
          Find your fitness partner,{"\n"}reach your goals together
        </Text>

        {/* Feature pills */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.text} style={styles.featurePill}>
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push("/(auth)/register")}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Get Started — Free</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push("/(auth)/login")}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryButtonText}>I already have an account</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          By continuing you agree to our Terms & Privacy Policy
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  hero: { flex: 1, justifyContent: "center", alignItems: "center", gap: 0 },
  glow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#FF4500",
    opacity: 0.08,
    top: "15%",
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: "#FF4500",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: "#FF4500",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  logoEmoji: { fontSize: 48 },
  title: {
    fontSize: 44,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -1.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
    color: "#666",
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 40,
  },
  features: { gap: 10, width: "100%" },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#141414",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#222",
  },
  featureEmoji: { fontSize: 20 },
  featureText: { fontSize: 14, color: "#999", fontWeight: "600" },
  buttons: { gap: 12 },
  primaryButton: {
    backgroundColor: "#FF4500",
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#FF4500",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  primaryButtonText: { color: "#FFF", fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  secondaryButton: {
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#222",
    backgroundColor: "#111",
  },
  secondaryButtonText: { color: "#888", fontSize: 15, fontWeight: "600" },
  legal: { textAlign: "center", fontSize: 11, color: "#333", marginTop: 4 },
});
