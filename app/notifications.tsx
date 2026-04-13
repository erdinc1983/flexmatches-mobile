/**
 * Notifications Screen
 *
 * Clean Nextdoor-style list — icon + descriptive text + time.
 * Categories: All · Matches · Messages · Sessions · Circles
 * Date sections: Today · Yesterday · This Week · Earlier
 * Realtime: Supabase INSERT subscription
 * Actions: mark read, delete (long-press), inline accept/decline for match requests
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { ErrorState } from "../components/ui/ErrorState";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../lib/theme";
import { useNotifications } from "../lib/notificationContext";
import { Icon } from "../components/Icon";

// ─── Types ────────────────────────────────────────────────────────────────────
type Notif = {
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

type Category = "all" | "matches" | "messages" | "sessions" | "circles";

const TABS: { key: Category; label: string }[] = [
  { key: "all",      label: "All" },
  { key: "matches",  label: "Matches" },
  { key: "messages", label: "Messages" },
  { key: "sessions", label: "Sessions" },
  { key: "circles",  label: "Circles" },
];

// ─── Notification type config ─────────────────────────────────────────────────
const TYPE_META: Record<string, { iconName: string; color: string; category: Category }> = {
  // Matches
  match_request:        { iconName: "matchActive",   color: "#6366F1", category: "matches" },
  match_accepted:       { iconName: "checkActive",   color: "#22C55E", category: "matches" },
  match_rejected:       { iconName: "close",         color: "#EF4444", category: "matches" },
  discover_suggestion:  { iconName: "matchActive",   color: "#6366F1", category: "matches" },

  // Messages
  message:              { iconName: "chatActive",    color: "#3B82F6", category: "messages" },
  new_message:          { iconName: "chatActive",    color: "#3B82F6", category: "messages" },

  // Sessions
  session_proposed:     { iconName: "calendar",      color: "#06B6D4", category: "sessions" },
  session_accepted:     { iconName: "checkActive",   color: "#22C55E", category: "sessions" },
  session_confirmed:    { iconName: "checkActive",   color: "#22C55E", category: "sessions" },
  session_declined:     { iconName: "close",         color: "#EF4444", category: "sessions" },
  session_cancelled:    { iconName: "close",         color: "#EF4444", category: "sessions" },
  session_reminder:     { iconName: "clock",         color: "#F59E0B", category: "sessions" },
  workout_invite:       { iconName: "gymActive",     color: "#06B6D4", category: "sessions" },
  streak_reminder:      { iconName: "streakActive",  color: "#F97316", category: "sessions" },
  streak_milestone:     { iconName: "streakActive",  color: "#F97316", category: "sessions" },

  // Circles
  circle_invite:        { iconName: "circlesActive", color: "#8B5CF6", category: "circles" },
  circle_joined:        { iconName: "circlesActive", color: "#8B5CF6", category: "circles" },
  circle_new_member:    { iconName: "circlesActive", color: "#8B5CF6", category: "circles" },
  circle_event:         { iconName: "calendar",      color: "#06B6D4", category: "circles" },

  // General (show under All)
  badge_unlocked:       { iconName: "notification",  color: "#F59E0B", category: "all" },
  goal_completed:       { iconName: "checkActive",   color: "#22C55E", category: "all" },
  goal_milestone:       { iconName: "gymActive",     color: "#6366F1", category: "all" },
  kudos:                { iconName: "matchActive",   color: "#F59E0B", category: "all" },
  leaderboard_moved:    { iconName: "streakActive",  color: "#F59E0B", category: "all" },
  tier_promoted:        { iconName: "streakActive",  color: "#60A5FA", category: "all" },
  partner_workout:      { iconName: "gymActive",     color: "#22C55E", category: "all" },
};

function getMeta(type: string | null) {
  if (!type) return { iconName: "notification", color: "#888", category: "all" as Category };
  return TYPE_META[type] ?? { iconName: "notification", color: "#888", category: "all" as Category };
}

function matchesTab(n: Notif, tab: Category): boolean {
  if (tab === "all") return true;
  const cat = getMeta(n.type).category;
  return cat === tab;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function sectionLabel(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7)  return "This Week";
  return "Earlier";
}

function deepLink(notif: Notif) {
  const t = notif.type ?? "";
  if ((t === "message" || t === "new_message") && notif.related_id) return router.push(`/chat/${notif.related_id}` as any);
  if (t === "match_request"     || t === "match_accepted" || t === "match_rejected" || t === "discover_suggestion")
    return router.push("/(tabs)/discover" as any);
  if (t === "session_proposed"  || t === "session_accepted" || t === "session_confirmed" || t === "session_declined" || t === "session_reminder" || t === "workout_invite")
    return router.push("/(tabs)/home" as any);
  if (t === "circle_invite"     || t === "circle_joined" || t === "circle_new_member" || t === "circle_event")
    return router.push("/(tabs)/circles" as any);
  if (t === "badge_unlocked"    || t === "kudos" || t === "leaderboard_moved" || t === "tier_promoted")
    return router.push("/(tabs)/profile" as any);
  if (t === "goal_completed"    || t === "goal_milestone" || t === "streak_reminder" || t === "streak_milestone")
    return router.push("/(tabs)/goals" as any);
}

const EMPTY: Record<Category, { iconName: string; title: string; sub: string }> = {
  all:      { iconName: "notification",  title: "All caught up",          sub: "New activity will appear here" },
  matches:  { iconName: "matchActive",   title: "No match activity",      sub: "Start swiping to find partners" },
  messages: { iconName: "chatActive",    title: "No message alerts",      sub: "Your conversations are quiet" },
  sessions: { iconName: "calendar",      title: "No session activity",    sub: "Propose a session with a match" },
  circles:  { iconName: "circlesActive", title: "No circle activity",     sub: "Join a circle to see updates" },
};

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { refresh: refreshBadge } = useNotifications();

  const [notifs,     setNotifs]     = useState<Notif[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userId,     setUserId]     = useState<string | null>(null);
  const [tab,        setTab]        = useState<Category>("all");
  const [marking,    setMarking]    = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async (uid?: string, isRefresh = false) => {
    try {
      setError(false);
      if (!isRefresh) setLoading(true);
      const id = uid ?? userId;
      if (!id) return;
      const { data, error: queryError } = await supabase
        .from("notifications")
        .select("id, type, title, body, message, read, created_at, related_id, url")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (queryError) throw queryError;
      console.log("[Notifications] loaded", (data ?? []).length, "rows");
      setNotifs(data ?? []);
    } catch (err) {
      console.error("[Notifications] load failed:", err);
      if (isRefresh) {
        Alert.alert("Error", "Could not refresh. Please try again.");
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      load(user.id);
      channelRef.current = supabase
        .channel(`notifs-${user.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
          setNotifs(prev => [payload.new as Notif, ...prev]);
          refreshBadge();
        })
        .subscribe();
    });
    return () => { channelRef.current?.unsubscribe(); };
  }, [load, refreshBadge]);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => { setLoading(false); setError(true); }, 15_000);
    return () => clearTimeout(t);
  }, [loading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(undefined, true);
    setRefreshing(false);
  }, [load]);

  async function markAllRead() {
    if (!userId || marking) return;
    setMarking(true);
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    refreshBadge();
    setMarking(false);
  }

  async function deleteNotif(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifs(prev => prev.filter(n => n.id !== id));
    refreshBadge();
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    refreshBadge();
  }

  async function acceptMatch(relatedId: string, notifId: string) {
    await supabase.from("matches").update({ status: "accepted" }).eq("id", relatedId);
    await markRead(notifId);
    router.push(`/chat/${relatedId}` as any);
  }

  async function declineMatch(relatedId: string, notifId: string) {
    await supabase.from("matches").update({ status: "rejected" }).eq("id", relatedId);
    await markRead(notifId);
  }

  function handlePress(notif: Notif) {
    if (!notif.read) markRead(notif.id);
    deepLink(notif);
  }

  function handleLongPress(notif: Notif) {
    Alert.alert("Remove", "Remove this notification?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteNotif(notif.id) },
    ]);
  }

  // ── Build list ───────────────────────────────────────────────────────────────
  const filtered    = notifs.filter(n => matchesTab(n, tab));
  const unreadCount = notifs.filter(n => !n.read).length;
  const ORDER       = ["Today", "Yesterday", "This Week", "Earlier"];

  const sectionMap: Record<string, Notif[]> = {};
  for (const n of filtered) {
    const lbl = sectionLabel(n.created_at);
    if (!sectionMap[lbl]) sectionMap[lbl] = [];
    sectionMap[lbl].push(n);
  }

  type ListItem = { type: "header"; label: string } | { type: "notif"; notif: Notif };
  const flatData: ListItem[] = [];
  for (const lbl of ORDER) {
    if (sectionMap[lbl]) {
      flatData.push({ type: "header", label: lbl });
      sectionMap[lbl].forEach(n => flatData.push({ type: "notif", notif: n }));
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.brand} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <ErrorState onRetry={() => load()} message="Could not load notifications." />
      </SafeAreaView>
    );
  }

  const empty = EMPTY[tab];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>

      {/* ── Header ── */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={10}>
          <Icon name="back" size={22} color={c.textSecondary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: c.text }]}>
          Notifications{unreadCount > 0 ? ` · ${unreadCount}` : ""}
        </Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} disabled={marking} style={s.markBtn}>
            {marking
              ? <ActivityIndicator size="small" color={c.brand} />
              : <Text style={[s.markBtnText, { color: c.brand }]}>Mark read</Text>
            }
          </TouchableOpacity>
        ) : (
          <View style={{ width: 72 }} />
        )}
      </View>

      {/* ── Tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabsRow}
        style={[s.tabsWrap, { borderBottomColor: c.border }]}
      >
        {TABS.map(t => {
          const active = tab === t.key;
          const count  = t.key === "all" ? notifs.length : notifs.filter(n => matchesTab(n, t.key)).length;
          return (
            <TouchableOpacity
              key={t.key}
              style={[s.tab, active && { backgroundColor: c.brand, borderColor: c.brand }, !active && { borderColor: c.border }]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[s.tabText, { color: active ? "#fff" : c.textMuted }]}>{t.label}</Text>
              {count > 0 && !active && (
                <View style={[s.tabBadge, { backgroundColor: c.bgCardAlt }]}>
                  <Text style={[s.tabBadgeText, { color: c.textMuted }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── List ── */}
      {flatData.length === 0 ? (
        <View style={s.empty}>
          <Icon name={empty.iconName as any} size={52} color={c.textMuted} />
          <Text style={[s.emptyTitle, { color: c.text }]}>{empty.title}</Text>
          <Text style={[s.emptySub, { color: c.textMuted }]}>{empty.sub}</Text>
          {tab === "matches" && (
            <TouchableOpacity style={[s.emptyCTA, { backgroundColor: c.brand }]}
              onPress={() => { router.back(); router.push("/(tabs)/discover" as any); }}>
              <Text style={s.emptyCTAText}>Go to Discover →</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item, i) => item.type === "header" ? `h-${item.label}` : `n-${item.notif.id}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: SPACE[60] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} />}
          renderItem={({ item }) => {
            if (item.type === "header") {
              return (
                <Text style={[s.sectionLabel, { color: c.textMuted }]}>{item.label}</Text>
              );
            }

            const { notif } = item;
            const meta = getMeta(notif.type);
            const text = notif.title ?? "";
            const sub  = notif.body ?? notif.message ?? "";

            return (
              <TouchableOpacity
                style={[s.row, { borderBottomColor: c.border }]}
                onPress={() => handlePress(notif)}
                onLongPress={() => handleLongPress(notif)}
                activeOpacity={0.7}
              >
                {/* Icon */}
                <View style={[s.iconWrap, { backgroundColor: meta.color + "18" }]}>
                  <Icon name={meta.iconName as any} size={20} color={meta.color} />
                </View>

                {/* Content */}
                <View style={s.content}>
                  <Text
                    style={[s.rowText, { color: c.text }, !notif.read && s.rowTextUnread]}
                    numberOfLines={2}
                  >
                    {text}
                  </Text>
                  {!!sub && (
                    <Text style={[s.rowSub, { color: c.textMuted }]} numberOfLines={1}>{sub}</Text>
                  )}

                  {/* Inline accept/decline for match requests */}
                  {notif.type === "match_request" && notif.related_id && !notif.read && (
                    <View style={s.actionRow}>
                      <TouchableOpacity
                        style={[s.acceptBtn, { backgroundColor: c.brand }]}
                        onPress={() => acceptMatch(notif.related_id!, notif.id)}
                      >
                        <Text style={s.acceptText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.declineBtn, { borderColor: c.border }]}
                        onPress={() => declineMatch(notif.related_id!, notif.id)}
                      >
                        <Text style={[s.declineText, { color: c.textMuted }]}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Time + unread dot */}
                <View style={s.meta}>
                  <Text style={[s.time, { color: c.textMuted }]}>{timeAgo(notif.created_at)}</Text>
                  {!notif.read && <View style={[s.dot, { backgroundColor: c.brand }]} />}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                 paddingHorizontal: SPACE[16], paddingVertical: SPACE[14], borderBottomWidth: 1 },
  backBtn:     { width: 36, alignItems: "flex-start" },
  title:       { fontSize: FONT.size.lg, fontWeight: FONT.weight.black, flex: 1, textAlign: "center" },
  markBtn:     { width: 72, alignItems: "flex-end" },
  markBtnText: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold },

  // Tabs
  tabsWrap:    { flexGrow: 0, borderBottomWidth: 1 },
  tabsRow:     { paddingHorizontal: SPACE[16], paddingVertical: SPACE[10], gap: SPACE[8] },
  tab:         { flexDirection: "row", alignItems: "center", gap: SPACE[4],
                 paddingHorizontal: SPACE[14], paddingVertical: SPACE[7],
                 borderRadius: RADIUS.pill, borderWidth: 1 },
  tabText:     { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  tabBadge:    { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[6], paddingVertical: 1, minWidth: 18, alignItems: "center" },
  tabBadgeText:{ fontSize: 10, fontWeight: FONT.weight.bold },

  // Section label
  sectionLabel: { fontSize: 11, fontWeight: FONT.weight.bold, letterSpacing: 0.5,
                  textTransform: "uppercase", paddingHorizontal: SPACE[16],
                  paddingTop: SPACE[14], paddingBottom: SPACE[4] },

  // Row
  row:     { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: SPACE[16],
             paddingVertical: SPACE[14], gap: SPACE[12], borderBottomWidth: StyleSheet.hairlineWidth },
  iconWrap:{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  content: { flex: 1, gap: 3 },
  rowText: { fontSize: FONT.size.base, lineHeight: 20 },
  rowTextUnread: { fontWeight: FONT.weight.bold },
  rowSub:  { fontSize: FONT.size.sm },
  meta:    { alignItems: "flex-end", gap: SPACE[6], flexShrink: 0 },
  time:    { fontSize: 11 },
  dot:     { width: 8, height: 8, borderRadius: 4 },

  // Inline actions
  actionRow:   { flexDirection: "row", gap: SPACE[8], marginTop: SPACE[8] },
  acceptBtn:   { paddingHorizontal: SPACE[14], paddingVertical: SPACE[6], borderRadius: RADIUS.md },
  acceptText:  { color: "#fff", fontSize: FONT.size.sm, fontWeight: FONT.weight.extrabold },
  declineBtn:  { paddingHorizontal: SPACE[14], paddingVertical: SPACE[6], borderRadius: RADIUS.md, borderWidth: 1 },
  declineText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },

  // Empty
  empty:       { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE[10], padding: SPACE[40] },
  emptyTitle:  { fontSize: FONT.size.xl, fontWeight: FONT.weight.black, textAlign: "center" },
  emptySub:    { fontSize: FONT.size.base, textAlign: "center", lineHeight: 22 },
  emptyCTA:    { marginTop: SPACE[8], paddingHorizontal: SPACE[28], paddingVertical: SPACE[14], borderRadius: RADIUS.xl },
  emptyCTAText:{ color: "#fff", fontWeight: FONT.weight.extrabold, fontSize: FONT.size.md },
});
