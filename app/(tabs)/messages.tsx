/**
 * Chat Inbox
 *
 * Lists all accepted-match conversations, ordered by coordination urgency:
 *   1. Conversations with a session needing my response (pending_theirs)
 *   2. Conversations with unread messages
 *   3. Everything else by recency
 *
 * Swipe actions on each row:
 *   Save · Delete messages · Unmatch
 *
 * Real-time: Supabase Realtime channel refreshes the list on new messages.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl, Vibration,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { notifyNewMessage, requestNotificationPermission } from "../../lib/notifications";
import { useTheme, SPACE, FONT } from "../../lib/theme";
import { EmptyState } from "../../components/ui/EmptyState";
import { ConversationRow } from "../../components/chat/ConversationRow";
import type { BuddySession } from "../../components/chat/SessionBanner";

// ─── Types ────────────────────────────────────────────────────────────────────
type Conversation = {
  matchId:       string;
  userId:        string;
  name:          string;
  username:      string;
  avatarUrl:     string | null;
  lastMessage:   string | null;
  lastMessageAt: string | null;
  unreadCount:   number;
  session:       BuddySession | null;
};

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function MessagesScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [myId,          setMyId]          = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [saved,         setSaved]         = useState<Set<string>>(new Set());

  const myIdRef           = useRef<string | null>(null);
  const conversationsRef  = useRef<Conversation[]>([]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);
    myIdRef.current = user.id;

    const { data: matches } = await supabase
      .from("matches")
      .select("id, sender_id, receiver_id, updated_at")
      .eq("status", "accepted")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("updated_at", { ascending: false });

    if (!matches || matches.length === 0) { setLoading(false); return; }

    const otherIds = matches.map((m: any) =>
      m.sender_id === user.id ? m.receiver_id : m.sender_id
    );
    const { data: userRows } = await supabase
      .from("users")
      .select("id, username, full_name, avatar_url")
      .in("id", otherIds);
    const userMap = new Map((userRows ?? []).map((u: any) => [u.id, u]));

    const convos: Conversation[] = await Promise.all(
      matches.map(async (m: any) => {
        const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        const other = userMap.get(otherId) ?? { id: otherId, username: "unknown", full_name: null };

        const [
          { data: lastMsg },
          { count: unread },
          { data: sessionData },
        ] = await Promise.all([
          supabase.from("messages")
            .select("content, created_at")
            .eq("match_id", m.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from("messages")
            .select("*", { count: "exact", head: true })
            .eq("match_id", m.id)
            .neq("sender_id", user.id)
            .is("read_at", null),
          supabase.from("buddy_sessions")
            .select("id, match_id, proposer_id, receiver_id, sport, session_date, session_time, location, notes, status")
            .eq("match_id", m.id)
            .neq("status", "declined")
            .order("session_date", { ascending: true })
            .limit(1)
            .maybeSingle(),
        ]);

        return {
          matchId:       m.id,
          userId:        otherId,
          name:          other.full_name ?? other.username,
          username:      other.username,
          avatarUrl:     other.avatar_url ?? null,
          lastMessage:   lastMsg?.content ?? null,
          lastMessageAt: lastMsg?.created_at ?? null,
          unreadCount:   unread ?? 0,
          session:       sessionData as BuddySession | null,
        };
      })
    );

    convos.sort((a, b) => {
      const aNeedsAction = a.session?.status === "pending" && a.session.receiver_id === user.id;
      const bNeedsAction = b.session?.status === "pending" && b.session.receiver_id === user.id;
      if (aNeedsAction && !bNeedsAction) return -1;
      if (!aNeedsAction && bNeedsAction) return 1;
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    setConversations(convos);
    conversationsRef.current = convos;
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    requestNotificationPermission();
  }, [load]));

  useEffect(() => {
    const channel = supabase
      .channel("chat-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as { sender_id: string; match_id: string; content: string; created_at: string };
        const isIncoming = myIdRef.current && msg.sender_id !== myIdRef.current;

        if (isIncoming) {
          Vibration.vibrate(300);
          const convo = conversationsRef.current.find((c) => c.matchId === msg.match_id);
          notifyNewMessage(convo?.name ?? "New message", msg.content);
        }

        const current = conversationsRef.current;
        if (current.length > 0 && current.some((c) => c.matchId === msg.match_id)) {
          const updated = current.map((c) => {
            if (c.matchId !== msg.match_id) return c;
            return {
              ...c,
              lastMessage:   msg.content,
              lastMessageAt: msg.created_at,
              unreadCount:   isIncoming ? c.unreadCount + 1 : c.unreadCount,
            };
          });
          updated.sort((a, b) => {
            if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
            if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
            if (!a.lastMessageAt) return 1;
            if (!b.lastMessageAt) return -1;
            return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
          });
          conversationsRef.current = updated;
          setConversations([...updated]);
        } else {
          load();
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Swipe action handlers ────────────────────────────────────────────────────
  function handleSave(matchId: string) {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  }

  async function handleDeleteMessages(matchId: string) {
    await supabase.from("messages").delete().eq("match_id", matchId);
    setConversations((prev) =>
      prev.map((c) =>
        c.matchId === matchId
          ? { ...c, lastMessage: null, lastMessageAt: null, unreadCount: 0 }
          : c
      )
    );
  }

  async function handleUnmatch(matchId: string) {
    await supabase.from("matches").delete().eq("id", matchId);
    setConversations((prev) => prev.filter((c) => c.matchId !== matchId));
    setSaved((prev) => { const n = new Set(prev); n.delete(matchId); return n; });
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.brand} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[s.root, { backgroundColor: "#fff" }]}>
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.matchId}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} />}
          ListHeaderComponent={
            <View style={s.header}>
              <Text style={s.title}>Chat</Text>
              {conversations.length > 0 && (
                <Text style={s.subtitle}>{conversations.length} conversation{conversations.length !== 1 ? "s" : ""}</Text>
              )}
            </View>
          }
          ItemSeparatorComponent={() => (
            <View style={s.separator} />
          )}
          renderItem={({ item }) => (
            <ConversationRow
              name={item.name}
              username={item.username}
              avatarUrl={item.avatarUrl}
              lastMessage={item.lastMessage}
              lastMessageAt={item.lastMessageAt}
              unreadCount={item.unreadCount}
              session={item.session}
              saved={saved.has(item.matchId)}
              myId={myId ?? ""}
              onPress={() => router.push(`/chat/${item.matchId}` as any)}
              onSave={() => handleSave(item.matchId)}
              onDeleteMessages={() => handleDeleteMessages(item.matchId)}
              onUnmatch={() => handleUnmatch(item.matchId)}
            />
          )}
          ListEmptyComponent={
            <View style={s.emptyWrapper}>
              <EmptyState
                icon="chatActive"
                title="No conversations yet"
                subtitle="Match with a training partner to start coordinating."
                action={{ label: "Go to Discover", onPress: () => router.push("/(tabs)/discover") }}
              />
            </View>
          }
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: "#fff" },
  header:       { paddingHorizontal: SPACE[20], paddingTop: SPACE[20], paddingBottom: SPACE[12] },
  title:        { fontSize: 34, fontWeight: "700", color: "#000", letterSpacing: 0.37 },
  subtitle:     { fontSize: 13, color: "#8E8E93", marginTop: 2 },
  // Separator starts after: dotCol(20) + gap(0) + avatar(50) + gap(12) = 82px
  separator:    { height: StyleSheet.hairlineWidth, backgroundColor: "#C6C6C8", marginLeft: 82 },
  emptyWrapper: { paddingTop: 80 },
});
