/**
 * NotificationContext
 *
 * Provides unread count to the whole app (tab bar badge, bell icon, etc.)
 * and a real-time Supabase subscription for instant updates.
 *
 * Usage:
 *   const { unreadCount, refresh } = useNotifications();
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import {
  notifyMatchRequest, notifyMatchAccepted, notifyBadgeUnlocked, notifyPartnerWorkout,
  notifyNewMessage, notifyGeneric, requestNotificationPermission,
} from "./notifications";
import { registerPushToken } from "./push";

type NotifRow = {
  id:         string;
  type:       string | null;
  title:      string | null;
  body:       string | null;
  message:    string | null;
  read:       boolean;
  created_at: string;
  related_id: string | null;
  url:        string | null;
};

type NotifContextValue = {
  unreadCount:    number;
  unreadMessages: number;
  refresh:        () => Promise<void>;
  /**
   * Subscribe to new-notification INSERT events. The context keeps a single
   * realtime channel for the whole app; consumers (Notifications screen,
   * future widgets) register a handler and the context fans out the row.
   * Returns an unsubscribe function — call it on unmount.
   */
  onInsert: (handler: (notif: NotifRow) => void) => () => void;
};

const NotifContext = createContext<NotifContextValue>({
  unreadCount:    0,
  unreadMessages: 0,
  refresh:        async () => {},
  onInsert:       () => () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchCount = useCallback(async (uid: string) => {
    // Single RPC replaces 3 sequential queries
    const { data, error } = await supabase.rpc("get_unread_counts", { p_user_id: uid });
    if (error) { console.warn("[NotifCtx] fetchCount error:", error.message); return; }
    setUnreadCount(data?.unread_notifications ?? 0);
    setUnreadMessages(data?.unread_messages ?? 0);
  }, []);

  const refresh = useCallback(async () => {
    if (userId) await fetchCount(userId);
  }, [userId, fetchCount]);

  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const handlersRef = useRef<Set<(n: NotifRow) => void>>(new Set());

  // Stable subscribe API: consumers register a handler, get back an unsub.
  // Replaces every duplicate channel that used to open in screens like
  // notifications.tsx — there is now exactly one realtime subscription
  // per user for INSERT events on public.notifications.
  const onInsert = useCallback((handler: (notif: NotifRow) => void) => {
    handlersRef.current.add(handler);
    return () => { handlersRef.current.delete(handler); };
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;
      setUserId(user.id);
      fetchCount(user.id);
      requestNotificationPermission();
      registerPushToken();

      // Clean up any previous channel before creating a new one
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }

      channelRef.current = supabase
        .channel(`notif-badge-${user.id}-${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          (payload) => {
            const n = payload.new as NotifRow;
            fetchCount(user.id);

            // Local notification dispatch (sound + banner). Stays in the
            // context because it's app-wide behavior — fires regardless
            // of which screen the user is on.
            const body = n.body ?? n.message ?? "";
            if (n.type === "match_request")      notifyMatchRequest(body || "Someone wants to train with you!");
            if (n.type === "match_accepted")     notifyMatchAccepted(body || "Your match was accepted");
            if (n.type === "new_message" ||
                n.type === "message")            notifyNewMessage(n.title ?? "New message", body || "You have a new message");
            if (n.type === "session_proposed")   notifyGeneric(n.title ?? "Session Proposed 📅", body || "Someone proposed a training session");
            if (n.type === "session_accepted")   notifyGeneric(n.title ?? "Session Accepted 🤜", body || "Your session was accepted");
            if (n.type === "session_declined")   notifyGeneric(n.title ?? "Session Declined", body || "A session was declined");
            if (n.type === "partner_workout")    notifyPartnerWorkout(body || "Your training buddy just logged a workout!");
            if (n.type === "badge_unlocked") {
              const title = n.title ?? "Badge Unlocked";
              const emoji = title.match(/[\u{1F000}-\u{1FFFF}]/u)?.[0] ?? "🏆";
              notifyBadgeUnlocked(emoji, body || title);
            }

            // Fan out to subscribed screens. Each screen handler gets the
            // raw row and decides what to do (prepend to list, refresh
            // badge, ignore filtered category).
            handlersRef.current.forEach((h) => {
              try { h(n); }
              catch (err) { console.warn("[NotifCtx] handler threw:", err); }
            });
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          () => fetchCount(user.id),
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          () => fetchCount(user.id),
        )
        // Note: the global messages INSERT listener that used to live here
        // has moved to a server-side trigger (migration 23). Every new
        // message produces a `new_message` row in public.notifications for
        // the receiver, which fires the INSERT handler above. That
        // eliminates the unfiltered firehose where every message in the
        // entire DB used to ship to every connected device.
        .subscribe((status, err) => {
          if (err) console.warn("[NotifCtx] Subscription error:", err.message);
        });
    });

    return () => {
      cancelled = true;
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [fetchCount]);

  return (
    <NotifContext.Provider value={{ unreadCount, unreadMessages, refresh, onInsert }}>
      {children}
    </NotifContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotifContext);
}
