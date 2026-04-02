/**
 * Pro / Paywall Screen
 *
 * Shows Pro features, pricing, and routes to web checkout via in-app browser.
 * On return, refreshes is_pro status from Supabase.
 *
 * Note: App Store submissions require Apple IAP for subscription purchases.
 * This screen uses web checkout (WebBrowser) for MVP / TestFlight builds.
 * Before public App Store release, migrate to react-native-purchases (RevenueCat).
 */

import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../lib/supabase";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../lib/theme";
import { Icon } from "../components/Icon";
import {
  initIAP, closeIAP, purchaseIAP, verifyAndActivatePro,
  purchaseUpdatedListener, purchaseErrorListener, finishTransaction,
  IAP_SKUS,
  type SubscriptionPurchase, type PurchaseError,
} from "../lib/iap";

// ─── Constants ────────────────────────────────────────────────────────────────

const WEB_PRO_URL = "https://flexmatches.com/app/pro";

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

const FREE_LIMITS = [
  "Up to 10 likes/day",
  "Basic discover filters",
  "1:1 chat with matches",
  "Activity log (10/month)",
  "Bronze & Silver tiers only",
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ProScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [isPro,       setIsPro]       = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [billing,     setBilling]     = useState<"monthly" | "yearly">("yearly");

  const monthlyPrice = billing === "yearly" ? "4.99" : "7.99";
  const yearlyTotal  = (4.99 * 12).toFixed(2);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("users").select("is_pro").eq("id", user.id).single();
    setIsPro(data?.is_pro ?? false);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── iOS IAP setup ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    initIAP();

    const purchaseSub = purchaseUpdatedListener(async (purchase: SubscriptionPurchase) => {
      const receipt = purchase.transactionReceipt;
      if (!receipt) return;
      const ok = await verifyAndActivatePro(receipt, purchase.productId);
      if (ok) {
        await finishTransaction({ purchase, isConsumable: false });
        setIsPro(true);
        setSubscribing(false);
      } else {
        Alert.alert("Purchase Failed", "Could not verify your purchase. Please contact support.");
        setSubscribing(false);
      }
    });

    const errorSub = purchaseErrorListener((error: PurchaseError) => {
      if (error.code !== "E_USER_CANCELLED") {
        Alert.alert("Purchase Error", error.message ?? "Something went wrong.");
      }
      setSubscribing(false);
    });

    return () => {
      purchaseSub.remove();
      errorSub.remove();
      closeIAP();
    };
  }, []);

  // ── Subscribe ─────────────────────────────────────────────────────────────

  async function openCheckout() {
    // iOS: Apple IAP (App Store required) — AC1
    if (Platform.OS === "ios") {
      setSubscribing(true);
      const sku = billing === "yearly" ? IAP_SKUS.yearly : IAP_SKUS.monthly;
      try {
        await purchaseIAP(sku);
        // Result handled in purchaseUpdatedListener above
      } catch {
        setSubscribing(false);
      }
      return;
    }
    // Android (and web): Stripe web checkout — AC3
    setSubscribing(true);
    const url = `${WEB_PRO_URL}?billing=${billing}&from=mobile`;
    await WebBrowser.openBrowserAsync(url, {
      toolbarColor: "#0A0A0A",
      controlsColor: "#FF4500",
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
    await load();
    setSubscribing(false);
  }

  async function openBillingPortal() {
    setSubscribing(true);
    if (Platform.OS === "ios") {
      // Deep-link to iOS subscription management
      await WebBrowser.openBrowserAsync("https://apps.apple.com/account/subscriptions", {
        toolbarColor: "#0A0A0A",
        controlsColor: "#FF4500",
      });
    } else {
      await WebBrowser.openBrowserAsync(`${WEB_PRO_URL}?portal=1`, {
        toolbarColor: "#0A0A0A",
        controlsColor: "#FF4500",
      });
    }
    await load();
    setSubscribing(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: c.bg }]}>
        <ActivityIndicator color="#FF4500" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  // ── Already Pro ───────────────────────────────────────────────────────────
  if (isPro) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: c.bg }]}>
        <View style={[s.header, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Icon name="chevronLeft" size={24} color={c.textMuted} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: c.text }]}>FlexMatches Pro</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={[s.scroll, { alignItems: "center" }]} showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 64, marginTop: SPACE[20] }}>💎</Text>
          <Text style={[s.proTitle, { color: c.text }]}>You're Pro!</Text>
          <Text style={[s.proSub, { color: c.textMuted }]}>
            All premium features unlocked. Thank you for supporting FlexMatches.
          </Text>

          <View style={s.featureList}>
            {PRO_FEATURES.map((f) => (
              <View key={f.label} style={[s.featureRow, { backgroundColor: c.bgCard, borderColor: "#FF450022" }]}>
                <Text style={s.featureIcon}>{f.icon}</Text>
                <Text style={[s.featureLabel, { color: c.textSecondary }]}>{f.label}</Text>
                <Text style={{ color: PALETTE.success, fontSize: 16 }}>✓</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[s.manageBtn, { borderColor: c.border }]}
            onPress={openBillingPortal}
            disabled={subscribing}
            activeOpacity={0.8}
          >
            {subscribing
              ? <ActivityIndicator color={c.textMuted} size="small" />
              : <Text style={[s.manageBtnText, { color: c.textMuted }]}>⚙️  Manage Subscription</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Upgrade screen ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.bg }]}>
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Icon name="chevronLeft" size={24} color={c.textMuted} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.text }]}>FlexMatches Pro</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={[s.hero, { backgroundColor: "#1a0800", borderColor: "#FF450033" }]}>
          <Text style={{ fontSize: 52 }}>💎</Text>
          <Text style={[s.heroTitle, { color: c.text }]}>
            FlexMatches <Text style={{ color: "#FF4500" }}>Pro</Text>
          </Text>
          <Text style={[s.heroSub, { color: c.textMuted }]}>
            Find better matches, grow faster, stand out in the community.
          </Text>
        </View>

        {/* Billing toggle */}
        <View style={[s.toggle, { backgroundColor: c.bgCard }]}>
          {(["monthly", "yearly"] as const).map((b) => (
            <TouchableOpacity
              key={b}
              style={[s.toggleBtn, billing === b && { backgroundColor: "#FF4500" }]}
              onPress={() => setBilling(b)}
              activeOpacity={0.85}
            >
              {b === "yearly" && billing !== "yearly" && (
                <View style={s.saveBadge}>
                  <Text style={s.saveBadgeText}>SAVE 37%</Text>
                </View>
              )}
              <Text style={[s.toggleBtnText, { color: billing === b ? "#fff" : c.textFaint }]}>
                {b === "monthly" ? "Monthly" : "Yearly"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Price card */}
        <View style={[s.priceCard, { backgroundColor: c.bgCard, borderColor: "#FF4500" }]}>
          <View style={s.priceRow}>
            <Text style={[s.priceAmount, { color: c.text }]}>${monthlyPrice}</Text>
            <Text style={[s.pricePer, { color: c.textFaint }]}>/mo</Text>
          </View>
          {billing === "yearly" && (
            <Text style={[s.priceSub, { color: c.textMuted }]}>Billed ${yearlyTotal}/year · saves $36/year</Text>
          )}
          <Text style={[s.priceNote, { color: c.textFaint }]}>Cancel anytime · 7-day free trial</Text>
        </View>

        {/* Subscribe CTA */}
        <TouchableOpacity
          style={[s.subscribeBtn, { opacity: subscribing ? 0.7 : 1 }]}
          onPress={openCheckout}
          disabled={subscribing}
          activeOpacity={0.85}
        >
          {subscribing
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.subscribeBtnText}>
                💎 Start {billing === "yearly" ? "Yearly" : "Monthly"} Pro — ${monthlyPrice}/mo
              </Text>
          }
        </TouchableOpacity>

        <Text style={[s.secureNote, { color: c.textFaint }]}>
          {Platform.OS === "ios"
            ? "🔒 Secure payment via Apple · Cancel in Settings"
            : "🔒 Secure payment via Stripe · Cancel anytime"}
        </Text>

        {/* Pro features */}
        <Text style={[s.sectionLabel, { color: c.textFaint }]}>EVERYTHING IN PRO</Text>
        <View style={s.featureList}>
          {PRO_FEATURES.map((f) => (
            <View key={f.label} style={[s.featureRow, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              <Text style={s.featureIcon}>{f.icon}</Text>
              <Text style={[s.featureLabel, { color: c.textSecondary }]}>{f.label}</Text>
              <Text style={{ color: "#FF4500", fontSize: 14, fontWeight: "800" }}>✓</Text>
            </View>
          ))}
        </View>

        {/* Free limits */}
        <View style={[s.freeCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Text style={[s.sectionLabel, { color: c.textFaint, marginBottom: SPACE[12] }]}>FREE PLAN LIMITS</Text>
          {FREE_LIMITS.map((f) => (
            <View key={f} style={s.freeLimitRow}>
              <Text style={[s.freeLimitX, { color: c.border }]}>✕</Text>
              <Text style={[s.freeLimitText, { color: c.textFaint }]}>{f}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACE[20], paddingVertical: SPACE[14], borderBottomWidth: 1 },
  headerTitle:    { fontSize: FONT.size.xl, fontWeight: FONT.weight.black },
  scroll:         { padding: SPACE[16], gap: SPACE[16], paddingBottom: 80 },

  // Hero
  hero:           { borderRadius: RADIUS.xl, padding: SPACE[28], borderWidth: 1, alignItems: "center", gap: SPACE[10] },
  heroTitle:      { fontSize: 28, fontWeight: FONT.weight.black, textAlign: "center", letterSpacing: -0.5 },
  heroSub:        { fontSize: FONT.size.sm, lineHeight: 21, textAlign: "center" },

  // Billing toggle
  toggle:         { flexDirection: "row", borderRadius: RADIUS.lg, padding: 3, gap: 3 },
  toggleBtn:      { flex: 1, paddingVertical: SPACE[10], borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", position: "relative" },
  toggleBtnText:  { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  saveBadge:      { position: "absolute", top: -8, right: 4, backgroundColor: PALETTE.success, borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 },
  saveBadgeText:  { fontSize: 9, fontWeight: FONT.weight.black, color: "#fff" },

  // Price card
  priceCard:      { borderRadius: RADIUS.xl, padding: SPACE[24], borderWidth: 2, alignItems: "center", gap: SPACE[6] },
  priceRow:       { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  priceAmount:    { fontSize: 48, fontWeight: FONT.weight.black, lineHeight: 52 },
  pricePer:       { fontSize: FONT.size.base, marginBottom: 8 },
  priceSub:       { fontSize: FONT.size.sm },
  priceNote:      { fontSize: 12 },

  // Subscribe button
  subscribeBtn:   { backgroundColor: "#FF4500", borderRadius: RADIUS.xl, paddingVertical: SPACE[18], alignItems: "center", shadowColor: "#FF4500", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8 },
  subscribeBtnText:{ color: "#fff", fontWeight: FONT.weight.black, fontSize: FONT.size.base },
  secureNote:     { fontSize: 12, textAlign: "center" },

  // Features
  sectionLabel:   { fontSize: 11, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 0.8 },
  featureList:    { gap: SPACE[8] },
  featureRow:     { flexDirection: "row", alignItems: "center", gap: SPACE[12], borderRadius: RADIUS.lg, padding: SPACE[14], borderWidth: 1 },
  featureIcon:    { fontSize: 20, width: 28, textAlign: "center" },
  featureLabel:   { flex: 1, fontSize: FONT.size.sm },

  // Free limits
  freeCard:       { borderRadius: RADIUS.xl, padding: SPACE[18], borderWidth: 1, gap: SPACE[8] },
  freeLimitRow:   { flexDirection: "row", alignItems: "center", gap: SPACE[10] },
  freeLimitX:     { fontSize: FONT.size.sm, width: 16, textAlign: "center" },
  freeLimitText:  { fontSize: FONT.size.sm, flex: 1 },

  // Pro state
  proTitle:       { fontSize: 28, fontWeight: FONT.weight.black, marginTop: SPACE[8] },
  proSub:         { fontSize: FONT.size.sm, textAlign: "center", lineHeight: 21, maxWidth: 300 },
  manageBtn:      { borderRadius: RADIUS.xl, paddingVertical: SPACE[14], paddingHorizontal: SPACE[24], borderWidth: 1, marginTop: SPACE[8] },
  manageBtnText:  { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
});
