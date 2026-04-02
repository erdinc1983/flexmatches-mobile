/**
 * Push Notification System
 *
 * Handles:
 *   1. Registering Expo push token and storing it in Supabase
 *   2. Sending push notifications to other users via Expo Push API
 *
 * Works with both Expo Go (local only) and EAS builds (real push).
 * In Expo Go, registerPushToken() will silently fail — that's fine,
 * local notifications still work via lib/notifications.ts.
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "./supabase";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// ─── In-app notification (writes to notifications table) ────────────────────

export type NotifType = "match_request" | "match_accepted" | "message" | "session_proposed" | "session_accepted" | "session_declined";

/**
 * Create an in-app notification entry + send push.
 * This is the single function to call for all notification events.
 */
export async function notifyUser(
  userId: string,
  opts: {
    type: NotifType;
    title: string;
    body: string;
    relatedId?: string;
    data?: Record<string, any>;
  }
): Promise<void> {
  // 1. Insert into notifications table (all types including messages)
  const { error } = await supabase.from("notifications").insert({
    user_id:    userId,
    type:       opts.type,
    title:      opts.title,
    body:       opts.body,
    message:    opts.body,
    related_id: opts.relatedId ?? null,
    read:       false,
  });
  if (error) console.warn("[notifyUser] Insert failed:", error.message);
  else console.log("[notifyUser] Notification inserted for", userId);

  // 2. Send push notification (shows on device — all types including messages)
  await sendPushToUser(userId, {
    title: opts.title,
    body: opts.body,
    channelId: opts.type === "message" ? "messages" : "default",
    data: { type: opts.type, ...opts.data },
  });
}

// ─── Token registration ─────────────────────────────────────────────────────

/**
 * Register push token for the current user.
 * Call once on app start after auth is confirmed.
 */
export async function registerPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulators can't receive push

  // Request permission
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  // Android channels
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Messages",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "4e957dd8-fd32-4678-9b74-4232d65e658d",
    });
    const token = tokenData.data;
    console.log("[Push] Got token:", token.slice(0, 25) + "...");

    // Store in Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error: upErr } = await supabase
        .from("users")
        .update({ expo_push_token: token })
        .eq("id", user.id);
      if (upErr) console.warn("[Push] Token store failed:", upErr.message);
      else console.log("[Push] Token stored for user:", user.id);
    }

    return token;
  } catch (e) {
    console.warn("[Push] Token registration failed:", e);
    return null;
  }
}

/**
 * Remove the current device's push token from the DB.
 * Call BEFORE supabase.auth.signOut() so the token is cleared
 * while the session is still valid.
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("users")
      .update({ expo_push_token: null })
      .eq("id", user.id);
  } catch {
    // Best-effort — don't block sign-out
  }
}

// ─── Send push to a specific user ──────────────────────────────────────────

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, any>;
  channelId?: string;
};

/**
 * Send push notification to a user by their user ID.
 * Looks up their expo_push_token from the DB.
 * Best-effort — silently fails if no token or send fails.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    const { data } = await supabase
      .from("users")
      .select("expo_push_token")
      .eq("id", userId)
      .single();

    const token = data?.expo_push_token;
    console.log("[Push] token lookup for", userId, "→", token ? `${token.slice(0, 20)}...` : "NULL (no token stored)");
    if (!token) return;

    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        to: token,
        title: payload.title,
        body: payload.body,
        sound: "default",
        channelId: payload.channelId ?? "default",
        data: payload.data ?? {},
      }),
    });
  } catch {
    // Best-effort — don't block the caller
  }
}

/**
 * Send push to multiple users at once.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0) return;
  try {
    const { data } = await supabase
      .from("users")
      .select("expo_push_token")
      .in("id", userIds)
      .not("expo_push_token", "is", null);

    const tokens = (data ?? [])
      .map((u: any) => u.expo_push_token)
      .filter(Boolean);

    if (tokens.length === 0) return;

    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(
        tokens.map((token: string) => ({
          to: token,
          title: payload.title,
          body: payload.body,
          sound: "default",
          channelId: payload.channelId ?? "default",
          data: payload.data ?? {},
        }))
      ),
    });
  } catch {
    // Best-effort
  }
}
