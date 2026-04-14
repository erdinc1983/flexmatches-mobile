import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, InteractionManager, ActivityIndicator, Linking } from "react-native";
import { Image } from "expo-image";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import type { Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { ThemeProvider, useTheme, FONT, SPACE, PALETTE } from "../lib/theme";
import { NotificationProvider } from "../lib/notificationContext";
import { AppDataProvider } from "../lib/appDataContext";
import { registerPushToken } from "../lib/push";
import { Button } from "../components/ui/Button";
import { initSentry } from "../lib/sentry";

// Init Sentry before anything else renders
initSentry();

const ONBOARDING_DONE_KEY    = "onboarding_done_v1";
const READY_CACHE_KEY        = "auth_ready_uid_v1"; // stores userId when user is confirmed ready
export const PENDING_REF_KEY = "pending_referral_code";

function captureRefFromUrl(url: string | null) {
  if (!url) return;
  try {
    // Handle both deep links and universal links
    const parsed = new URL(url.includes("://") ? url.replace(/^[^:]+:\/\//, "https://x.com/") : url);
    const ref = parsed.searchParams.get("ref");
    if (ref) AsyncStorage.setItem(PENDING_REF_KEY, ref.trim().toUpperCase());
  } catch { /* ignore malformed URLs */ }
}

// ─── Error Boundary ──────────────────────────────────────────────────────────
type EBProps = { children: React.ReactNode };
type EBState = { hasError: boolean };

class RawErrorBoundary extends React.Component<EBProps, EBState> {
  state: EBState = { hasError: false };

  static getDerivedStateFromError(): EBState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Unhandled error:", error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return <ErrorBoundaryFallback onReset={this.reset} />;
    }
    return this.props.children;
  }
}

function ErrorBoundaryFallback({ onReset }: { onReset: () => void }) {
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  return (
    <View style={[ebStyles.container, { backgroundColor: c.bg }]}>
      <View
        style={[
          ebStyles.iconWrap,
          { backgroundColor: isDark ? PALETTE.errorSubtle : "#FDECEC" },
        ]}
      >
        <Text style={ebStyles.icon}>💥</Text>
      </View>
      <Text style={[ebStyles.title, { color: c.text }]}>
        Something crashed
      </Text>
      <Text style={[ebStyles.message, { color: c.textMuted }]}>
        An unexpected error occurred. Tap below to reload.
      </Text>
      <Button label="Reload App" onPress={onReset} size="md" style={ebStyles.button} />
    </View>
  );
}

const ebStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE[24],
    gap: SPACE[10],
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE[4],
  },
  icon: { fontSize: 28 },
  title: {
    fontSize: FONT.size.lg,
    fontWeight: FONT.weight.bold,
    textAlign: "center",
  },
  message: {
    fontSize: FONT.size.base,
    textAlign: "center",
    lineHeight: FONT.size.base * 1.5,
    paddingHorizontal: SPACE[8],
  },
  button: { marginTop: SPACE[12], alignSelf: "center" },
});

// ─── Branded Loading Screen ───────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <View style={ls.container}>
      <Image
        source={require("../assets/images/icon.png")}
        style={ls.logoImg}
        contentFit="contain"
      />
      <Text style={ls.appName}>FlexMatches</Text>
      <ActivityIndicator color="#FF6B00" size="large" style={{ marginTop: SPACE[20] }} />
    </View>
  );
}

function AuthErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={ls.container}>
      <View style={[ls.logoWrap, { backgroundColor: "#2A1A0A" }]}>
        <Text style={ls.logoEmoji}>⚠️</Text>
      </View>
      <Text style={[ls.appName, { marginBottom: SPACE[8] }]}>Could not connect</Text>
      <Text style={ls.errorSub}>Please check your connection and try again.</Text>
      <View style={ls.retryBtn}>
        <Text style={ls.retryText} onPress={onRetry}>Retry</Text>
      </View>
    </View>
  );
}

function BannedScreen() {
  return (
    <View style={ls.container}>
      <View style={[ls.logoWrap, { backgroundColor: "#2A0A0A" }]}>
        <Text style={ls.logoEmoji}>🚫</Text>
      </View>
      <Text style={[ls.appName, { marginBottom: SPACE[8] }]}>Account Suspended</Text>
      <Text style={ls.errorSub}>
        Your account has been suspended for violating our community guidelines.
        If you believe this is a mistake, contact support@flexmatches.com
      </Text>
      <View style={ls.retryBtn}>
        <Text style={ls.retryText} onPress={() => supabase.auth.signOut()}>Sign Out</Text>
      </View>
    </View>
  );
}

const ls = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A", alignItems: "center", justifyContent: "center" },
  logoImg:   { width: 96, height: 96, borderRadius: 22, marginBottom: SPACE[16] },
  logoWrap:  { width: 80, height: 80, borderRadius: 20, backgroundColor: "#FF6B00", alignItems: "center", justifyContent: "center", marginBottom: SPACE[16] },
  logoEmoji: { fontSize: 40 },
  appName:   { fontSize: FONT.size.xl, fontWeight: FONT.weight.black, color: "#FFFFFF", letterSpacing: -0.5 },
  errorSub:  { fontSize: FONT.size.base, color: "#888888", textAlign: "center", paddingHorizontal: SPACE[32], marginTop: SPACE[8] },
  retryBtn:  { marginTop: SPACE[24], backgroundColor: "#FF6B00", paddingHorizontal: SPACE[32], paddingVertical: SPACE[14], borderRadius: 30 },
  retryText: { color: "#FFFFFF", fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
});

// ─── App routing state ────────────────────────────────────────────────────────
type AppState = "loading" | "unauthenticated" | "needs_onboarding" | "ready" | "auth_error" | "banned";

function extractRoute(response: Notifications.NotificationResponse): string | null {
  const data = response.notification.request.content.data ?? {};
  const type = data.type as string | undefined;
  const relatedId = (data.relatedId ?? data.matchId) as string | undefined;

  if (type === "message" || type === "session_proposed" || type === "session_accepted" || type === "session_declined") {
    return relatedId ? `/chat/${relatedId}` : null;
  }
  if (type === "match_request" || type === "match_accepted") {
    return "/(tabs)/matches";
  }
  return null; // unknown types → stay on home (graceful fallback)
}

async function resolveAppState(session: Session | null): Promise<AppState> {
  if (!session) return "unauthenticated";

  // Fast path: if this user was confirmed ready before, open immediately.
  // Banned check still runs in background — ban takes effect on next launch.
  const cachedUid = await AsyncStorage.getItem(READY_CACHE_KEY);
  if (cachedUid === session.user.id) {
    // Background: refresh banned_at without blocking launch
    supabase
      .from("users")
      .select("banned_at")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (data?.banned_at) {
          AsyncStorage.removeItem(READY_CACHE_KEY);
          AsyncStorage.removeItem(ONBOARDING_DONE_KEY);
        }
      });
    return "ready";
  }

  // Slow path: first launch or cache miss — hit DB to check onboarding + banned
  const { data } = await supabase
    .from("users")
    .select("full_name, banned_at")
    .eq("id", session.user.id)
    .single();

  if (data?.banned_at) return "banned";

  const state: AppState = data?.full_name ? "ready" : "needs_onboarding";
  if (state === "ready") {
    AsyncStorage.setItem(READY_CACHE_KEY, session.user.id);
    AsyncStorage.setItem(ONBOARDING_DONE_KEY, "1");
  }
  return state;
}

export default function RootLayout() {
  const [appState, setAppState] = useState<AppState>("loading");
  const appStateRef = useRef<AppState>("loading");
  const pendingRoute = useRef<string | null>(null);

  // Keep a live ref to appState so listener closures see current value
  useEffect(() => { appStateRef.current = appState; }, [appState]);

  async function checkAuth() {
    setAppState("loading");
    const timeoutId = setTimeout(() => setAppState("auth_error"), 20_000);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const newState = await resolveAppState(session); // wait for DB query too
      clearTimeout(timeoutId);
      setAppState(newState);
    } catch {
      clearTimeout(timeoutId);
      setAppState("auth_error");
    }
  }

  useEffect(() => {
    // Cold start: capture referral code from deep link URL
    Linking.getInitialURL().then(captureRefFromUrl);
    // Background: app already running when deep link is tapped
    const linkingSub = Linking.addEventListener("url", ({ url }) => captureRefFromUrl(url));

    // Cold start: check if the app was opened by tapping a notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) pendingRoute.current = extractRoute(response);
    });

    // Background: app was running and user tapped a notification
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = extractRoute(response);
      if (!route) return;
      // Read the LIVE app state from ref (closure captured "loading" at mount)
      if (appStateRef.current === "ready") {
        router.push(route as any);
      } else {
        pendingRoute.current = route;
      }
    });

    return () => { sub.remove(); linkingSub.remove(); };
   
  }, []);

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Let checkAuth() handle the initial load — skip the duplicate
        if (event === "INITIAL_SESSION") return;
        if (event === "PASSWORD_RECOVERY") {
          router.replace("/(auth)/reset-password");
          return;
        }
        if (event === "SIGNED_OUT") {
          AsyncStorage.removeItem(ONBOARDING_DONE_KEY);
          AsyncStorage.removeItem(READY_CACHE_KEY);
        }
        try {
          setAppState(await resolveAppState(session));
        } catch {
          setAppState("auth_error");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (appState === "loading") return;
    if (appState === "unauthenticated") { router.replace("/(auth)/welcome"); return; }
    if (appState === "needs_onboarding") { router.replace("/(auth)/onboarding"); return; }
    if (appState === "banned") return; // BannedScreen rendered directly, no navigation needed
    // ready — navigate to pending deep link if present, otherwise home
    const deepLink = pendingRoute.current;
    pendingRoute.current = null;
    router.replace(deepLink ? (deepLink as any) : "/(tabs)/home");
    // Defer background work until after the navigation animation completes
    InteractionManager.runAfterInteractions(() => {
      registerPushToken();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) supabase.from("users").update({ last_active: new Date().toISOString() }).eq("id", user.id).then(() => {});
      });
    });
  }, [appState]);

  if (appState === "loading") return <LoadingScreen />;
  if (appState === "auth_error") return <AuthErrorScreen onRetry={checkAuth} />;
  if (appState === "banned") return <BannedScreen />;

  return (
    <ThemeProvider>
      <RawErrorBoundary>
        <AppDataProvider>
        <NotificationProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chat/[matchId]" options={{ presentation: "card", animation: "slide_from_right" }} />
            <Stack.Screen name="notifications" options={{ presentation: "card", animation: "slide_from_right" }} />
            <Stack.Screen name="search" options={{ presentation: "card", animation: "slide_from_right" }} />
          </Stack>
        </NotificationProvider>
        </AppDataProvider>
      </RawErrorBoundary>
    </ThemeProvider>
  );
}
