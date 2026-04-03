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
import { registerAndSavePushToken, setupAndroidChannel } from "./pushTokens";

type NotifContextValue = {
  unreadCount: number;
  unreadMessages: number;
  refresh: () => Promise<void>;
};

const NotifContext = createContext<NotifContextValue>({
  unreadCount: 0,
  unreadMessages: 0,
  refresh: async () => {},
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

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let cancelled = false;

    setupAndroidChannel();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;
      setUserId(user.id);
      fetchCount(user.id);
      requestNotificationPermission();
      registerAndSavePushToken(user.id);

      // Clean up any previous channel before creating a new one
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }

      console.log("[Realtime] Setting up channel for user:", user.id);
      channelRef.current = supabase
        .channel(`notif-badge-${user.id}-${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          (payload) => {
            console.log("[Realtime] 🔔 Notification INSERT received:", JSON.stringify(payload.new));
            fetchCount(user.id);
            const n = payload.new as { type?: string; title?: string; body?: string; message?: string };
            const body = n.body ?? n.message ?? "";
            // message sound is handled by the messages INSERT handler below (more reliable)
            if (n.type === "match_request")      notifyMatchRequest(body || "Someone wants to train with you!");
            if (n.type === "match_accepted")     notifyMatchAccepted(body || "Your match was accepted");
            if (n.type === "session_proposed")   notifyGeneric(n.title ?? "Session Proposed 📅", body || "Someone proposed a training session");
            if (n.type === "session_accepted")   notifyGeneric(n.title ?? "Session Accepted 🤜", body || "Your session was accepted");
            if (n.type === "session_declined")   notifyGeneric(n.title ?? "Session Declined", body || "A session was declined");
            if (n.type === "partner_workout")    notifyPartnerWorkout(body || "Your training buddy just logged a workout!");
            if (n.type === "badge_unlocked") {
              const title = n.title ?? "Badge Unlocked";
              const emoji = title.match(/[\u{1F000}-\u{1FFFF}]/u)?.[0] ?? "🏆";
              notifyBadgeUnlocked(emoji, body || title);
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          () => fetchCount(user.id),
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          async (payload) => {
            const msg = payload.new as { sender_id: string; content?: string };
            if (msg.sender_id !== user.id) {
              fetchCount(user.id);
              const { data: sender } = await supabase
                .from("users")
                .select("full_name, username")
                .eq("id", msg.sender_id)
                .single();
              const name = sender?.full_name || sender?.username || "Someone";
              notifyNewMessage(name, msg.content || "New message");
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages" },
          () => fetchCount(user.id),
        )
        .subscribe((status, err) => {
          console.log("[Realtime] subscription status:", status, err ?? "");
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
    <NotifContext.Provider value={{ unreadCount, unreadMessages, refresh }}>
      {children}
    </NotifContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotifContext);
}
