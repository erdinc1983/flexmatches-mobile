import { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { ThemeProvider } from "../lib/theme";

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
    } else {
      router.replace("/(auth)/welcome");
    }
  }, [session, initialized]);

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[matchId]" options={{ presentation: "card", animation: "slide_from_right" }} />
        <Stack.Screen name="notifications" options={{ presentation: "card", animation: "slide_from_right" }} />
        <Stack.Screen name="search" options={{ presentation: "card", animation: "slide_from_right" }} />
        <Stack.Screen name="(tabs)/leaderboard" options={{ presentation: "card", animation: "slide_from_right" }} />
      </Stack>
    </ThemeProvider>
  );
}
