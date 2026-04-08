/**
 * Pro Info Screen — Coming Soon
 *
 * Displays Pro features for informational purposes only.
 * In-app purchases are not yet available; removed to comply with
 * App Store Review Guideline 3.1.2 (subscriptions must use StoreKit).
 *
 * When IAP is ready: integrate react-native-purchases (RevenueCat),
 * add product IDs in App Store Connect, then restore the purchase UI.
 */

import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../lib/theme";
import { Icon } from "../components/Icon";

const PRO_FEATURES = [
  { icon: "❤️",  label: "Unlimited likes per day"              },
  { icon: "👀",  label: "See who liked you first"              },
  { icon: "🔍",  label: "Advanced filters — tier, time, sport" },
  { icon: "💎",  label: "Pro badge on your profile"            },
  { icon: "🚀",  label: "Priority in discovery feed"           },
  { icon: "💪",  label: "Unlimited activity logging"           },
  { icon: "🥇",  label: "Gold & Diamond tiers unlocked"        },
  { icon: "📊",  label: "Workout invite analytics"             },
  { icon: "⚡",  label: "Profile boost — 3×/month"             },
  { icon: "🎯",  label: "Early access to new features"         },
];

export default function ProScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.bg }]}>
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={16}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E0E0E0", alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="back" size={20} color="#000000" />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.text }]}>FlexMatches Pro</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={[s.hero, { backgroundColor: "#1a0800", borderColor: "#FF450033" }]}>
          <Text style={{ fontSize: 52 }}>💎</Text>
          <Text style={[s.heroTitle, { color: "#FFFFFF" }]}>
            FlexMatches <Text style={{ color: "#FF4500" }}>Pro</Text>
          </Text>
          <Text style={[s.heroSub, { color: "#AAAAAA" }]}>
            Find better matches, grow faster, stand out in the community.
          </Text>
        </View>

        {/* Coming Soon banner */}
        <View style={[s.comingSoonCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Text style={[s.comingSoonTitle, { color: c.text }]}>Coming Soon</Text>
          <Text style={[s.comingSoonBody, { color: c.textMuted }]}>
            Pro subscriptions are launching soon. All features are currently available
            free of charge while we finalize our premium offering.
          </Text>
        </View>

        {/* Pro features */}
        <Text style={[s.sectionLabel, { color: c.textFaint }]}>EVERYTHING IN PRO</Text>
        <View style={s.featureList}>
          {PRO_FEATURES.map((f) => (
            <View key={f.label} style={[s.featureRow, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              <Text style={s.featureIcon}>{f.icon}</Text>
              <Text style={[s.featureLabel, { color: c.textSecondary }]}>{f.label}</Text>
              <Text style={{ color: PALETTE.success, fontSize: 14, fontWeight: "800" }}>✓</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1 },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACE[20], paddingVertical: SPACE[14], borderBottomWidth: 1 },
  headerTitle:     { fontSize: FONT.size.xl, fontWeight: FONT.weight.black },
  scroll:          { padding: SPACE[16], gap: SPACE[16], paddingBottom: 80 },

  hero:            { borderRadius: RADIUS.xl, padding: SPACE[28], borderWidth: 1, alignItems: "center", gap: SPACE[10] },
  heroTitle:       { fontSize: 28, fontWeight: FONT.weight.black, textAlign: "center", letterSpacing: -0.5 },
  heroSub:         { fontSize: FONT.size.sm, lineHeight: 21, textAlign: "center" },

  comingSoonCard:  { borderRadius: RADIUS.xl, padding: SPACE[20], borderWidth: 1, alignItems: "center", gap: SPACE[8] },
  comingSoonTitle: { fontSize: FONT.size.xl, fontWeight: FONT.weight.black },
  comingSoonBody:  { fontSize: FONT.size.sm, textAlign: "center", lineHeight: 20 },

  sectionLabel:    { fontSize: 11, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 0.8 },
  featureList:     { gap: SPACE[8] },
  featureRow:      { flexDirection: "row", alignItems: "center", gap: SPACE[12], borderRadius: RADIUS.lg, padding: SPACE[14], borderWidth: 1 },
  featureIcon:     { fontSize: 20, width: 28, textAlign: "center" },
  featureLabel:    { flex: 1, fontSize: FONT.size.sm },
});
