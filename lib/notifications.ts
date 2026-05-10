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

// Show banners + play sound while the app is in the foreground.
// Suppress remote push display when foregrounded — the Supabase realtime
// handler fires a local notification for the same event, so showing the
// remote push too would produce a duplicate alert.
// Foreground notification handler.
// Suppress remote push for chat messages only — the Supabase realtime
// handler already fires a local notification for the same event.
// All other push types (match_request, session, etc.) are shown normally.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Trigger union includes push/calendar/timeInterval/etc. Only push triggers have type "push".
    const trigger = notification.request.trigger as { type?: string } | null;
    const isRemotePush = trigger?.type === "push";
    const data = notification.request.content.data ?? {};
    const isChatMessagePush = data?.type === "message";

    if (isRemotePush && isChatMessagePush) {
      return {
        shouldShowBanner: false,
        shouldShowList:   false,
        shouldPlaySound:  false,
        shouldSetBadge:   false,
      };
    }

    return {
      shouldShowBanner: true,
      shouldShowList:   true,
      shouldPlaySound:  true,
      shouldSetBadge:   false,
    };
  },
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

export async function notifyNewMessage(senderName: string, preview: string, matchId?: string): Promise<void> {
  await _fire(
    senderName,
    preview.length > 80 ? preview.slice(0, 77) + "…" : preview,
    matchId ? { type: "message", relatedId: matchId } : undefined,
  );
}

export async function notifyMatchRequest(senderName: string, matchId?: string): Promise<void> {
  await _fire(
    "New Match Request 🤝",
    `${senderName} wants to train with you!`,
    { type: "match_request", relatedId: matchId },
  );
}

export async function notifyMatchAccepted(partnerName: string, matchId?: string): Promise<void> {
  await _fire(
    "Match Accepted ✅",
    `You and ${partnerName} are now connected. Say hi!`,
    matchId ? { type: "match_accepted", relatedId: matchId } : undefined,
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

export async function notifyPartnerWorkout(body: string): Promise<void> {
  await _fire("💪 Training buddy is active!", body);
}

export async function notifyGeneric(title: string, body: string): Promise<void> {
  await _fire(title, body);
}

/**
 * Schedule a "Did you meet?" reminder for 9am the morning after the session date.
 * Call this when a session is proposed or accepted.
 *
 * If `sessionId` is provided, uses a stable identifier (`session-reminder-{id}`)
 * so the same reminder can be cancel-and-replaced without stacking duplicates.
 * Without a sessionId we fall back to a system-assigned id (legacy callers).
 */
export async function scheduleSessionReminder(
  partnerName: string,
  sessionDateStr: string,  // "YYYY-MM-DD"
  sessionId?: string,
): Promise<string | null> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    const [y, m, d] = sessionDateStr.split("-").map(Number);
    const fireAt = new Date(y, m - 1, d + 1, 9, 0, 0); // 9am next day
    if (fireAt <= new Date()) return null;

    const identifier = sessionId ? `session-reminder-${sessionId}` : undefined;
    if (identifier) {
      // Cancel any prior schedule with this identifier so we don't double-fire.
      await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
    }

    const id = await Notifications.scheduleNotificationAsync({
      ...(identifier ? { identifier } : {}),
      content: {
        title: "Did you meet up? 🤝",
        body:  `How did your session with ${partnerName} go? Mark it done in chat!`,
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

/**
 * Re-schedule local "Did you meet?" reminders for every accepted future-dated
 * session involving the calling user. iOS wipes all scheduled local notifs on
 * reinstall — without this, reinstalls silently drop session reminders.
 *
 * Idempotent: each reminder uses a stable `session-reminder-{sessionId}`
 * identifier so re-running this on every launch doesn't stack duplicates.
 *
 * Pass the user's id explicitly so we don't double-fetch from the auth layer
 * here (the caller already has it from the same getUser() call that gates
 * push token registration).
 */
export async function reschedulePendingSessionReminders(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<void> {
  try {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const { data: sessions, error } = await supabase
      .from("buddy_sessions")
      .select("id, session_date, proposer_id, receiver_id, sport")
      .or(`proposer_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq("status", "accepted")
      .gte("session_date", todayStr);
    if (error || !sessions || sessions.length === 0) return;

    // Need partner names for each session. Single batched IN query.
    const partnerIds = Array.from(
      new Set(
        sessions.map((s: any) => (s.proposer_id === userId ? s.receiver_id : s.proposer_id)),
      ),
    );
    const { data: partners } = await supabase
      .from("users")
      .select("id, full_name, username")
      .in("id", partnerIds);

    const nameById = new Map<string, string>();
    for (const p of (partners ?? [])) {
      nameById.set(p.id, (p.full_name ?? p.username ?? "your partner") as string);
    }

    for (const s of sessions) {
      const partnerId = s.proposer_id === userId ? s.receiver_id : s.proposer_id;
      const partnerName = (nameById.get(partnerId)?.split(" ")[0]) ?? "your partner";
      await scheduleSessionReminder(partnerName, s.session_date, s.id);
    }
  } catch {
    // Best-effort. Silent on failure — reminders are nice-to-have.
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function _fire(title: string, body: string, data?: Record<string, any>): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true, data: data ?? {} },
      trigger: null, // immediate
    });
  } catch { /* ignore */ }
}
