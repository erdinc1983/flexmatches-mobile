import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Stack, router } from "expo-router";
import { Session } from "@supabase/supabase-js";
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

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!initialized) return;
    if (session) {
      router.replace("/(tabs)/home");
      // Register push token after login
      registerPushToken();
    } else {
      router.replace("/(auth)/welcome");
    }
  }, [session, initialized]);

  return (
    <ThemeProvider>
      <RawErrorBoundary>
        <NotificationProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
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
