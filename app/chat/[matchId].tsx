/**
 * Chat — Individual Conversation
 *
 * Screen structure (top → bottom):
 *   1. Header       — back, partner identity (name + level badge), schedule action
 *   2. SessionBanner — active session state; accept/decline/confirm inline
 *   3. Message thread — date-grouped bubbles, real-time via Supabase Realtime
 *   4. Input row    — multiline text + send button
 *   5. Schedule sheet — bottom modal to propose a session
 *
 * Session actions happen inside the conversation — no tab switching required.
 * The message thread is always the primary focus; the banner is compact.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, ScrollView, TouchableWithoutFeedback, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useTheme, SPACE, FONT, RADIUS } from "../../lib/theme";
import { Icon } from "../../components/Icon";
import { SessionBanner } from "../../components/chat/SessionBanner";
import type { BuddySession } from "../../components/chat/SessionBanner";

// ─── Types ────────────────────────────────────────────────────────────────────
type Message = {
  id:         string;
  content:    string;
  sender_id:  string;
  created_at: string;
  read_at:    string | null;
};

type OtherUser = {
  id:            string;
  username:      string;
  full_name:     string | null;
  fitness_level: string | null;
};

type ListItem =
  | { type: "date"; label: string; key: string }
  | { type: "msg";  msg: Message };

// ─── Constants ────────────────────────────────────────────────────────────────
const LEVEL_COLOR: Record<string, string> = {
  beginner: "#22C55E", intermediate: "#F59E0B", advanced: "#FF4500",
};

const SPORTS = [
  "Gym", "Running", "Cycling", "Swimming", "Boxing",
  "Tennis", "Basketball", "Yoga", "CrossFit", "Hiking", "Other",
];

const { height: SCREEN_H } = Dimensions.get("window");

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { matchId }       = useLocalSearchParams<{ matchId: string }>();
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const [messages,        setMessages]        = useState<Message[]>([]);
  const [userId,          setUserId]          = useState<string | null>(null);
  const [other,           setOther]           = useState<OtherUser | null>(null);
  const [session,         setSession]         = useState<BuddySession | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [text,            setText]            = useState("");
  const [sending,         setSending]         = useState(false);

  // Schedule sheet state
  const [showSchedule,    setShowSchedule]    = useState(false);
  const [sessionSport,    setSessionSport]    = useState("Gym");
  const [sessionDate,     setSessionDate]     = useState("");
  const [sessionTime,     setSessionTime]     = useState("");
  const [sessionLocation, setSessionLocation] = useState("");
  const [proposing,       setProposing]       = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // ── Init & subscriptions ──────────────────────────────────────────────────
  useEffect(() => {
    init();

    const msgChannel = supabase
      .channel(`chat-msgs:${matchId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `match_id=eq.${matchId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
      })
      .subscribe();

    const sessionChannel = supabase
      .channel(`chat-sessions:${matchId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "buddy_sessions",
        filter: `match_id=eq.${matchId}`,
      }, () => loadSession())
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, [matchId]);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [{ data: match }, { data: msgs }] = await Promise.all([
      supabase.from("matches")
        .select(`
          sender_id, receiver_id,
          sender:users!matches_sender_id_fkey(id, username, full_name, fitness_level),
          receiver:users!matches_receiver_id_fkey(id, username, full_name, fitness_level)
        `)
        .eq("id", matchId)
        .single(),
      supabase.from("messages")
        .select("id, content, sender_id, created_at, read_at")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true }),
    ]);

    if (match) {
      const o = (match as any).sender_id === user.id
        ? (match as any).receiver
        : (match as any).sender;
      setOther(o);
    }

    setMessages(msgs ?? []);
    setLoading(false);

    // Mark incoming messages as read
    supabase.from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("match_id", matchId)
      .neq("sender_id", user.id)
      .is("read_at", null)
      .then(() => {});

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);

    loadSession();
  }

  const loadSession = useCallback(async () => {
    const { data } = await supabase
      .from("buddy_sessions")
      .select("id, match_id, proposer_id, receiver_id, sport, session_date, session_time, location, notes, status")
      .eq("match_id", matchId)
      .neq("status", "declined")
      .order("session_date", { ascending: true })
      .limit(1)
      .maybeSingle();
    setSession(data as BuddySession | null);
  }, [matchId]);

  // ── Session actions ───────────────────────────────────────────────────────
  async function acceptSession() {
    if (!session) return;
    await supabase.from("buddy_sessions").update({ status: "accepted" }).eq("id", session.id);
    loadSession();
  }

  async function declineSession() {
    if (!session) return;
    await supabase.from("buddy_sessions").update({ status: "declined" }).eq("id", session.id);
    setSession(null);
  }

  async function confirmSession() {
    if (!session) return;
    await supabase.from("buddy_sessions").update({ status: "confirmed" }).eq("id", session.id);
    loadSession();
  }

  // ── Propose session ───────────────────────────────────────────────────────
  async function proposeSession() {
    if (!userId || !other || !sessionDate.trim() || proposing) return;
    setProposing(true);

    await supabase.from("buddy_sessions").insert({
      proposer_id:  userId,
      receiver_id:  other.id,
      match_id:     matchId,
      sport:        sessionSport,
      session_date: sessionDate.trim(),
      session_time: sessionTime.trim() || null,
      location:     sessionLocation.trim() || null,
      notes:        null,
      status:       "pending",
    });

    setProposing(false);
    setShowSchedule(false);
    setSessionDate(""); setSessionTime(""); setSessionLocation("");
    loadSession();
  }

  // ── Messaging ────────────────────────────────────────────────────────────
  async function sendMessage() {
    const trimmed = text.trim();
    if (!trimmed || !userId || sending) return;
    setSending(true);
    setText("");
    await supabase.from("messages").insert({
      match_id:  matchId,
      sender_id: userId,
      content:   trimmed,
      read_at:   null,
    });
    setSending(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  }

  // ── Formatting ────────────────────────────────────────────────────────────
  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDateLabel(iso: string): string {
    const d = new Date(iso);
    const today     = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString())     return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.brand} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const otherName    = other?.full_name ?? other?.username ?? "Chat";
  const otherInitial = otherName[0]?.toUpperCase() ?? "?";
  const levelColor   = other?.fitness_level ? LEVEL_COLOR[other.fitness_level] ?? null : null;

  // Build date-grouped list
  const items: ListItem[] = [];
  let lastDate = "";
  for (const msg of messages) {
    const date = new Date(msg.created_at).toDateString();
    if (date !== lastDate) {
      items.push({ type: "date", label: formatDateLabel(msg.created_at), key: `date-${date}` });
      lastDate = date;
    }
    items.push({ type: "msg", msg });
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]} edges={["top", "bottom"]}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={[s.header, { borderBottomColor: c.border, backgroundColor: c.bg }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="back" size={24} color={c.textSecondary} />
        </TouchableOpacity>

        <View style={[s.headerAvatar, { backgroundColor: c.brandSubtle, borderColor: c.brandBorder }]}>
          <Text style={[s.headerAvatarText, { color: c.brand }]}>{otherInitial}</Text>
        </View>

        <View style={s.headerInfo}>
          <Text style={[s.headerName, { color: c.text }]} numberOfLines={1}>
            {otherName}
          </Text>
          {levelColor && (
            <View style={[s.levelBadge, { backgroundColor: levelColor + "20", borderColor: levelColor + "50" }]}>
              <Text style={[s.levelText, { color: levelColor }]}>
                {other!.fitness_level}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[s.scheduleBtn, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}
          onPress={() => setShowSchedule(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="calendar" size={18} color={c.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Session banner ──────────────────────────────────────────── */}
      {session && userId && (
        <SessionBanner
          session={session}
          myId={userId}
          partnerName={other?.full_name?.split(" ")[0] ?? other?.username ?? "them"}
          onAccept={acceptSession}
          onDecline={declineSession}
          onConfirm={confirmSession}
        />
      )}

      {/* ── Messages + input ────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={items}
          keyExtractor={(item) => item.type === "date" ? item.key : item.msg.id}
          contentContainerStyle={s.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            if (item.type === "date") {
              return (
                <Text style={[s.dateLabel, { color: c.textFaint }]}>{item.label}</Text>
              );
            }

            const { msg } = item;
            const isMine = msg.sender_id === userId;

            return (
              <View style={[s.bubbleRow, isMine && s.bubbleRowMine]}>
                {!isMine && (
                  <View style={[s.bubbleAvatar, { backgroundColor: c.brandSubtle }]}>
                    <Text style={[s.bubbleAvatarText, { color: c.brand }]}>{otherInitial}</Text>
                  </View>
                )}
                <View style={[
                  s.bubble,
                  isMine
                    ? { backgroundColor: c.brand, borderBottomRightRadius: 4 }
                    : { backgroundColor: c.bgCard, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: c.border },
                ]}>
                  <Text style={[s.bubbleText, { color: isMine ? "#fff" : c.text }]}>
                    {msg.content}
                  </Text>
                  <View style={s.bubbleMeta}>
                    <Text style={[s.bubbleTime, { color: isMine ? "rgba(255,255,255,0.45)" : c.textFaint }]}>
                      {formatTime(msg.created_at)}
                    </Text>
                    {isMine && (
                      <Text style={{ fontSize: FONT.size.xs, color: "rgba(255,255,255,0.45)" }}>
                        {msg.read_at ? "✓✓" : "✓"}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={s.emptyChat}>
              <View style={[s.emptyChatAvatar, { backgroundColor: c.brandSubtle, borderColor: c.brandBorder }]}>
                <Text style={[s.emptyChatInitial, { color: c.brand }]}>{otherInitial}</Text>
              </View>
              <Text style={[s.emptyChatName, { color: c.text }]}>{otherName}</Text>
              <Text style={[s.emptyChatHint, { color: c.textMuted }]}>
                {session
                  ? "Session planned — say hello and coordinate the details"
                  : "Matched — say hello and plan your first session"}
              </Text>
            </View>
          }
        />

        {/* Input row */}
        <View style={[s.inputRow, { borderTopColor: c.border, backgroundColor: c.bg }]}>
          <TextInput
            style={[s.input, { backgroundColor: c.bgCard, color: c.text, borderColor: c.border }]}
            value={text}
            onChangeText={setText}
            placeholder="Message..."
            placeholderTextColor={c.textFaint}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              s.sendBtn,
              text.trim() && !sending
                ? { backgroundColor: c.brand }
                : { backgroundColor: c.bgCardAlt, borderWidth: 1, borderColor: c.border },
            ]}
            onPress={sendMessage}
            disabled={!text.trim() || sending}
            activeOpacity={0.85}
          >
            {sending
              ? <ActivityIndicator color={c.brand} size="small" />
              : <Icon name="send" size={17} color={text.trim() ? "#fff" : c.textFaint} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Schedule session sheet ──────────────────────────────────── */}
      <Modal
        visible={showSchedule}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSchedule(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowSchedule(false)}>
          <View style={s.backdrop} />
        </TouchableWithoutFeedback>

        <View style={[s.sheet, { backgroundColor: c.bgCard, maxHeight: SCREEN_H * 0.78 }]}>
          <View style={[s.sheetHandle, { backgroundColor: c.borderMedium }]} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[s.sheetTitle, { color: c.text }]}>
              Propose session with {other?.full_name?.split(" ")[0] ?? other?.username}
            </Text>

            {/* Warn if a session already exists */}
            {session && session.status !== "declined" && session.status !== "confirmed" && (
              <View style={[s.existingNote, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                <Icon name="clock" size={13} color={c.textMuted} />
                <Text style={[s.existingNoteText, { color: c.textMuted }]}>
                  You have a {session.sport} session already planned. Proposing a new one will add it alongside.
                </Text>
              </View>
            )}

            {/* Sport */}
            <Text style={[s.fieldLabel, { color: c.textMuted }]}>Sport</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.sportChips}
            >
              {SPORTS.map((sp) => (
                <TouchableOpacity
                  key={sp}
                  style={[
                    s.sportChip,
                    sessionSport === sp
                      ? { backgroundColor: c.brand + "20", borderColor: c.brand }
                      : { backgroundColor: c.bgCardAlt, borderColor: c.border },
                  ]}
                  onPress={() => setSessionSport(sp)}
                  activeOpacity={0.75}
                >
                  <Text style={[
                    s.sportChipText,
                    { color: sessionSport === sp ? c.brand : c.textSecondary },
                  ]}>
                    {sp}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Date */}
            <Text style={[s.fieldLabel, { color: c.textMuted }]}>Date *</Text>
            <TextInput
              style={[s.textInput, { backgroundColor: c.bgCardAlt, borderColor: sessionDate.trim() ? c.brandBorder : c.border, color: c.text }]}
              value={sessionDate}
              onChangeText={setSessionDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={c.textFaint}
            />

            {/* Time */}
            <Text style={[s.fieldLabel, { color: c.textMuted }]}>Time (optional)</Text>
            <TextInput
              style={[s.textInput, { backgroundColor: c.bgCardAlt, borderColor: c.border, color: c.text }]}
              value={sessionTime}
              onChangeText={setSessionTime}
              placeholder="e.g. 18:00"
              placeholderTextColor={c.textFaint}
            />

            {/* Location */}
            <Text style={[s.fieldLabel, { color: c.textMuted }]}>Location (optional)</Text>
            <TextInput
              style={[s.textInput, { backgroundColor: c.bgCardAlt, borderColor: c.border, color: c.text }]}
              value={sessionLocation}
              onChangeText={setSessionLocation}
              placeholder="e.g. Planet Fitness, Main St"
              placeholderTextColor={c.textFaint}
            />

            {/* Submit */}
            <TouchableOpacity
              style={[
                s.proposeBtn,
                { backgroundColor: c.brand },
                (!sessionDate.trim() || proposing) && { opacity: 0.4 },
              ]}
              onPress={proposeSession}
              disabled={!sessionDate.trim() || proposing}
              activeOpacity={0.85}
            >
              {proposing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={s.proposeBtnInner}>
                  <Icon name="calendar" size={18} color="#fff" />
                  <Text style={s.proposeBtnText}>Propose Session</Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header:           { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE[12], paddingVertical: SPACE[10], borderBottomWidth: 1, gap: SPACE[10] },
  backBtn:          { padding: SPACE[4] },
  headerAvatar:     { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1.5, flexShrink: 0 },
  headerAvatarText: { fontSize: FONT.size.lg, fontWeight: FONT.weight.black },
  headerInfo:       { flex: 1, gap: 3 },
  headerName:       { fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },
  levelBadge:       { alignSelf: "flex-start", paddingHorizontal: SPACE[6], paddingVertical: 2, borderRadius: RADIUS.pill, borderWidth: 1 },
  levelText:        { fontSize: FONT.size.xs, fontWeight: FONT.weight.extrabold, textTransform: "capitalize", letterSpacing: 0.3 },
  scheduleBtn:      { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },

  // Messages
  messageList:      { padding: SPACE[16], paddingBottom: SPACE[8], gap: 2 },
  dateLabel:        { textAlign: "center", fontSize: FONT.size.xs, marginVertical: SPACE[16], fontWeight: FONT.weight.semibold },
  bubbleRow:        { flexDirection: "row", alignItems: "flex-end", gap: SPACE[8], marginVertical: 2 },
  bubbleRowMine:    { flexDirection: "row-reverse" },
  bubbleAvatar:     { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  bubbleAvatarText: { fontSize: FONT.size.xs, fontWeight: FONT.weight.black },
  bubble:           { maxWidth: "74%", borderRadius: 18, paddingHorizontal: SPACE[14], paddingVertical: SPACE[10], gap: 2 },
  bubbleText:       { fontSize: FONT.size.md, lineHeight: FONT.size.md * 1.4 },
  bubbleMeta:       { flexDirection: "row", alignItems: "center", gap: SPACE[4], alignSelf: "flex-end" },
  bubbleTime:       { fontSize: FONT.size.xs },

  // Empty
  emptyChat:        { alignItems: "center", paddingTop: SPACE[60], gap: SPACE[12] },
  emptyChatAvatar:  { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  emptyChatInitial: { fontSize: FONT.size.xxxl, fontWeight: FONT.weight.black },
  emptyChatName:    { fontSize: FONT.size.lg, fontWeight: FONT.weight.extrabold },
  emptyChatHint:    { fontSize: FONT.size.sm, textAlign: "center", paddingHorizontal: SPACE[32] },

  // Input
  inputRow:         { flexDirection: "row", alignItems: "flex-end", padding: SPACE[10], gap: SPACE[8], borderTopWidth: 1 },
  input:            { flex: 1, borderRadius: RADIUS.xl, paddingHorizontal: SPACE[16], paddingVertical: SPACE[10], fontSize: FONT.size.md, maxHeight: 120, borderWidth: 1 },
  sendBtn:          { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  // Schedule sheet
  backdrop:         { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet:            { borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, overflow: "hidden" },
  sheetHandle:      { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginTop: SPACE[12], marginBottom: SPACE[4] },
  sheetContent:     { padding: SPACE[20], gap: SPACE[14], paddingBottom: SPACE[40] },
  sheetTitle:       { fontSize: FONT.size.xl, fontWeight: FONT.weight.black, letterSpacing: -0.3, marginBottom: SPACE[4] },
  existingNote:     { flexDirection: "row", alignItems: "flex-start", gap: SPACE[8], padding: SPACE[12], borderRadius: RADIUS.md, borderWidth: 1 },
  existingNoteText: { flex: 1, fontSize: FONT.size.xs },
  fieldLabel:       { fontSize: FONT.size.xs, fontWeight: FONT.weight.extrabold, textTransform: "uppercase", letterSpacing: 1 },
  sportChips:       { gap: SPACE[8], paddingBottom: SPACE[4] },
  sportChip:        { paddingHorizontal: SPACE[12], paddingVertical: SPACE[8], borderRadius: RADIUS.pill, borderWidth: 1 },
  sportChipText:    { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  textInput:        { borderRadius: RADIUS.md, paddingHorizontal: SPACE[14], paddingVertical: SPACE[12], fontSize: FONT.size.md, borderWidth: 1 },
  proposeBtn:       { borderRadius: RADIUS.lg, paddingVertical: SPACE[16], alignItems: "center", marginTop: SPACE[4] },
  proposeBtnInner:  { flexDirection: "row", alignItems: "center", gap: SPACE[8] },
  proposeBtnText:   { color: "#fff", fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },
});
