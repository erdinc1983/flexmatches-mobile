import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Linking } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

const TERMS_URL   = "https://www.flexmatches.com/terms";
const PRIVACY_URL = "https://www.flexmatches.com/privacy-policy";

const FEATURES = [
  { emoji: "🔍", text: "Swipe to find gym partners" },
  { emoji: "💬", text: "Chat & plan sessions" },
  { emoji: "🏆", text: "Track goals & streaks" },
];

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.hero}>
        {/* Soft orange glow */}
        <View style={styles.glow} />

        <Image
          source={require("../../assets/images/icon.png")}
          style={styles.logoImg}
          contentFit="contain"
        />

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
          By continuing you agree to our{" "}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(TERMS_URL)}>Terms</Text>
          {" & "}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  hero: { flex: 1, justifyContent: "center", alignItems: "center", gap: 0 },
  glow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#FF6B00",
    opacity: 0.07,
    top: "10%",
  },
  logoImg: {
    width: 104,
    height: 104,
    borderRadius: 26,
    marginBottom: 24,
    shadowColor: "#FF6B00",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
  },
  title: {
    fontSize: 44,
    fontWeight: "900",
    color: "#111111",
    letterSpacing: -1.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
    color: "#888",
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 40,
  },
  features: { gap: 10, width: "100%" },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F7F7F7",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
  featureEmoji: { fontSize: 20 },
  featureText: { fontSize: 14, color: "#555", fontWeight: "600" },
  buttons: { gap: 12 },
  primaryButton: {
    backgroundColor: "#FF6B00",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#FF6B00",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  primaryButtonText: { color: "#FFF", fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#EFEFEF",
    backgroundColor: "#FAFAFA",
  },
  secondaryButtonText: { color: "#555", fontSize: 15, fontWeight: "600" },
  legal:     { textAlign: "center", fontSize: 11, color: "#CCC", marginTop: 4 },
  legalLink: { color: "#FF6B00", textDecorationLine: "underline" },
});
