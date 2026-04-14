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

// Map notification type to the user pref key that controls whether to send.
// Keys must match settings.tsx NotifPrefs shape.
const TYPE_TO_PREF: Record<NotifType, string> = {
  match_request:     "match_requests",
  match_accepted:    "match_requests",
  message:           "new_messages",
  session_proposed:  "event_reminders",
  session_accepted:  "event_reminders",
  session_declined:  "event_reminders",
};

/**
 * Check whether the recipient has opted in to receive this notification type.
 *
 * Supabase returns { data, error } and does not throw on RLS denial or query
 * failure — we must check `error` explicitly. On any failure we default to
 * SEND (preserves existing engagement behaviour), but log the failure so it
 * shows up in Sentry / dev logs. If you're auditing silenced notifications,
 * grep for "[recipientAllowsType]".
 *
 * Long-term: move enforcement server-side via Edge Function using the
 * service-role key so the sender's client can't bypass the check.
 */
async function recipientAllowsType(userId: string, type: NotifType): Promise<boolean> {
  const prefKey = TYPE_TO_PREF[type];
  if (!prefKey) return true; // unknown type → default to send

  const { data, error } = await supabase
    .from("users")
    .select("notification_prefs")
    .eq("id", userId)
    .single();

  if (error) {
    console.warn("[recipientAllowsType] Prefs lookup failed, defaulting to send:", error.message);
    return true;
  }
  if (!data) {
    console.warn("[recipientAllowsType] No user row for", userId, "— defaulting to send");
    return true;
  }

  const prefs = (data.notification_prefs ?? {}) as Record<string, boolean>;
  // Missing pref key defaults to enabled (matches DEFAULT_NOTIF in settings.tsx)
  return prefs[prefKey] !== false;
}

/**
 * Create an in-app notification entry + send push.
 * This is the single function to call for all notification events.
 * Honours the recipient's notification_prefs — if the user has disabled
 * this type, we skip both the in-app row AND the push.
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
  // Respect user's notification preferences — skip entirely if opted out
  const allowed = await recipientAllowsType(userId, opts.type);
  if (!allowed) return;

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
    if (__DEV__) console.log("[Push] Token registered");

    // Store in Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error: upErr } = await supabase
        .from("users")
        .update({ expo_push_token: token })
        .eq("id", user.id);
      if (upErr) console.warn("[Push] Token store failed:", upErr.message);
      else if (__DEV__) console.log("[Push] Token stored");
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
