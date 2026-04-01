/**
 * Expo Push Notification Sender
 *
 * Used server-side (Supabase Edge Functions or Next.js API routes)
 * to send remote push notifications to specific users.
 *
 * Flow:
 *   1. App registers → push_tokens table gets the Expo Push Token
 *   2. Server reads token(s) for a user → calls Expo Push API
 *   3. Expo routes to APNs (iOS) or FCM (Android)
 *
 * Usage in a Supabase Edge Function or API route:
 *   import { sendExpoPush } from "./expoPush";
 *   await sendExpoPush(userId, { title: "New match!", body: "..." });
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: "default" | null;
};

/**
 * Send a push notification to all registered devices for a user.
 * Call this from your backend after inserting into the `notifications` table.
 *
 * @param tokens  Expo Push Tokens (fetch from push_tokens table for the user)
 * @param payload Notification content
 */
export async function sendExpoPushToTokens(
  tokens: string[],
  payload: PushPayload,
): Promise<void> {
  if (tokens.length === 0) return;

  const messages = tokens
    .filter((t) => t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["))
    .map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      badge: payload.badge,
      sound: payload.sound ?? "default",
      priority: "high",
    }));

  if (messages.length === 0) return;

  await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(messages),
  });
}
