/**
 * NotificationContext
 *
 * Provides unread count to the whole app (tab bar badge, bell icon, etc.)
 * and a real-time Supabase subscription for instant updates.
 *
 * Usage:
 *   const { unreadCount, refresh } = useNotifications();
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import {
  notifyMatchRequest, notifyMatchAccepted, notifyBadgeUnlocked, notifyPartnerWorkout,
  requestNotificationPermission,
} from "./notifications";
import { registerAndSavePushToken, setupAndroidChannel } from "./pushTokens";

type NotifContextValue = {
  unreadCount: number;
  refresh: () => Promise<void>;
};

const NotifContext = createContext<NotifContextValue>({
  unreadCount: 0,
  refresh: async () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchCount = useCallback(async (uid: string) => {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("read", false);
    setUnreadCount(count ?? 0);
  }, []);

  const refresh = useCallback(async () => {
    if (userId) await fetchCount(userId);
  }, [userId, fetchCount]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    setupAndroidChannel();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      fetchCount(user.id);
      requestNotificationPermission();
      registerAndSavePushToken(user.id); // no-op until eas init is done

      // Real-time: new notification inserted → update badge + fire local push
      channel = supabase
        .channel(`notif-badge-${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          (payload) => {
            fetchCount(user.id);
            // Fire a local push for key types
            const n = payload.new as { type?: string; title?: string; body?: string; message?: string };
            const body = n.body ?? n.message ?? "";
            if (n.type === "match_request")    notifyMatchRequest(body || "Someone wants to train with you!");
            if (n.type === "match_accepted")   notifyMatchAccepted(body || "Your match was accepted");
            if (n.type === "partner_workout")  notifyPartnerWorkout(body || "Your training buddy just logged a workout!");
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
        .subscribe();
    });

    return () => { channel?.unsubscribe(); };
  }, [fetchCount]);

  return (
    <NotifContext.Provider value={{ unreadCount, refresh }}>
      {children}
    </NotifContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotifContext);
}
