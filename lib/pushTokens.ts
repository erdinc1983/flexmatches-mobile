/**
 * Push Token Registration
 *
 * Registers the device for Expo remote push notifications and saves
 * the Expo Push Token to Supabase `push_tokens` table.
 *
 * Prerequisites (one-time setup):
 *   1. Run `eas init` in the project root to get a real projectId
 *   2. Replace "YOUR_EAS_PROJECT_ID" in app.json → extra.eas.projectId
 *   3. Run `eas build --profile development --platform ios` to create dev build
 *
 * DB migration (run once in Supabase SQL editor):
 *   CREATE TABLE IF NOT EXISTS public.push_tokens (
 *     id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 *     token       text NOT NULL,
 *     platform    text NOT NULL,  -- 'ios' | 'android'
 *     updated_at  timestamptz DEFAULT now(),
 *     UNIQUE (user_id, token)
 *   );
 *   ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Users manage own tokens"
 *     ON public.push_tokens FOR ALL USING (auth.uid() = user_id);
 */

import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";
import { requestNotificationPermission } from "./notifications";

// Android requires a notification channel for remote push
export function setupAndroidChannel() {
  if (Platform.OS !== "android") return;
  Notifications.setNotificationChannelAsync("default", {
    name: "FlexMatches",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF4500",
  });
}

/**
 * Request permission, get Expo Push Token, and upsert it to Supabase.
 * Safe to call on every app launch — idempotent via ON CONFLICT.
 */
export async function registerAndSavePushToken(userId: string): Promise<string | null> {
  // Remote push only works on physical devices (not Expo Go simulator)
  if (Platform.OS === "web") return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId || projectId === "YOUR_EAS_PROJECT_ID") {
    // Not configured yet — local notifications still work
    return null;
  }

  const granted = await requestNotificationPermission();
  if (!granted) return null;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    await supabase.from("push_tokens").upsert(
      { user_id: userId, token, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: "user_id,token" },
    );

    return token;
  } catch {
    return null;
  }
}

/**
 * Remove the device token from Supabase on logout.
 */
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId || projectId === "YOUR_EAS_PROJECT_ID") return;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from("push_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("token", tokenData.data);
  } catch { /* ignore */ }
}
