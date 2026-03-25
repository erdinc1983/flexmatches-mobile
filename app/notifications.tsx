/**
 * Notifications Screen — 10/10 UX
 *
 * Features:
 *  - Full theme support (dark/light)
 *  - Category tabs: All · Unread · Matches · Messages · Social · Reminders
 *  - Date section headers: Today · Yesterday · This Week · Earlier
 *  - Rich rows: colored icon circle + title + subtitle + timestamp + unread dot
 *  - Inline Accept / Decline for match_request rows
 *  - Real-time Supabase subscription — new rows appear instantly
 *  - "Mark all read" button
 *  - Swipe-friendly long-press delete per row
 *  - Deep link for every notification type
 *  - Unread count badge in header
 *  - Empty state with motivational CTA per tab
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../lib/theme";
import { useNotifications } from "../lib/notificationContext";

// ─── Types ────────────────────────────────────────────────────────────────────
type Notif = {
  id:         string;
  type:       string | null;
  title:      string | null;
  body:       string | null;
  message:    string | null;  // legacy field
  read:       boolean;
  created_at: string;
  related_id: string | null;
  url:        string | null;
};

type Category = "all" | "unread" | "matches" | "messages" | "social" | "reminders";

// ─── Config ───────────────────────────────────────────────────────────────────
const CATEGORY_TABS: { key: Category; label: string }[] = [
  { key: "all",       label: "All" },
  { key: "unread",    label: "Unread" },
  { key: "matches",   label: "Matches" },
  { key: "messages",  label: "Messages" },
  { key: "social",    label: "Social" },
  { key: "reminders", label: "Reminders" },
];

const TYPE_META: Record<string, { emoji: string; color: string; title: string; category: Category }> = {
  match_request:        { emoji: "🤝", color: "#6366f1", title: "Match Request",       category: "matches" },
  match_accepted:       { emoji: "✅", color: PALETTE.success, title: "Match Accepted", category: "matches" },
  match_rejected:       { emoji: "❌", color: PALETTE.error,   title: "Match Declined", category: "matches" },
  new_message:          { emoji: "💬", color: "#3b82f6",       title: "New Message",    category: "messages" },
  badge_unlocked:       { emoji: "🏆", color: "#f59e0b",       title: "Badge Unlocked", category: "social" },
  streak_reminder:      { emoji: "🔥", color: "#f97316",       title: "Streak Reminder",category: "reminders" },
  streak_milestone:     { emoji: "🔥", color: "#f97316",       title: "Streak Milestone",category: "social" },
  goal_completed:       { emoji: "🎯", color: PALETTE.success, title: "Goal Completed", category: "social" },
  goal_milestone:       { emoji: "💪", color: "#6366f1",       title: "Goal Milestone", category: "social" },
  workout_invite:       { emoji: "📅", color: "#06b6d4",       title: "Workout Invite", category: "reminders" },
  session_proposed:     { emoji: "📅", color: "#06b6d4",       title: "Session Proposed",category: "reminders" },
  session_confirmed:    { emoji: "🤜", color: PALETTE.success, title: "Session Confirmed",category: "reminders" },
  circle_invite:        { emoji: "⭕", color: "#8b5cf6",       title: "Circle Invite",  category: "reminders" },
  circle_joined:        { emoji: "⭕", color: "#8b5cf6",       title: "Circle Update",  category: "social" },
  circle_event:         { emoji: "📆", color: "#06b6d4",       title: "Circle Event",   category: "reminders" },
  kudos:                { emoji: "👏", color: "#f59e0b",       title: "Kudos",          category: "social" },
  leaderboard_moved:    { emoji: "🏅", color: "#f59e0b",       title: "Leaderboard",    category: "social" },
  tier_promoted:        { emoji: "💎", color: "#60a5fa",       title: "Tier Promoted",  category: "social" },
};

const MATCH_TYPES: Category = "matches";
const MSG_TYPES:   Category = "messages";

function getMeta(type: string | null) {
  if (!type) return { emoji: "🔔", color: "#888", title: "Notification", category: "all" as Category };
  return TYPE_META[type] ?? { emoji: "🔔", color: "#888", title: type.replace(/_/g, " "), category: "all" as Category };
}

function matchesCategory(notif: Notif, cat: Category): boolean {
  if (cat === "all")    return true;
  if (cat === "unread") return !notif.read;
  const meta = getMeta(notif.type);
  return meta.category === cat;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function sectionLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7)  return "This Week";
  return "Earlier";
}

function getDisplayText(n: Notif): { title: string; body: string } {
  const meta = getMeta(n.type);
  const title = n.title ?? meta.title;
  const body  = n.body ?? n.message ?? "";
  return { title, body };
}

function deepLink(notif: Notif) {
  const t = notif.type ?? "";
  if (t === "new_message"    && notif.related_id) return router.push(`/chat/${notif.related_id}`);
  if (t === "match_request"  || t === "match_accepted" || t === "match_rejected")
    return router.push("/(tabs)/home");
  if (t === "badge_unlocked" || t === "goal_completed" || t === "goal_milestone" || t === "streak_milestone")
    return router.push("/(tabs)/goals");
  if (t === "circle_invite"  || t === "circle_joined" || t === "circle_event")
    return router.push("/(tabs)/circles");
  if (t === "kudos"          || t === "leaderboard_moved" || t === "tier_promoted")
    return router.push("/(tabs)/profile");
  if (t === "session_proposed" || t === "session_confirmed")
    return router.push("/(tabs)/home");
  if (notif.url) {
    // Map web URLs to mobile routes
    const url = notif.url;
    if (url.includes("goals"))    return router.push("/(tabs)/goals");
    if (url.includes("circles"))  return router.push("/(tabs)/circles");
    if (url.includes("profile"))  return router.push("/(tabs)/profile");
    if (url.includes("discover")) return router.push("/(tabs)/discover");
  }
}

const EMPTY_STATES: Record<Category, { emoji: string; title: string; sub: string }> = {
  all:       { emoji: "🔔", title: "You're all caught up",     sub: "New activity will appear here" },
  unread:    { emoji: "✅", title: "Nothing unread",           sub: "You've seen everything" },
  matches:   { emoji: "🤝", title: "No match activity yet",    sub: "Start swiping to find training partners" },
  messages:  { emoji: "💬", title: "No message notifications", sub: "Your conversations are quiet" },
  social:    { emoji: "🏆", title: "No social activity yet",   sub: "Log workouts and earn badges!" },
  reminders: { emoji: "📅", title: "No reminders",             sub: "Upcoming events will appear here" },
};

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const { theme }    = useTheme();
  const c            = theme.colors;
  const { refresh: refreshBadge } = useNotifications();

  const [notifs,     setNotifs]     = useState<Notif[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId,     setUserId]     = useState<string | null>(null);
  const [category,   setCategory]   = useState<Category>("all");
  const [marking,    setMarking]    = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async (uid?: string) => {
    const id = uid ?? userId;
    if (!id) return;

    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, message, read, created_at, related_id, url")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(80);

    setNotifs(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      load(user.id);

      // Real-time subscription
      channelRef.current = supabase
        .channel(`notifs-screen-${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          (payload) => {
            setNotifs(prev => [payload.new as Notif, ...prev]);
            refreshBadge();
          },
        )
        .subscribe();
    });

    return () => { channelRef.current?.unsubscribe(); };
  }, [load, refreshBadge]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Actions ───────────────────────────────────────────────────────────────
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
    router.push(`/chat/${relatedId}`);
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
    Alert.alert(
      "Remove Notification",
      "Remove this notification from your list?",
      [
        { text: "Cancel",  style: "cancel" },
        { text: "Remove",  style: "destructive", onPress: () => deleteNotif(notif.id) },
      ],
    );
  }

  // ── Filter & group ────────────────────────────────────────────────────────
  const filtered = notifs.filter(n => matchesCategory(n, category));
  const unreadCount = notifs.filter(n => !n.read).length;

  // Group into date sections
  type Section = { label: string; data: Notif[] };
  const sections: Section[] = [];
  const sectionMap: Record<string, Notif[]> = {};
  const ORDER = ["Today", "Yesterday", "This Week", "Earlier"];

  for (const n of filtered) {
    const lbl = sectionLabel(n.created_at);
    if (!sectionMap[lbl]) sectionMap[lbl] = [];
    sectionMap[lbl].push(n);
  }
  for (const lbl of ORDER) {
    if (sectionMap[lbl]) sections.push({ label: lbl, data: sectionMap[lbl] });
  }

  // Flatten for FlatList with section header items
  type ListItem = { type: "header"; label: string } | { type: "notif"; notif: Notif };
  const flatData: ListItem[] = [];
  for (const sec of sections) {
    flatData.push({ type: "header", label: sec.label });
    for (const n of sec.data) flatData.push({ type: "notif", notif: n });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.brand} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const empty = EMPTY_STATES[category];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      {/* ── Header ── */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[s.backText, { color: c.brand }]}>←</Text>
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={[s.title, { color: c.text }]}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={[s.headerBadge, { backgroundColor: c.brand }]}>
              <Text style={s.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 ? (
          <TouchableOpacity style={s.markBtn} onPress={markAllRead} disabled={marking}>
            {marking
              ? <ActivityIndicator size="small" color={c.brand} />
              : <Text style={[s.markBtnText, { color: c.brand }]}>Mark all read</Text>
            }
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {/* ── Category tabs ── */}
      <FlatList
        horizontal
        data={CATEGORY_TABS}
        keyExtractor={t => t.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabsRow}
        renderItem={({ item: tab }) => {
          const active = category === tab.key;
          // Show unread count on "Unread" tab
          const count = tab.key === "unread" ? unreadCount
            : tab.key === "all" ? notifs.length
            : notifs.filter(n => matchesCategory(n, tab.key)).length;
          return (
            <TouchableOpacity
              style={[s.tab, active && { backgroundColor: c.brand, borderColor: c.brand }, { borderColor: c.border }]}
              onPress={() => setCategory(tab.key)}
            >
              <Text style={[s.tabText, { color: active ? "#fff" : c.textMuted }]}>{tab.label}</Text>
              {count > 0 && (
                <View style={[s.tabCount, { backgroundColor: active ? "#ffffff33" : c.bgCardAlt }]}>
                  <Text style={[s.tabCountText, { color: active ? "#fff" : c.textMuted }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* ── List ── */}
      {flatData.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>{empty.emoji}</Text>
          <Text style={[s.emptyTitle, { color: c.text }]}>{empty.title}</Text>
          <Text style={[s.emptyText, { color: c.textMuted }]}>{empty.sub}</Text>
          {category === "matches" && (
            <TouchableOpacity
              style={[s.emptyCTA, { backgroundColor: c.brand }]}
              onPress={() => { router.back(); router.push("/(tabs)/discover"); }}
            >
              <Text style={s.emptyCTAText}>Start Swiping →</Text>
            </TouchableOpacity>
          )}
          {category === "social" && (
            <TouchableOpacity
              style={[s.emptyCTA, { backgroundColor: c.brand }]}
              onPress={() => { router.back(); router.push("/(tabs)/activity"); }}
            >
              <Text style={s.emptyCTAText}>Log a Workout →</Text>
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
                <View style={[s.sectionHeader, { backgroundColor: c.bg }]}>
                  <Text style={[s.sectionLabel, { color: c.textMuted }]}>{item.label}</Text>
                </View>
              );
            }

            const { notif } = item;
            const meta = getMeta(notif.type);
            const { title, body } = getDisplayText(notif);
            const isMatchRequest = notif.type === "match_request";

            return (
              <TouchableOpacity
                style={[s.row, { borderBottomColor: c.border }, !notif.read && { backgroundColor: c.brand + "08" }]}
                onPress={() => handlePress(notif)}
                onLongPress={() => handleLongPress(notif)}
                activeOpacity={0.75}
              >
                {/* Icon circle */}
                <View style={[s.iconCircle, { backgroundColor: meta.color + "1a", borderColor: meta.color + "44" }]}>
                  <Text style={s.iconEmoji}>{meta.emoji}</Text>
                </View>

                {/* Content */}
                <View style={s.rowContent}>
                  <View style={s.rowTop}>
                    <Text style={[s.rowTitle, { color: c.text }, !notif.read && { fontWeight: FONT.weight.extrabold }]} numberOfLines={1}>
                      {title}
                    </Text>
                    <Text style={[s.rowTime, { color: c.textMuted }]}>{timeAgo(notif.created_at)}</Text>
                  </View>

                  {!!body && (
                    <Text style={[s.rowBody, { color: notif.read ? c.textMuted : c.textSecondary }]} numberOfLines={2}>
                      {body}
                    </Text>
                  )}

                  {/* Inline actions for match requests */}
                  {isMatchRequest && notif.related_id && notif.read === false && (
                    <View style={s.actionRow}>
                      <TouchableOpacity
                        style={[s.actionBtn, { backgroundColor: c.brand }]}
                        onPress={() => acceptMatch(notif.related_id!, notif.id)}
                      >
                        <Text style={s.actionBtnText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.actionBtnOutline, { borderColor: c.border }]}
                        onPress={() => declineMatch(notif.related_id!, notif.id)}
                      >
                        <Text style={[s.actionBtnOutlineText, { color: c.textMuted }]}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Unread dot */}
                {!notif.read && <View style={[s.unreadDot, { backgroundColor: c.brand }]} />}
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
  header:          { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE[16], paddingVertical: SPACE[14], borderBottomWidth: 1 },
  backBtn:         { width: 36, alignItems: "flex-start" },
  backText:        { fontSize: 22, fontWeight: FONT.weight.bold },
  headerCenter:    { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACE[8] },
  title:           { fontSize: FONT.size.xl, fontWeight: FONT.weight.black, letterSpacing: -0.5 },
  headerBadge:     { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[8], paddingVertical: 2, minWidth: 22, alignItems: "center" },
  headerBadgeText: { color: "#fff", fontSize: 11, fontWeight: FONT.weight.extrabold },
  markBtn:         { width: 80, alignItems: "flex-end" },
  markBtnText:     { fontSize: 12, fontWeight: FONT.weight.bold },

  // Category tabs
  tabsRow: { paddingHorizontal: SPACE[16], paddingVertical: SPACE[12], gap: SPACE[8] },
  tab:       { flexDirection: "row", alignItems: "center", gap: SPACE[4], paddingHorizontal: SPACE[12], paddingVertical: SPACE[8], borderRadius: RADIUS.pill, borderWidth: 1 },
  tabText:   { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  tabCount:  { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[6], paddingVertical: 1, minWidth: 18, alignItems: "center" },
  tabCountText: { fontSize: 10, fontWeight: FONT.weight.extrabold },

  // Section header
  sectionHeader: { paddingHorizontal: SPACE[16], paddingTop: SPACE[16], paddingBottom: SPACE[6] },
  sectionLabel:  { fontSize: 11, fontWeight: FONT.weight.extrabold, letterSpacing: 0.8, textTransform: "uppercase" },

  // Row
  row:        { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: SPACE[16], paddingVertical: SPACE[14], gap: SPACE[12], borderBottomWidth: 1 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, flexShrink: 0 },
  iconEmoji:  { fontSize: 22 },
  rowContent: { flex: 1, gap: SPACE[4] },
  rowTop:     { flexDirection: "row", alignItems: "flex-start", gap: SPACE[8] },
  rowTitle:   { flex: 1, fontSize: FONT.size.base, fontWeight: FONT.weight.semibold },
  rowTime:    { fontSize: 11, marginTop: 2, flexShrink: 0 },
  rowBody:    { fontSize: FONT.size.sm, lineHeight: 18 },
  unreadDot:  { width: 8, height: 8, borderRadius: 4, marginTop: SPACE[6], flexShrink: 0 },

  // Inline actions
  actionRow:         { flexDirection: "row", gap: SPACE[8], marginTop: SPACE[8] },
  actionBtn:         { paddingHorizontal: SPACE[16], paddingVertical: SPACE[8], borderRadius: RADIUS.md },
  actionBtnText:     { color: "#fff", fontSize: FONT.size.sm, fontWeight: FONT.weight.extrabold },
  actionBtnOutline:  { paddingHorizontal: SPACE[16], paddingVertical: SPACE[8], borderRadius: RADIUS.md, borderWidth: 1 },
  actionBtnOutlineText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },

  // Empty state
  empty:        { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE[10], padding: SPACE[40] },
  emptyEmoji:   { fontSize: 56 },
  emptyTitle:   { fontSize: FONT.size.xl, fontWeight: FONT.weight.black, textAlign: "center" },
  emptyText:    { fontSize: FONT.size.base, textAlign: "center", lineHeight: 22 },
  emptyCTA:     { marginTop: SPACE[8], paddingHorizontal: SPACE[28], paddingVertical: SPACE[14], borderRadius: RADIUS.xl },
  emptyCTAText: { color: "#fff", fontWeight: FONT.weight.extrabold, fontSize: FONT.size.md },
});
