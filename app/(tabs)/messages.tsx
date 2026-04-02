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
import { ErrorState } from "../../components/ui/ErrorState";
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { requestNotificationPermission } from "../../lib/notifications";
import { useTheme, SPACE, FONT } from "../../lib/theme";
import { EmptyState } from "../../components/ui/EmptyState";
import { MessagesSkeleton } from "../../components/ui/Skeleton";
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
  const [error,         setError]         = useState(false);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => { setLoading(false); setError(true); }, 15_000);
    return () => clearTimeout(t);
  }, [loading]);

  const [refreshing,    setRefreshing]    = useState(false);
  const [saved,         setSaved]         = useState<Set<string>>(new Set());

  const myIdRef           = useRef<string | null>(null);
  const conversationsRef  = useRef<Conversation[]>([]);
  const lastLoadRef       = useRef(0);
  const STALE_MS          = 15_000; // refetch after 15s

  const load = useCallback(async (isRefresh = false) => {
    try {
      setError(false);
      if (!isRefresh) setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);
      myIdRef.current = user.id;

      // Single RPC replaces N×3 queries — LATERAL joins return everything in one round-trip
      const { data: rows, error: rpcError } = await supabase
        .rpc("get_inbox", { p_user_id: user.id });

      if (rpcError) throw rpcError;
      if (!rows || rows.length === 0) { setConversations([]); conversationsRef.current = []; return; }

      const convos: Conversation[] = (rows as any[]).map((row) => ({
        matchId:       row.match_id,
        userId:        row.other_user_id,
        name:          row.other_full_name ?? row.other_username,
        username:      row.other_username,
        avatarUrl:     row.other_avatar_url ?? null,
        lastMessage:   row.last_message ?? null,
        lastMessageAt: row.last_message_at ?? null,
        unreadCount:   Number(row.unread_count ?? 0),
        session:       row.session_id ? {
          id:          row.session_id,
          match_id:    row.match_id,
          proposer_id: row.session_proposer_id,
          receiver_id: row.session_receiver_id,
          sport:       row.session_sport,
          session_date: row.session_date,
          session_time: row.session_time,
          location:    row.session_location,
          notes:       row.session_notes,
          status:      row.session_status,
        } as BuddySession : null,
      }));

      // Sort: action-needed → unread → recency (RPC already orders by updated_at,
      // but we need the action/unread priority on top)
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
      lastLoadRef.current = Date.now();
    } catch (err) {
      console.error("[Messages] load failed:", err);
      if (isRefresh) {
        Alert.alert("Error", "Could not refresh. Please try again.");
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const elapsed = Date.now() - lastLoadRef.current;
    if (elapsed > STALE_MS || conversations.length === 0) {
      load();
    }
    requestNotificationPermission();
  }, [load, conversations.length]));

  useEffect(() => {
    const channel = supabase
      .channel("chat-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as { sender_id: string; match_id: string; content: string; created_at: string };
        const isIncoming = myIdRef.current && msg.sender_id !== myIdRef.current;

        // Sound + local notification is handled by NotificationContext (single source)
        // This handler only updates the conversation list UI

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
    await load(true);
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
    try {
      const { error } = await supabase.from("messages").delete().eq("match_id", matchId);
      if (error) throw error;
      setConversations((prev) => prev.map((c) =>
        c.matchId !== matchId ? c : { ...c, lastMessage: null, lastMessageAt: null, unreadCount: 0 }
      ));
    } catch {
      Alert.alert("Error", "Could not delete messages. Please try again.");
    }
  }

  async function handleUnmatch(matchId: string) {
    try {
      const { error: msgError } = await supabase.from("messages").delete().eq("match_id", matchId);
      if (msgError) throw msgError;
      const { error: matchError } = await supabase.from("matches").update({ status: "unmatched" }).eq("id", matchId);
      if (matchError) throw matchError;
      setConversations((prev) => prev.filter((c) => c.matchId !== matchId));
      setSaved((prev) => { const n = new Set(prev); n.delete(matchId); return n; });
    } catch {
      Alert.alert("Error", "Could not unmatch. Please try again.");
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <MessagesSkeleton />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <ErrorState onRetry={load} message="Could not load conversations." />
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.matchId}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} />}
          ListHeaderComponent={
            <View style={s.header}>
              <Text style={[s.title, { color: c.text }]}>Chat</Text>
              {conversations.length > 0 && (
                <Text style={[s.subtitle, { color: c.textMuted }]}>{conversations.length} conversation{conversations.length !== 1 ? "s" : ""}</Text>
              )}
            </View>
          }
          ItemSeparatorComponent={() => (
            <View style={[s.separator, { backgroundColor: c.border }]} />
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
  root:         { flex: 1 },
  header:       { paddingHorizontal: SPACE[20], paddingTop: SPACE[20], paddingBottom: SPACE[12] },
  title:        { fontSize: 34, fontWeight: "700", letterSpacing: 0.37 },
  subtitle:     { fontSize: 13, marginTop: 2 },
  // Separator starts after: dotCol(20) + gap(0) + avatar(50) + gap(12) = 82px
  separator:    { height: StyleSheet.hairlineWidth, marginLeft: 82 },
  emptyWrapper: { paddingTop: 80 },
});
