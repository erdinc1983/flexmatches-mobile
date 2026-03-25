/**
 * Local notification utility
 *
 * Handles foreground banners, scheduled reminders, and per-event helpers.
 * All functions are safe to call without pre-checking permissions.
 *
 * Scheduled IDs (cancel by key):
 *   "streak-reminder"  — daily streak reminder
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Show banners + play sound while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

let _permissionGranted: boolean | null = null;

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (_permissionGranted !== null) return _permissionGranted;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") { _permissionGranted = true; return true; }
    const { status } = await Notifications.requestPermissionsAsync();
    _permissionGranted = status === "granted";
    return _permissionGranted;
  } catch {
    _permissionGranted = false;
    return false;
  }
}

// ─── Immediate local notifications ────────────────────────────────────────────

export async function notifyNewMessage(senderName: string, preview: string): Promise<void> {
  await _fire(
    senderName,
    preview.length > 80 ? preview.slice(0, 77) + "…" : preview,
  );
}

export async function notifyMatchRequest(senderName: string): Promise<void> {
  await _fire(
    "New Match Request 🤝",
    `${senderName} wants to train with you!`,
  );
}

export async function notifyMatchAccepted(partnerName: string): Promise<void> {
  await _fire(
    "Match Accepted ✅",
    `You and ${partnerName} are now connected. Say hi!`,
  );
}

export async function notifyBadgeUnlocked(emoji: string, badgeName: string): Promise<void> {
  await _fire(
    `${emoji} Badge Unlocked!`,
    `You earned "${badgeName}". Keep it up!`,
  );
}

export async function notifyCircleEvent(circleName: string, dateLabel: string): Promise<void> {
  await _fire(
    "Circle Event Tomorrow 📅",
    `"${circleName}" is happening ${dateLabel}. Don't forget!`,
  );
}

// ─── Scheduled notifications ──────────────────────────────────────────────────

/**
 * Schedule a daily streak reminder at the given hour (24h, local time).
 * Cancels any previously scheduled one first.
 */
export async function scheduleStreakReminder(hour: number = 20): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    // Cancel existing
    await Notifications.cancelScheduledNotificationAsync("streak-reminder").catch(() => {});

    await Notifications.scheduleNotificationAsync({
      identifier: "streak-reminder",
      content: {
        title: "🔥 Don't break your streak!",
        body:  "Log a workout today to keep your streak alive.",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
      },
    });
  } catch { /* ignore */ }
}

export async function cancelStreakReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync("streak-reminder");
  } catch { /* ignore */ }
}

/**
 * Schedule a one-time event reminder 24h before the given Date.
 * Returns the scheduled notification identifier.
 */
export async function scheduleEventReminder(
  eventName: string,
  eventDate: Date,
): Promise<string | null> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    const fireAt = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
    if (fireAt <= new Date()) return null; // already passed

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "📅 Upcoming Circle Event",
        body:  `"${eventName}" is tomorrow. Get ready!`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });
    return id;
  } catch {
    return null;
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function _fire(title: string, body: string): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null, // immediate
    });
  } catch { /* ignore */ }
}
