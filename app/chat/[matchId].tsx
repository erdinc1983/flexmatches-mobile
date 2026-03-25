/**
 * Chat — Individual Conversation
 *
 * Improvements:
 * - Real avatar images in header + message bubbles (Avatar component)
 * - Message delivery ticks: ✓ gray (sent), ✓✓ gray (delivered), ✓✓ blue (read)
 * - Schedule session: centered modal (not bottom sheet)
 * - Inline calendar date picker
 * - Drum-roll time picker (up/down spinners)
 * - Custom event name when sport = "Other"
 * - Location picker from map (react-native-maps + expo-location)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, ScrollView, Dimensions, Vibration, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { MapLocationPicker } from "../../components/MapLocationPicker";
import { useTheme, SPACE, FONT, RADIUS } from "../../lib/theme";
import { Icon } from "../../components/Icon";
import { Avatar } from "../../components/Avatar";
import { SessionBanner } from "../../components/chat/SessionBanner";
import type { BuddySession } from "../../components/chat/SessionBanner";
import { ProfileSheet } from "../../components/discover/ProfileSheet";
import type { DiscoverUser } from "../../components/discover/PersonCard";

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
  avatar_url:    string | null;
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

const MONTHS = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get("window");

// ─── Calendar Picker ──────────────────────────────────────────────────────────
function CalendarPicker({
  value, onChange, colors,
}: { value: string; onChange: (d: string) => void; colors: any }) {
  const today = new Date();
  const initDate = value ? new Date(value + "T12:00:00") : today;

  const [vm, setVm] = useState({ year: initDate.getFullYear(), month: initDate.getMonth() });

  const { year, month } = vm;
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const selDate = value ? new Date(value + "T12:00:00") : null;
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  const dayStr = (d: number) =>
    `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  const isSelected = (d: number) => selDate
    ? selDate.getFullYear()===year && selDate.getMonth()===month && selDate.getDate()===d
    : false;
  const isPast = (d: number) => dayStr(d) < todayStr;

  const prev = () => setVm(({year:y,month:m}) => m===0 ? {year:y-1,month:11} : {year:y,month:m-1});
  const next = () => setVm(({year:y,month:m}) => m===11 ? {year:y+1,month:0} : {year:y,month:m+1});

  return (
    <View style={cal.root}>
      {/* Month nav */}
      <View style={cal.nav}>
        <TouchableOpacity onPress={prev} style={cal.navBtn} hitSlop={8}>
          <Text style={[cal.navArrow, { color: colors.textMuted }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[cal.monthLabel, { color: colors.text }]}>
          {MONTHS[month]} {year}
        </Text>
        <TouchableOpacity onPress={next} style={cal.navBtn} hitSlop={8}>
          <Text style={[cal.navArrow, { color: colors.textMuted }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day-of-week headers */}
      <View style={cal.row}>
        {DAY_LABELS.map((l) => (
          <Text key={l} style={[cal.dayHeader, { color: colors.textFaint }]}>{l}</Text>
        ))}
      </View>

      {/* Day grid */}
      {rows.map((row, ri) => (
        <View key={ri} style={cal.row}>
          {row.map((day, ci) => {
            if (day === null) return <View key={ci} style={cal.cell} />;
            const past = isPast(day);
            const sel  = isSelected(day);
            return (
              <TouchableOpacity
                key={ci}
                style={[cal.cell, sel && { backgroundColor: "#FF4500", borderRadius: 20 }]}
                onPress={() => !past && onChange(dayStr(day))}
                disabled={past}
                hitSlop={2}
              >
                <Text style={[
                  cal.dayText,
                  { color: past ? colors.textFaint : sel ? "#fff" : colors.text },
                  sel && { fontWeight: "900" },
                ]}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Time Picker ──────────────────────────────────────────────────────────────
function TimePickerInline({
  hour, minute, onHourChange, onMinuteChange, colors,
}: { hour: number; minute: number; onHourChange: (h:number)=>void; onMinuteChange:(m:number)=>void; colors:any }) {
  return (
    <View style={tp.root}>
      <TimeColumn value={hour} max={23} step={1} onChange={onHourChange} colors={colors} />
      <Text style={[tp.colon, { color: colors.text }]}>:</Text>
      <TimeColumn value={minute} max={55} step={5} onChange={onMinuteChange} colors={colors} />
    </View>
  );
}

function TimeColumn({ value, max, step, onChange, colors }: {
  value: number; max: number; step: number; onChange: (v:number)=>void; colors: any;
}) {
  const inc = () => onChange(value + step > max ? 0 : value + step);
  const dec = () => onChange(value - step < 0 ? max : value - step);
  return (
    <View style={tp.col}>
      <TouchableOpacity onPress={inc} style={tp.arrow} hitSlop={10}>
        <Text style={[tp.arrowText, { color: colors.textMuted }]}>▲</Text>
      </TouchableOpacity>
      <Text style={[tp.val, { color: colors.text }]}>{String(value).padStart(2,"0")}</Text>
      <TouchableOpacity onPress={dec} style={tp.arrow} hitSlop={10}>
        <Text style={[tp.arrowText, { color: colors.textMuted }]}>▼</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { matchId }       = useLocalSearchParams<{ matchId: string }>();
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const [messages,        setMessages]        = useState<Message[]>([]);
  const [userId,          setUserId]          = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const [other,           setOther]           = useState<OtherUser | null>(null);
  const [session,         setSession]         = useState<BuddySession | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [text,            setText]            = useState("");
  const [sending,         setSending]         = useState(false);

  // Schedule sheet state
  const [showSchedule,    setShowSchedule]    = useState(false);
  const [sessionSport,    setSessionSport]    = useState("Gym");
  const [sessionTitle,    setSessionTitle]    = useState("");         // for "Other"
  const [sessionDate,     setSessionDate]     = useState("");
  const [sessionHour,     setSessionHour]     = useState(9);
  const [sessionMinute,   setSessionMinute]   = useState(0);
  const [useTime,         setUseTime]         = useState(false);
  const [sessionLocation, setSessionLocation] = useState("");
  const [proposing,       setProposing]       = useState(false);
  const [showMapPicker,   setShowMapPicker]   = useState(false);
  const [sheetUser,       setSheetUser]       = useState<DiscoverUser | null>(null);

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
        const newMsg = payload.new as Message;
        setMessages((prev) => [...prev, newMsg]);
        // Subtle vibration for incoming messages (not own)
        if (userIdRef.current && newMsg.sender_id !== userIdRef.current) Vibration.vibrate(150);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "messages",
        filter: `match_id=eq.${matchId}`,
      }, (payload) => {
        // Update read_at status for delivery tick
        setMessages((prev) => prev.map((m) =>
          m.id === (payload.new as Message).id ? { ...m, read_at: (payload.new as Message).read_at } : m
        ));
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
    userIdRef.current = user.id;

    const [{ data: match }, { data: msgs }] = await Promise.all([
      supabase.from("matches")
        .select("sender_id, receiver_id")
        .eq("id", matchId)
        .single(),
      supabase.from("messages")
        .select("id, content, sender_id, created_at, read_at")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true }),
    ]);

    if (match) {
      const otherId = (match as any).sender_id === user.id
        ? (match as any).receiver_id
        : (match as any).sender_id;
      const { data: otherUser } = await supabase
        .from("users")
        .select("id, username, full_name, fitness_level, avatar_url")
        .eq("id", otherId)
        .single();
      if (otherUser) setOther(otherUser as OtherUser);
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
      .not("status", "in", '("declined","cancelled")')
      .order("session_date", { ascending: true })
      .limit(1)
      .maybeSingle();
    setSession(data as BuddySession | null);
  }, [matchId]);

  // ── Session actions ───────────────────────────────────────────────────────
  async function acceptSession()  {
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
    await supabase.from("buddy_sessions").update({ status: "completed" }).eq("id", session.id);
    loadSession();
  }

  // ── Propose session ───────────────────────────────────────────────────────
  async function proposeSession() {
    if (!userId || !other || !sessionDate.trim() || proposing) return;
    setProposing(true);

    const sportValue = sessionSport === "Other" && sessionTitle.trim()
      ? sessionTitle.trim()
      : sessionSport;

    await supabase.from("buddy_sessions").insert({
      proposer_id:  userId,
      receiver_id:  other.id,
      match_id:     matchId,
      sport:        sportValue,
      session_date: sessionDate.trim(),
      session_time: useTime
        ? `${String(sessionHour).padStart(2,"0")}:${String(sessionMinute).padStart(2,"0")}`
        : null,
      location:     sessionLocation.trim() || null,
      notes:        null,
      status:       "pending",
    });

    setProposing(false);
    setShowSchedule(false);
    setSessionDate("");
    setSessionTitle("");
    setSessionLocation("");
    setUseTime(false);
    loadSession();
  }

  // ── Profile popup ────────────────────────────────────────────────────────
  async function openProfile() {
    if (!other) return;
    const { data } = await supabase
      .from("users")
      .select("id, username, full_name, avatar_url, bio, city, fitness_level, age, sports, current_streak, last_active, is_at_gym, availability")
      .eq("id", other.id)
      .single();
    if (!data) return;
    setSheetUser({
      id:             data.id,
      username:       data.username,
      full_name:      data.full_name ?? null,
      avatar_url:     data.avatar_url ?? null,
      bio:            data.bio ?? null,
      city:           data.city ?? null,
      fitness_level:  data.fitness_level ?? null,
      age:            data.age ?? null,
      sports:         data.sports ?? [],
      current_streak: data.current_streak ?? 0,
      last_active:    data.last_active ?? null,
      is_at_gym:      data.is_at_gym ?? false,
      availability:   data.availability ?? null,
      matchScore:     0,
      reasons:        [],
      isNew:          false,
    });
  }

  function handleLongPressHeader() {
    Alert.alert(
      other?.full_name ?? other?.username ?? "Partner",
      "What would you like to do?",
      [
        {
          text: "Unmatch",
          style: "destructive",
          onPress: () => Alert.alert("Unmatch?", "You won't be able to message each other anymore.", [
            { text: "Cancel", style: "cancel" },
            { text: "Unmatch", style: "destructive", onPress: async () => {
              await supabase.from("matches").update({ status: "declined" }).eq("id", matchId);
              router.back();
            }},
          ]),
        },
        {
          text: "Delete conversation",
          style: "destructive",
          onPress: () => Alert.alert("Delete conversation?", "All messages will be deleted.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
              await supabase.from("messages").delete().eq("match_id", matchId);
              setMessages([]);
            }},
          ]),
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
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
    const d         = new Date(iso);
    const today     = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString())     return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  }
  function formatSessionDate(dateStr: string): string {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.brand} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const otherName  = other?.full_name ?? other?.username ?? "Chat";
  const levelColor = other?.fitness_level ? LEVEL_COLOR[other.fitness_level] ?? null : null;

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
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
          <Icon name="back" size={24} color={c.textSecondary} />
        </TouchableOpacity>

        {/* Tappable avatar + name → profile popup */}
        <TouchableOpacity
          style={s.headerCenter}
          onPress={openProfile}
          onLongPress={handleLongPressHeader}
          activeOpacity={0.75}
          delayLongPress={400}
        >
          <Avatar url={other?.avatar_url} name={otherName} size={38} />
          <View style={s.headerInfo}>
            <Text style={[s.headerName, { color: c.text }]} numberOfLines={1}>{otherName}</Text>
            {levelColor && (
              <View style={[s.levelBadge, { backgroundColor: levelColor+"20", borderColor: levelColor+"50" }]}>
                <Text style={[s.levelText, { color: levelColor }]}>{other!.fitness_level}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.scheduleBtn, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}
          onPress={() => setShowSchedule(true)}
          hitSlop={{ top:8, bottom:8, left:8, right:8 }}
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
              return <Text style={[s.dateLabel, { color: c.textFaint }]}>{item.label}</Text>;
            }
            const { msg } = item;
            const isMine  = msg.sender_id === userId;

            return (
              <View style={[s.bubbleRow, isMine && s.bubbleRowMine]}>
                {/* Other person's avatar */}
                {!isMine && (
                  <Avatar url={other?.avatar_url} name={otherName} size={26} />
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
                    {/* Delivery ticks — only for my messages */}
                    {isMine && (
                      <Text style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: msg.read_at ? "#60A5FA" : "rgba(255,255,255,0.45)",
                        letterSpacing: -1,
                      }}>
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
              <Avatar url={other?.avatar_url} name={otherName} size={72} />
              <Text style={[s.emptyChatName,  { color: c.text }]}>{otherName}</Text>
              <Text style={[s.emptyChatHint,  { color: c.textMuted }]}>
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

      {/* ── Schedule session — centered modal ───────────────────────── */}
      <Modal
        visible={showSchedule}
        animationType="fade"
        transparent
        onRequestClose={() => { if (showMapPicker) setShowMapPicker(false); else setShowSchedule(false); }}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={20}
        >
          <View style={[s.modalCard, { backgroundColor: c.bgCard, maxHeight: SCREEN_H * 0.88 }]}>
            {/* Modal header */}
            <View style={[s.modalHeader, { borderBottomColor: c.border }]}>
              <Text style={[s.modalTitle, { color: c.text }]}>
                Propose a session
              </Text>
              <TouchableOpacity onPress={() => setShowSchedule(false)} hitSlop={10}>
                <Text style={{ color: c.textMuted, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.modalContent}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
              {/* Existing session warning */}
              {session && session.status !== "declined" && session.status !== "confirmed" && (
                <View style={[s.existingNote, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                  <Icon name="clock" size={13} color={c.textMuted} />
                  <Text style={[s.existingNoteText, { color: c.textMuted }]}>
                    You already have a {session.sport} session planned. This will be added alongside it.
                  </Text>
                </View>
              )}

              {/* Sport chips */}
              <Text style={[s.fieldLabel, { color: c.textMuted }]}>Sport</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sportChips}>
                {SPORTS.map((sp) => (
                  <TouchableOpacity
                    key={sp}
                    style={[
                      s.sportChip,
                      sessionSport === sp
                        ? { backgroundColor: c.brand+"20", borderColor: c.brand }
                        : { backgroundColor: c.bgCardAlt, borderColor: c.border },
                    ]}
                    onPress={() => setSessionSport(sp)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.sportChipText, { color: sessionSport === sp ? c.brand : c.textSecondary }]}>
                      {sp}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Custom event name for "Other" */}
              {sessionSport === "Other" && (
                <>
                  <Text style={[s.fieldLabel, { color: c.textMuted }]}>Event name</Text>
                  <TextInput
                    style={[s.textInput, { backgroundColor: c.bgCardAlt, borderColor: sessionTitle.trim() ? c.brand+"80" : c.border, color: c.text }]}
                    value={sessionTitle}
                    onChangeText={setSessionTitle}
                    placeholder="e.g. Parkour, Volleyball, Pilates…"
                    placeholderTextColor={c.textFaint}
                  />
                </>
              )}

              {/* Date — calendar picker */}
              <Text style={[s.fieldLabel, { color: c.textMuted }]}>Date *</Text>
              {sessionDate ? (
                <View style={[s.selectedDateRow, { backgroundColor: c.brand+"15", borderColor: c.brand+"60" }]}>
                  <Icon name="calendar" size={14} color={c.brand} />
                  <Text style={[s.selectedDateText, { color: c.brand }]}>
                    {formatSessionDate(sessionDate)}
                  </Text>
                  <TouchableOpacity onPress={() => setSessionDate("")} hitSlop={10}>
                    <Text style={{ color: c.textMuted, fontSize: 14 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={[s.calHint, { color: c.textFaint }]}>Tap a day below to select</Text>
              )}
              <CalendarPicker value={sessionDate} onChange={setSessionDate} colors={c} />

              {/* Time — optional toggle + spinner */}
              <View style={s.timeHeaderRow}>
                <Text style={[s.fieldLabel, { color: c.textMuted, marginBottom: 0 }]}>Time</Text>
                <TouchableOpacity
                  style={[s.timeToggle, { backgroundColor: useTime ? c.brand : c.bgCardAlt, borderColor: useTime ? c.brand : c.border }]}
                  onPress={() => setUseTime((v) => !v)}
                >
                  <Text style={[s.timeToggleText, { color: useTime ? "#fff" : c.textMuted }]}>
                    {useTime ? "Remove time" : "Add time"}
                  </Text>
                </TouchableOpacity>
              </View>
              {useTime && (
                <View style={[s.timePickerWrap, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                  <TimePickerInline
                    hour={sessionHour}
                    minute={sessionMinute}
                    onHourChange={setSessionHour}
                    onMinuteChange={setSessionMinute}
                    colors={c}
                  />
                </View>
              )}

              {/* Location */}
              <Text style={[s.fieldLabel, { color: c.textMuted }]}>Location</Text>
              <View style={s.locationRow}>
                <TextInput
                  style={[s.textInputFlex, { backgroundColor: c.bgCardAlt, borderColor: c.border, color: c.text }]}
                  value={sessionLocation}
                  onChangeText={setSessionLocation}
                  placeholder="e.g. Planet Fitness, Main St"
                  placeholderTextColor={c.textFaint}
                />
                <TouchableOpacity
                  style={[s.mapBtn, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}
                  onPress={() => setShowMapPicker(true)}
                  hitSlop={8}
                >
                  <Text style={{ fontSize: 18 }}>🗺️</Text>
                </TouchableOpacity>
              </View>

              {/* Submit */}
              <TouchableOpacity
                style={[s.proposeBtn, { backgroundColor: c.brand }, (!sessionDate.trim() || proposing) && { opacity: 0.4 }]}
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

            {/* ── Map overlay — absolute, covers modal card ── */}
            {showMapPicker && (
              <View style={[s.mapOverlay, { backgroundColor: c.bgCard }]}>
                <MapLocationPicker
                  colors={c}
                  onSelect={(loc) => { setSessionLocation(loc); setShowMapPicker(false); }}
                  onClose={() => setShowMapPicker(false)}
                />
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ProfileSheet
        user={sheetUser}
        status="accepted"
        onConnect={() => {}}
        onClose={() => setSheetUser(null)}
      />

    </SafeAreaView>
  );
}

// ─── Calendar styles ──────────────────────────────────────────────────────────
const CELL_SIZE = Math.floor((SCREEN_W - 40 - 32 - 6 * 4) / 7); // modal padding 20 + card padding 16

const cal = StyleSheet.create({
  root:      { paddingVertical: SPACE[8] },
  nav:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE[10] },
  navBtn:    { padding: SPACE[4] },
  navArrow:  { fontSize: 26, lineHeight: 30, fontWeight: "300" },
  monthLabel:{ fontSize: FONT.size.base, fontWeight: FONT.weight.extrabold },
  row:       { flexDirection: "row", marginBottom: 2 },
  dayHeader: { width: CELL_SIZE, textAlign: "center", fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, paddingBottom: 4 },
  cell:      { width: CELL_SIZE, height: CELL_SIZE, alignItems: "center", justifyContent: "center" },
  dayText:   { fontSize: FONT.size.sm },
});

// ─── Time picker styles ───────────────────────────────────────────────────────
const tp = StyleSheet.create({
  root:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE[16] },
  col:       { alignItems: "center", gap: SPACE[6] },
  arrow:     { padding: SPACE[8] },
  arrowText: { fontSize: 16, lineHeight: 20 },
  val:       { fontSize: 36, fontWeight: FONT.weight.black, width: 60, textAlign: "center" },
  colon:     { fontSize: 36, fontWeight: FONT.weight.black, marginBottom: 2 },
});

// ─── Main styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header:           { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE[12], paddingVertical: SPACE[10], borderBottomWidth: 1, gap: SPACE[10] },
  backBtn:          { padding: SPACE[4] },
  headerCenter:     { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACE[10] },
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
  bubble:           { maxWidth: "74%", borderRadius: 18, paddingHorizontal: SPACE[14], paddingVertical: SPACE[10], gap: 2 },
  bubbleText:       { fontSize: FONT.size.md, lineHeight: FONT.size.md * 1.4 },
  bubbleMeta:       { flexDirection: "row", alignItems: "center", gap: SPACE[4], alignSelf: "flex-end" },
  bubbleTime:       { fontSize: FONT.size.xs },

  // Empty
  emptyChat:        { alignItems: "center", paddingTop: SPACE[60], gap: SPACE[12] },
  emptyChatName:    { fontSize: FONT.size.lg, fontWeight: FONT.weight.extrabold },
  emptyChatHint:    { fontSize: FONT.size.sm, textAlign: "center", paddingHorizontal: SPACE[32] },

  // Input
  inputRow:         { flexDirection: "row", alignItems: "flex-end", padding: SPACE[10], gap: SPACE[8], borderTopWidth: 1 },
  input:            { flex: 1, borderRadius: RADIUS.xl, paddingHorizontal: SPACE[16], paddingVertical: SPACE[10], fontSize: FONT.size.md, maxHeight: 120, borderWidth: 1 },
  sendBtn:          { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  // Centered modal overlay
  modalOverlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: SPACE[20] },
  modalCard:        { width: "100%", borderRadius: RADIUS.xxl, overflow: "hidden" },
  modalHeader:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACE[20], paddingVertical: SPACE[16], borderBottomWidth: 1 },
  modalTitle:       { fontSize: FONT.size.xl, fontWeight: FONT.weight.black },
  modalContent:     { padding: SPACE[20], gap: SPACE[14], paddingBottom: SPACE[32] },

  // Schedule form
  existingNote:     { flexDirection: "row", alignItems: "flex-start", gap: SPACE[8], padding: SPACE[12], borderRadius: RADIUS.md, borderWidth: 1 },
  existingNoteText: { flex: 1, fontSize: FONT.size.xs },
  fieldLabel:       { fontSize: FONT.size.xs, fontWeight: FONT.weight.extrabold, textTransform: "uppercase", letterSpacing: 1, marginBottom: -4 },
  sportChips:       { gap: SPACE[8], paddingBottom: SPACE[4] },
  sportChip:        { paddingHorizontal: SPACE[12], paddingVertical: SPACE[8], borderRadius: RADIUS.pill, borderWidth: 1 },
  sportChipText:    { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  textInput:        { borderRadius: RADIUS.md, paddingHorizontal: SPACE[14], paddingVertical: SPACE[12], fontSize: FONT.size.md, borderWidth: 1 },
  selectedDateRow:  { flexDirection: "row", alignItems: "center", gap: SPACE[8], paddingHorizontal: SPACE[14], paddingVertical: SPACE[10], borderRadius: RADIUS.md, borderWidth: 1 },
  selectedDateText: { flex: 1, fontSize: FONT.size.md, fontWeight: FONT.weight.bold },
  calHint:          { fontSize: FONT.size.xs, marginBottom: -4 },
  timeHeaderRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timeToggle:       { paddingHorizontal: SPACE[12], paddingVertical: SPACE[8], borderRadius: RADIUS.pill, borderWidth: 1 },
  timeToggleText:   { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  timePickerWrap:   { borderRadius: RADIUS.xl, borderWidth: 1, paddingVertical: SPACE[20] },
  locationRow:      { flexDirection: "row", gap: SPACE[8], alignItems: "center" },
  textInputFlex:    { flex: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACE[14], paddingVertical: SPACE[12], fontSize: FONT.size.md, borderWidth: 1 },
  mapBtn:           { width: 46, height: 46, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  proposeBtn:       { borderRadius: RADIUS.lg, paddingVertical: SPACE[16], alignItems: "center", marginTop: SPACE[4] },
  proposeBtnInner:  { flexDirection: "row", alignItems: "center", gap: SPACE[8] },
  proposeBtnText:   { color: "#fff", fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },
  // Map overlay — covers the entire modal card
  mapOverlay:       { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, borderRadius: RADIUS.xxl, overflow: "hidden" },
});
