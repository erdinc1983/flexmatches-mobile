import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { ThemeProvider, useTheme, FONT, SPACE, PALETTE } from "../lib/theme";
import { NotificationProvider } from "../lib/notificationContext";
import { registerPushToken } from "../lib/push";
import { Button } from "../components/ui/Button";

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

// ─── App routing state ────────────────────────────────────────────────────────
type AppState = "loading" | "unauthenticated" | "needs_onboarding" | "ready";

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
  const { data } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", session.user.id)
    .single();
  return data?.full_name ? "ready" : "needs_onboarding";
}

export default function RootLayout() {
  const [appState, setAppState] = useState<AppState>("loading");
  const pendingRoute = useRef<string | null>(null);

  useEffect(() => {
    // Cold start: check if the app was opened by tapping a notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) pendingRoute.current = extractRoute(response);
    });

    // Background: app was running and user tapped a notification
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = extractRoute(response);
      if (!route) return;
      // If already ready, navigate immediately; otherwise queue for after auth
      if (appState === "ready") {
        router.push(route as any);
      } else {
        pendingRoute.current = route;
      }
    });

    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setAppState(await resolveAppState(session));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          router.replace("/(auth)/reset-password");
          return;
        }
        setAppState(await resolveAppState(session));
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (appState === "loading") return;
    if (appState === "unauthenticated") { router.replace("/(auth)/welcome"); return; }
    if (appState === "needs_onboarding") { router.replace("/(auth)/onboarding"); return; }
    // ready — navigate to pending deep link if present, otherwise home
    const deepLink = pendingRoute.current;
    pendingRoute.current = null;
    router.replace(deepLink ? (deepLink as any) : "/(tabs)/home");
    registerPushToken();
  }, [appState]);

  return (
    <ThemeProvider>
      <RawErrorBoundary>
        <NotificationProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(auth)/forgot-password" options={{ presentation: "card", animation: "slide_from_right" }} />
            <Stack.Screen name="(auth)/reset-password" options={{ presentation: "card", animation: "slide_from_right" }} />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chat/[matchId]" options={{ presentation: "card", animation: "slide_from_right" }} />
            <Stack.Screen name="notifications" options={{ presentation: "card", animation: "slide_from_right" }} />
            <Stack.Screen name="search" options={{ presentation: "card", animation: "slide_from_right" }} />
            <Stack.Screen name="(tabs)/leaderboard" options={{ presentation: "card", animation: "slide_from_right" }} />
          </Stack>
        </NotificationProvider>
      </RawErrorBoundary>
    </ThemeProvider>
  );
}
