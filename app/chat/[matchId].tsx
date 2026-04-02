/**
 * Chat — Individual Conversation
 *
 * Header:
 *   ← avatar + name (tap = profile, long-press = actions) | ⋮ (3-line menu)
 *
 * 3-line menu → bottom sheet:
 *   Today · Tomorrow · Propose a session
 *
 * Session wizard (3 steps, slides up from bottom):
 *   Step 1 — Sport
 *   Step 2 — Date (pre-filled when Today/Tomorrow tapped)
 *   Step 3 — Time (optional) + Location → Propose
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, ScrollView, Dimensions, Vibration, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { notifyUser } from "../../lib/push";
import { scheduleSessionReminder } from "../../lib/notifications";
import { MapLocationPicker } from "../../components/MapLocationPicker";
import { useTheme, SPACE, FONT, RADIUS } from "../../lib/theme";
import { useNotifications } from "../../lib/notificationContext";
import { Icon } from "../../components/Icon";
import { Avatar } from "../../components/Avatar";
import { SessionBanner } from "../../components/chat/SessionBanner";
import type { BuddySession } from "../../components/chat/SessionBanner";
import { ProfileSheet } from "../../components/discover/ProfileSheet";
import type { DiscoverUser } from "../../components/discover/PersonCard";
import { BlurOverlay } from "../../components/ui/BlurOverlay";

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

// ─── Date helpers ─────────────────────────────────────────────────────────────
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function todayStr():    string { return toDateStr(new Date()); }
function tomorrowStr(): string { const t = new Date(); t.setDate(t.getDate()+1); return toDateStr(t); }
function nextWeekdayStr(target: number): string {
  const t = new Date();
  const diff = (target - t.getDay() + 7) % 7 || 7;
  t.setDate(t.getDate() + diff);
  return toDateStr(t);
}
function friendlyDate(iso: string): string {
  if (!iso) return "";
  const today = todayStr();
  const tmrw  = tomorrowStr();
  if (iso === today) return "Today";
  if (iso === tmrw)  return "Tomorrow";
  return new Date(iso + "T12:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

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

  const todayS = todayStr();
  const dayStr = (d: number) =>
    `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  const isSelected = (d: number) => value === dayStr(d);
  const isPast     = (d: number) => dayStr(d) < todayS;

  return (
    <View style={cal.root}>
      <View style={cal.nav}>
        <TouchableOpacity onPress={() => setVm(({year:y,month:m}) => m===0 ? {year:y-1,month:11} : {year:y,month:m-1})} hitSlop={10}>
          <Text style={[cal.navArrow, { color: colors.textMuted }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[cal.monthLabel, { color: colors.text }]}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={() => setVm(({year:y,month:m}) => m===11 ? {year:y+1,month:0} : {year:y,month:m+1})} hitSlop={10}>
          <Text style={[cal.navArrow, { color: colors.textMuted }]}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={cal.row}>
        {DAY_LABELS.map((l) => (
          <Text key={l} style={[cal.dayHeader, { color: colors.textFaint }]}>{l}</Text>
        ))}
      </View>
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
                <Text style={[cal.dayText, { color: past ? colors.textFaint : sel ? "#fff" : colors.text }, sel && { fontWeight: "900" }]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Time Picker ──────────────────────────────────────────────────────────────
function TimeColumn({ value, max, step, onChange, colors }: {
  value: number; max: number; step: number; onChange: (v:number)=>void; colors: any;
}) {
  return (
    <View style={tp.col}>
      <TouchableOpacity onPress={() => onChange(value + step > max ? 0 : value + step)} style={tp.arrow} hitSlop={10}>
        <Text style={[tp.arrowText, { color: colors.textMuted }]}>▲</Text>
      </TouchableOpacity>
      <Text style={[tp.val, { color: colors.text }]}>{String(value).padStart(2,"0")}</Text>
      <TouchableOpacity onPress={() => onChange(value - step < 0 ? max : value - step)} style={tp.arrow} hitSlop={10}>
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
  const { refresh: refreshNotifs } = useNotifications();

  const [messages,        setMessages]        = useState<Message[]>([]);
  const [userId,          setUserId]          = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const [other,           setOther]           = useState<OtherUser | null>(null);
  const [session,         setSession]         = useState<BuddySession | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [text,            setText]            = useState("");
  const [sending,         setSending]         = useState(false);

  // Action menu (3-line button)
  const [showActionMenu,  setShowActionMenu]  = useState(false);

  // Session wizard
  const [showWizard,      setShowWizard]      = useState(false);
  const [wizardStep,      setWizardStep]      = useState<1|2|3>(1);
  const [sessionSport,    setSessionSport]    = useState("Gym");
  const [sessionTitle,    setSessionTitle]    = useState("");
  const [sessionDate,     setSessionDate]     = useState("");
  const [sessionHour,     setSessionHour]     = useState(9);
  const [sessionMinute,   setSessionMinute]   = useState(0);
  const [useTime,         setUseTime]         = useState(false);
  const [sessionLocation, setSessionLocation] = useState("");
  const [proposing,       setProposing]       = useState(false);
  const [showMapPicker,     setShowMapPicker]     = useState(false);
  const [sheetUser,         setSheetUser]         = useState<DiscoverUser | null>(null);
  const [showCompleted,     setShowCompleted]     = useState(false);
  const [completedSessions, setCompletedSessions] = useState<{ id: string; sport: string; session_date: string; completed_at: string | null }[]>([]);
  const [sessionCount,      setSessionCount]      = useState(0);

  const flatListRef       = useRef<FlatList>(null);
  const editingSessionRef = useRef<string | null>(null); // id of session being replaced via Edit

  // ── Wizard open helpers ──────────────────────────────────────────────────
  function openWizard(prefilledDate?: string) {
    setSessionSport("Gym");
    setSessionTitle("");
    setSessionDate(prefilledDate ?? "");
    setSessionHour(9);
    setSessionMinute(0);
    setUseTime(false);
    setSessionLocation("");
    setWizardStep(1);
    setShowWizard(true);
  }

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
        if (userIdRef.current && newMsg.sender_id !== userIdRef.current) Vibration.vibrate(150);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "messages",
        filter: `match_id=eq.${matchId}`,
      }, (payload) => {
        setMessages((prev) => prev.map((m) =>
          m.id === (payload.new as Message).id ? { ...m, read_at: (payload.new as Message).read_at } : m
        ));
      })
      .subscribe();

    const sessionChannel = supabase
      .channel(`chat-sessions:${matchId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "buddy_sessions",
        filter: `match_id=eq.${matchId}`,
      }, (payload) => {
        const s = payload.new as BuddySession;
        if (!["declined","cancelled"].includes(s.status)) setSession(s);
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "buddy_sessions",
        filter: `match_id=eq.${matchId}`,
      }, (payload) => {
        const s = payload.new as BuddySession;
        if (["declined","cancelled","completed"].includes(s.status)) setSession(null);
        else setSession(s);
      })
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
      supabase.from("matches").select("sender_id, receiver_id").eq("id", matchId).single(),
      supabase.from("messages").select("id, content, sender_id, created_at, read_at")
        .eq("match_id", matchId).order("created_at", { ascending: true }),
    ]);

    if (match) {
      const otherId = (match as any).sender_id === user.id
        ? (match as any).receiver_id : (match as any).sender_id;
      const { data: otherUser } = await supabase
        .from("users").select("id, username, full_name, fitness_level, avatar_url")
        .eq("id", otherId).single();
      if (otherUser) setOther(otherUser as OtherUser);
    }

    setMessages(msgs ?? []);
    setLoading(false);

    supabase.from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("match_id", matchId).neq("sender_id", user.id).is("read_at", null)
      .then(() => refreshNotifs());

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    loadSession();

    // Load completed session count for this match pair
    const { count } = await supabase
      .from("buddy_sessions")
      .select("*", { count: "exact", head: true })
      .eq("match_id", matchId)
      .eq("status", "completed");
    setSessionCount(count ?? 0);
  }

  const loadCompletedSessions = useCallback(async () => {
    const { data } = await supabase
      .from("buddy_sessions")
      .select("id, sport, session_date, completed_at")
      .eq("match_id", matchId)
      .eq("status", "completed")
      .order("session_date", { ascending: false });
    setCompletedSessions(data ?? []);
  }, [matchId]);

  const loadSession = useCallback(async () => {
    const { data } = await supabase
      .from("buddy_sessions")
      .select("id, match_id, proposer_id, receiver_id, sport, session_date, session_time, location, notes, status")
      .eq("match_id", matchId)
      .not("status", "in", '("declined","cancelled","completed")')
      .order("session_date", { ascending: true })
      .limit(1).maybeSingle();
    setSession(data as BuddySession | null);
  }, [matchId]);

  // ── Session actions ───────────────────────────────────────────────────────
  async function acceptSession() {
    if (!session) return;
    await supabase.from("buddy_sessions").update({ status: "accepted" }).eq("id", session.id);
    if (session.session_date) {
      const partnerName = other?.full_name?.split(" ")[0] ?? other?.username ?? "your partner";
      scheduleSessionReminder(partnerName, session.session_date);
    }
    // Push to proposer: their session was accepted
    if (session.proposer_id && session.proposer_id !== userId) {
      const myName = other?.full_name?.split(" ")[0]; // we are the accepter, other is the proposer... actually no
      const { data: me } = await supabase.from("users").select("full_name, username").eq("id", userId!).single();
      notifyUser(session.proposer_id, {
        type: "session_accepted",
        title: "Session Accepted! ✅",
        body: `${me?.full_name ?? me?.username ?? "Your partner"} accepted your ${session.sport} session`,
        relatedId: matchId,
        data: { type: "session_accepted", matchId },
      });
    }
    loadSession();
  }
  async function declineSession() {
    if (!session) return;
    await supabase.from("buddy_sessions").update({ status: "declined" }).eq("id", session.id);
    // Notify proposer: their session was declined
    if (session.proposer_id && session.proposer_id !== userId) {
      const { data: me } = await supabase.from("users").select("full_name, username").eq("id", userId!).single();
      notifyUser(session.proposer_id, {
        type: "session_declined",
        title: "Session Declined",
        body: `${me?.full_name ?? me?.username ?? "Your partner"} declined the ${session.sport} session`,
        relatedId: matchId,
        data: { type: "session_declined", matchId },
      });
    }
    setSession(null);
  }
  /** Recalculate reliability_score for a user based on their counters */
  async function recalcReliability(uid: string) {
    const { data } = await supabase
      .from("users")
      .select("sessions_completed, sessions_no_show, sessions_cancelled")
      .eq("id", uid)
      .single();
    if (!data) return;
    const completed  = data.sessions_completed ?? 0;
    const noShow     = data.sessions_no_show ?? 0;
    const cancelled  = data.sessions_cancelled ?? 0;
    const total = completed + noShow + cancelled;
    const score = total === 0 ? 100 : Math.round((completed / total) * 100);
    await supabase.from("users").update({ reliability_score: score }).eq("id", uid);
  }

  async function cancelSession() {
    if (!session || !userId) return;
    await supabase.from("buddy_sessions").update({ status: "cancelled" }).eq("id", session.id);
    // Increment cancelled counter + recalc reliability
    const { data } = await supabase.from("users").select("sessions_cancelled").eq("id", userId).single();
    if (data) {
      await supabase.from("users").update({ sessions_cancelled: (data.sessions_cancelled ?? 0) + 1 }).eq("id", userId);
      recalcReliability(userId);
    }
    setSession(null);
  }

  function editSession() {
    if (!session) return;
    // Store the id — only cancel AFTER new session is successfully proposed
    editingSessionRef.current = session.id;
    // Pre-fill wizard with existing values
    setSessionSport(session.sport);
    setSessionTitle("");
    setSessionDate(session.session_date);
    if (session.session_time) {
      const [h, m] = session.session_time.split(":").map(Number);
      setSessionHour(h);
      setSessionMinute(m);
      setUseTime(true);
    } else {
      setUseTime(false);
    }
    setSessionLocation(session.location ?? "");
    setWizardStep(1);
    setShowWizard(true);
  }

  async function confirmSession() {
    if (!session || !userId) return;
    await supabase.from("buddy_sessions").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      confirmed_by: userId,
    }).eq("id", session.id);
    // Increment completed count + recalc reliability for both users
    const { data: myData } = await supabase.from("users").select("sessions_completed").eq("id", userId).single();
    if (myData) {
      await supabase.from("users").update({ sessions_completed: (myData.sessions_completed ?? 0) + 1 }).eq("id", userId);
      recalcReliability(userId);
    }
    if (other?.id) {
      const { data: theirData } = await supabase.from("users").select("sessions_completed").eq("id", other.id).single();
      if (theirData) {
        await supabase.from("users").update({ sessions_completed: (theirData.sessions_completed ?? 0) + 1 }).eq("id", other.id);
        recalcReliability(other.id);
      }
    }
    // Also call legacy RPC (best-effort)
    supabase.rpc("increment_sessions_kept", { uid: userId }).then(() => {});
    if (other?.id) supabase.rpc("increment_sessions_kept", { uid: other.id }).then(() => {});
    setSessionCount((prev) => prev + 1);
    loadSession();
  }

  async function noShowSession() {
    if (!session || !userId) return;
    Alert.alert(
      "Session didn't happen?",
      "This will be recorded. It helps build trust in the community.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            await supabase.from("buddy_sessions").update({
              status: "completed",
              no_show: true,
              completed_at: new Date().toISOString(),
              confirmed_by: userId,
            }).eq("id", session.id);
            // Increment no-show counter + recalc reliability for both
            const { data: myData } = await supabase.from("users").select("sessions_no_show").eq("id", userId).single();
            if (myData) {
              await supabase.from("users").update({ sessions_no_show: (myData.sessions_no_show ?? 0) + 1 }).eq("id", userId);
              recalcReliability(userId);
            }
            if (other?.id) {
              const { data: theirData } = await supabase.from("users").select("sessions_no_show").eq("id", other.id).single();
              if (theirData) {
                await supabase.from("users").update({ sessions_no_show: (theirData.sessions_no_show ?? 0) + 1 }).eq("id", other.id);
                recalcReliability(other.id);
              }
            }
            loadSession();
          },
        },
      ]
    );
  }

  // ── Propose session ───────────────────────────────────────────────────────
  async function proposeSession() {
    if (!userId || !other || !sessionDate.trim() || proposing) return;
    setProposing(true);
    const sportValue = sessionSport === "Other" && sessionTitle.trim() ? sessionTitle.trim() : sessionSport;
    await supabase.from("buddy_sessions").insert({
      proposer_id: userId, receiver_id: other.id, match_id: matchId,
      sport: sportValue, session_date: sessionDate.trim(),
      session_time: useTime ? `${String(sessionHour).padStart(2,"0")}:${String(sessionMinute).padStart(2,"0")}` : null,
      location: sessionLocation.trim() || null, notes: null, status: "pending",
    });
    if (sessionDate.trim()) {
      const partnerName = other?.full_name?.split(" ")[0] ?? other?.username ?? "your partner";
      scheduleSessionReminder(partnerName, sessionDate.trim());
    }
    // Notify the receiver
    const { data: me } = await supabase.from("users").select("full_name, username").eq("id", userId).single();
    notifyUser(other.id, {
      type: "session_proposed",
      title: "New Session Proposal 📅",
      body: `${me?.full_name ?? me?.username ?? "Your partner"} wants to do ${sportValue} on ${sessionDate.trim()}`,
      relatedId: matchId,
      data: { type: "session_proposed", matchId },
    });
    // If editing an existing session, cancel it now that new one is saved
    if (editingSessionRef.current) {
      await supabase.from("buddy_sessions").update({ status: "cancelled" }).eq("id", editingSessionRef.current);
      editingSessionRef.current = null;
    }
    setProposing(false);
    setShowWizard(false);
    loadSession();
  }

  // ── Profile popup ────────────────────────────────────────────────────────
  async function openProfile() {
    if (!other) return;
    const { data } = await supabase.from("users")
      .select("id, username, full_name, avatar_url, bio, city, fitness_level, age, sports, current_streak, last_active, is_at_gym, availability")
      .eq("id", other.id).single();
    if (!data) return;
    setSheetUser({
      id: data.id, username: data.username, full_name: data.full_name ?? null,
      avatar_url: data.avatar_url ?? null, bio: data.bio ?? null, city: data.city ?? null,
      fitness_level: data.fitness_level ?? null, age: data.age ?? null, sports: data.sports ?? [],
      current_streak: data.current_streak ?? 0, last_active: data.last_active ?? null,
      is_at_gym: data.is_at_gym ?? false, availability: data.availability ?? null,
      matchScore: 0, reasons: [], isNew: false,
    });
  }

  // ── Messaging ────────────────────────────────────────────────────────────
  async function sendMessage() {
    const trimmed = text.trim();
    if (!trimmed || !userId || sending) return;
    setSending(true);
    try {
      const { error: insertError } = await supabase.from("messages").insert({
        match_id: matchId, sender_id: userId, content: trimmed, read_at: null,
      });
      if (insertError) throw insertError;
      setText("");
      // Notify the other user (push + in-app)
      if (other?.id) {
        const { data: me } = await supabase.from("users").select("full_name, username").eq("id", userId).single();
        notifyUser(other.id, {
          type: "message",
          title: me?.full_name ?? me?.username ?? "New message",
          body: trimmed.length > 80 ? trimmed.slice(0, 77) + "…" : trimmed,
          relatedId: matchId,
          data: { type: "message", matchId },
        }).catch((e: any) => console.warn("[sendMessage] notifyUser threw:", e));
      }
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (err) {
      console.error("[sendMessage] failed:", err);
      Alert.alert("Send Failed", "Your message could not be sent. Please try again.");
      // text is preserved — user can retry
    } finally {
      setSending(false);
    }
  }

  // ── Formatting ────────────────────────────────────────────────────────────
  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function formatDateLabel(iso: string) {
    const d = new Date(iso), today = new Date(), yesterday = new Date();
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

  const otherName  = other?.full_name ?? other?.username ?? "Chat";
  const levelColor = other?.fitness_level ? LEVEL_COLOR[other.fitness_level] ?? null : null;

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

        <TouchableOpacity
          style={s.headerCenter}
          onPress={openProfile}
          activeOpacity={0.75}
        >
          <Avatar url={other?.avatar_url} name={otherName} size={38} />
          <View style={s.headerInfo}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[s.headerName, { color: c.text }]} numberOfLines={1}>{otherName}</Text>
              {levelColor && (
                <View style={[s.levelBadge, { backgroundColor: levelColor+"20", borderColor: levelColor+"50" }]}>
                  <Text style={[s.levelText, { color: levelColor }]}>{other!.fitness_level}</Text>
                </View>
              )}
            </View>
            {sessionCount > 0 && (
              <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 1 }}>
                🏋️ Trained together {sessionCount} time{sessionCount !== 1 ? "s" : ""}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* 3-line menu button */}
        <TouchableOpacity
          style={[s.menuBtn, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}
          onPress={() => setShowActionMenu(true)}
          hitSlop={{ top:8, bottom:8, left:8, right:8 }}
        >
          <Ionicons name="menu-outline" size={20} color={c.textSecondary} />
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
          onNoShow={noShowSession}
          onCancel={session.proposer_id === userId && session.status === "pending" ? cancelSession : undefined}
          onEdit={session.proposer_id === userId && session.status === "pending" ? editSession : undefined}
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
                {!isMine && <Avatar url={other?.avatar_url} name={otherName} size={26} />}
                <View style={[
                  s.bubble,
                  isMine
                    ? { backgroundColor: c.brand, borderBottomRightRadius: 4 }
                    : { backgroundColor: c.bgCard, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: c.border },
                ]}>
                  <Text style={[s.bubbleText, { color: isMine ? "#fff" : c.text }]}>{msg.content}</Text>
                  <View style={s.bubbleMeta}>
                    <Text style={[s.bubbleTime, { color: isMine ? "rgba(255,255,255,0.45)" : c.textFaint }]}>
                      {formatTime(msg.created_at)}
                    </Text>
                    {isMine && (
                      <Text style={{ fontSize: 11, fontWeight: "700", color: msg.read_at ? "#60A5FA" : "rgba(255,255,255,0.45)", letterSpacing: -1 }}>
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

      {/* ── Action menu — centered card ──────────────────────────────── */}
      <Modal
        visible={showActionMenu}
        animationType="fade"
        transparent
        onRequestClose={() => setShowActionMenu(false)}
      >
        <BlurOverlay onPress={() => setShowActionMenu(false)}>
        <View style={am.sheetWrap}>
        <View style={[am.sheet, { backgroundColor: c.bgCard }]}>
          <Text style={[am.sheetTitle, { color: c.text }]}>
            Plan with {other?.full_name?.split(" ")[0] ?? otherName}
          </Text>

          {/* Today */}
          <TouchableOpacity
            style={[am.row, { borderBottomColor: c.border }]}
            onPress={() => { setShowActionMenu(false); openWizard(todayStr()); }}
            activeOpacity={0.75}
          >
            <View style={[am.iconBox, { backgroundColor: "#FF4500" + "18" }]}>
              <Text style={am.rowEmoji}>📅</Text>
            </View>
            <View style={am.rowText}>
              <Text style={[am.rowLabel, { color: c.text }]}>Today</Text>
              <Text style={[am.rowSub, { color: c.textMuted }]}>Plan a session for today</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
          </TouchableOpacity>

          {/* Tomorrow */}
          <TouchableOpacity
            style={[am.row, { borderBottomColor: c.border }]}
            onPress={() => { setShowActionMenu(false); openWizard(tomorrowStr()); }}
            activeOpacity={0.75}
          >
            <View style={[am.iconBox, { backgroundColor: "#007AFF18" }]}>
              <Text style={am.rowEmoji}>🗓</Text>
            </View>
            <View style={am.rowText}>
              <Text style={[am.rowLabel, { color: c.text }]}>Tomorrow</Text>
              <Text style={[am.rowSub, { color: c.textMuted }]}>Plan a session for tomorrow</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
          </TouchableOpacity>

          {/* Propose a session */}
          <TouchableOpacity
            style={[am.row, { borderBottomColor: c.border }]}
            onPress={() => { setShowActionMenu(false); openWizard(); }}
            activeOpacity={0.75}
          >
            <View style={[am.iconBox, { backgroundColor: "#22C55E18" }]}>
              <Text style={am.rowEmoji}>📆</Text>
            </View>
            <View style={am.rowText}>
              <Text style={[am.rowLabel, { color: c.text }]}>Propose a session</Text>
              <Text style={[am.rowSub, { color: c.textMuted }]}>Pick sport, date and time</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
          </TouchableOpacity>

          {/* Completed sessions */}
          <TouchableOpacity
            style={am.row}
            onPress={() => {
              setShowActionMenu(false);
              loadCompletedSessions();
              setShowCompleted(true);
            }}
            activeOpacity={0.75}
          >
            <View style={[am.iconBox, { backgroundColor: "#8B5CF618" }]}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#8B5CF6" />
            </View>
            <View style={am.rowText}>
              <Text style={[am.rowLabel, { color: c.text }]}>Completed sessions</Text>
              <Text style={[am.rowSub, { color: c.textMuted }]}>Sessions you did together</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
          </TouchableOpacity>

          {/* Separator + Unmatch */}
          <View style={[am.divider, { backgroundColor: c.border }]} />
          <TouchableOpacity
            style={am.row}
            onPress={() => {
              setShowActionMenu(false);
              Alert.alert("Unmatch?", "You won't be able to message each other anymore.", [
                { text: "Cancel", style: "cancel" },
                { text: "Unmatch", style: "destructive", onPress: async () => {
                  await supabase.from("matches").update({ status: "declined" }).eq("id", matchId);
                  router.back();
                }},
              ]);
            }}
            activeOpacity={0.75}
          >
            <View style={[am.iconBox, { backgroundColor: "#FF3B3018" }]}>
              <Ionicons name="person-remove-outline" size={18} color="#FF3B30" />
            </View>
            <View style={am.rowText}>
              <Text style={[am.rowLabel, { color: "#FF3B30" }]}>Unmatch</Text>
            </View>
          </TouchableOpacity>

        </View>
        </View>
        </BlurOverlay>
      </Modal>

      {/* ── Session wizard — centered card ───────────────────────────── */}
      <Modal
        visible={showWizard && !showMapPicker}
        animationType="fade"
        transparent
        onRequestClose={() => { editingSessionRef.current = null; setShowWizard(false); }}
      >
        <KeyboardAvoidingView
          style={wz.overlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={20}
        >
          <TouchableOpacity style={wz.backdropArea} activeOpacity={1} onPress={() => { editingSessionRef.current = null; setShowWizard(false); }} />
          <View style={[wz.sheet, { backgroundColor: c.bgCard }]}>

            {/* Handle */}
            <View style={[wz.handle, { backgroundColor: c.border }]} />

            {/* Step header */}
            <View style={wz.stepHeader}>
              {wizardStep > 1 && (
                <TouchableOpacity onPress={() => setWizardStep((s) => (s - 1) as 1|2|3)} hitSlop={10}>
                  <Ionicons name="arrow-back" size={22} color={c.textSecondary} />
                </TouchableOpacity>
              )}
              <View style={wz.stepTitleBox}>
                <Text style={[wz.stepTitle, { color: c.text }]}>
                  {wizardStep === 1 ? "Sport" : wizardStep === 2 ? "Date" : "Details"}
                </Text>
                <Text style={[wz.stepIndicator, { color: c.textMuted }]}>{wizardStep} / 3</Text>
              </View>
              <TouchableOpacity onPress={() => { editingSessionRef.current = null; setShowWizard(false); }} hitSlop={10}>
                <Ionicons name="close" size={22} color={c.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Step dots */}
            <View style={wz.dots}>
              {[1,2,3].map((i) => (
                <View key={i} style={[wz.dot, { backgroundColor: i <= wizardStep ? c.brand : c.border }]} />
              ))}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={wz.content}
              keyboardShouldPersistTaps="handled"
            >

              {/* ─ STEP 1: Sport ─ */}
              {wizardStep === 1 && (
                <>
                  <Text style={[wz.hint, { color: c.textMuted }]}>What are you planning to do?</Text>
                  <View style={wz.sportGrid}>
                    {SPORTS.map((sp) => (
                      <TouchableOpacity
                        key={sp}
                        style={[
                          wz.sportChip,
                          sessionSport === sp
                            ? { backgroundColor: c.brand, borderColor: c.brand }
                            : { backgroundColor: c.bgCardAlt, borderColor: c.border },
                        ]}
                        onPress={() => setSessionSport(sp)}
                        activeOpacity={0.75}
                      >
                        <Text style={[wz.sportText, { color: sessionSport === sp ? "#fff" : c.textSecondary }]}>
                          {sp}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {sessionSport === "Other" && (
                    <>
                      <Text style={[wz.fieldLabel, { color: c.textMuted }]}>Event name</Text>
                      <TextInput
                        style={[wz.textInput, { backgroundColor: c.bgCardAlt, borderColor: sessionTitle.trim() ? c.brand+"80" : c.border, color: c.text }]}
                        value={sessionTitle}
                        onChangeText={setSessionTitle}
                        placeholder="e.g. Parkour, Volleyball, Pilates…"
                        placeholderTextColor={c.textFaint}
                      />
                    </>
                  )}

                  <TouchableOpacity
                    style={[wz.nextBtn, { backgroundColor: c.brand }]}
                    onPress={() => setWizardStep(2)}
                    activeOpacity={0.85}
                  >
                    <Text style={wz.nextBtnText}>Next — Choose date</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </TouchableOpacity>
                </>
              )}

              {/* ─ STEP 2: Date ─ */}
              {wizardStep === 2 && (
                <>
                  <Text style={[wz.hint, { color: c.textMuted }]}>When do you want to meet?</Text>

                  {/* Quick date pills */}
                  <View style={wz.quickRow}>
                    {[
                      { label: "Today",        date: todayStr() },
                      { label: "Tomorrow",     date: tomorrowStr() },
                      { label: "This Sat",     date: nextWeekdayStr(6) },
                      { label: "Next Mon",     date: nextWeekdayStr(1) },
                    ].map(({ label, date }) => (
                      <TouchableOpacity
                        key={label}
                        style={[wz.quickPill, sessionDate === date
                          ? { backgroundColor: c.brand, borderColor: c.brand }
                          : { backgroundColor: c.bgCardAlt, borderColor: c.border }]}
                        onPress={() => setSessionDate(date)}
                        activeOpacity={0.75}
                      >
                        <Text style={[wz.quickPillText, { color: sessionDate === date ? "#fff" : c.textSecondary }]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Full calendar */}
                  <CalendarPicker value={sessionDate} onChange={setSessionDate} colors={c} />

                  <TouchableOpacity
                    style={[wz.nextBtn, { backgroundColor: c.brand }, !sessionDate && { opacity: 0.4 }]}
                    onPress={() => sessionDate && setWizardStep(3)}
                    disabled={!sessionDate}
                    activeOpacity={0.85}
                  >
                    <Text style={wz.nextBtnText}>
                      {sessionDate ? `Next — ${friendlyDate(sessionDate)} ✓` : "Pick a date first"}
                    </Text>
                    {!!sessionDate && <Ionicons name="arrow-forward" size={18} color="#fff" />}
                  </TouchableOpacity>
                </>
              )}

              {/* ─ STEP 3: Details ─ */}
              {wizardStep === 3 && (
                <>
                  {/* Summary of choices */}
                  <View style={[wz.summaryBox, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                    <Text style={[wz.summaryLabel, { color: c.textMuted }]}>Session summary</Text>
                    <Text style={[wz.summaryValue, { color: c.text }]}>
                      {sessionSport === "Other" && sessionTitle.trim() ? sessionTitle.trim() : sessionSport}
                      {"  ·  "}
                      {friendlyDate(sessionDate)}
                    </Text>
                  </View>

                  {/* Time — optional */}
                  <View style={wz.rowBetween}>
                    <Text style={[wz.fieldLabel, { color: c.textMuted }]}>Time (optional)</Text>
                    <TouchableOpacity
                      style={[wz.toggleBtn, { backgroundColor: useTime ? c.brand : c.bgCardAlt, borderColor: useTime ? c.brand : c.border }]}
                      onPress={() => setUseTime((v) => !v)}
                    >
                      <Text style={[wz.toggleText, { color: useTime ? "#fff" : c.textMuted }]}>
                        {useTime ? "Remove" : "Add time"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {useTime && (
                    <View style={[wz.timePicker, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE[16] }}>
                        <TimeColumn value={sessionHour}   max={23} step={1} onChange={setSessionHour}   colors={c} />
                        <Text style={[tp.colon, { color: c.text }]}>:</Text>
                        <TimeColumn value={sessionMinute} max={55} step={5} onChange={setSessionMinute} colors={c} />
                      </View>
                    </View>
                  )}

                  {/* Location — optional */}
                  <Text style={[wz.fieldLabel, { color: c.textMuted }]}>Location (optional)</Text>
                  <View style={wz.locationRow}>
                    <TextInput
                      style={[wz.textInputFlex, { backgroundColor: c.bgCardAlt, borderColor: c.border, color: c.text }]}
                      value={sessionLocation}
                      onChangeText={setSessionLocation}
                      placeholder="e.g. Planet Fitness, Main St"
                      placeholderTextColor={c.textFaint}
                    />
                    <TouchableOpacity
                      style={[wz.mapBtn, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}
                      onPress={() => setShowMapPicker(true)}
                      hitSlop={8}
                    >
                      <Text style={{ fontSize: 18 }}>🗺️</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Existing session warning */}
                  {session && session.status !== "declined" && session.status !== "confirmed" && (
                    <View style={[wz.existingNote, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                      <Icon name="clock" size={13} color={c.textMuted} />
                      <Text style={[wz.existingNoteText, { color: c.textMuted }]}>
                        You already have a {session.sport} session planned.
                      </Text>
                    </View>
                  )}

                  {/* Propose button */}
                  <TouchableOpacity
                    style={[wz.proposeBtn, { backgroundColor: c.brand }, proposing && { opacity: 0.6 }]}
                    onPress={proposeSession}
                    disabled={proposing}
                    activeOpacity={0.85}
                  >
                    {proposing
                      ? <ActivityIndicator color="#fff" size="small" />
                      : (
                        <>
                          <Ionicons name="calendar-outline" size={18} color="#fff" />
                          <Text style={wz.proposeBtnText}>Send session proposal</Text>
                        </>
                      )
                    }
                  </TouchableOpacity>
                </>
              )}

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Completed sessions modal ─────────────────────────────────── */}
      <Modal
        visible={showCompleted}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCompleted(false)}
      >
        <TouchableOpacity
          style={am.backdrop}
          activeOpacity={1}
          onPress={() => setShowCompleted(false)}
        />
        <View style={[am.sheet, { backgroundColor: c.bgCard }]}>
          <Text style={[am.sheetTitle, { color: c.text }]}>
            Completed sessions
          </Text>

          {completedSessions.length === 0 ? (
            <View style={cs.empty}>
              <Text style={[cs.emptyEmoji]}>🏋️</Text>
              <Text style={[cs.emptyText, { color: c.textMuted }]}>No completed sessions yet</Text>
              <Text style={[cs.emptySub, { color: c.textFaint }]}>When you confirm a session happened it will appear here</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: SCREEN_H * 0.4 }}>
              {completedSessions.map((s, i) => (
                <View key={s.id} style={[cs.row, { borderBottomColor: c.border, borderBottomWidth: i < completedSessions.length - 1 ? StyleSheet.hairlineWidth : 0 }]}>
                  <View style={[cs.badge, { backgroundColor: "#22C55E18" }]}>
                    <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                  </View>
                  <View style={cs.rowText}>
                    <Text style={[cs.sport, { color: c.text }]}>{s.sport}</Text>
                    <Text style={[cs.date, { color: c.textMuted }]}>
                      {new Date(s.session_date + "T12:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={{ height: 16 }} />
        </View>
      </Modal>

      {/* ── Map picker — centered card with ~1cm margin top/bottom ─────── */}
      <Modal
        visible={showMapPicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowMapPicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 12, paddingVertical: 36, justifyContent: "center" }}>
          <View style={{ flex: 1, borderRadius: 20, overflow: "hidden" }}>
            <MapLocationPicker
              colors={c}
              onSelect={(loc) => { setSessionLocation(loc); setShowMapPicker(false); }}
              onClose={() => setShowMapPicker(false)}
            />
          </View>
        </View>
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
const CELL_SIZE = Math.floor((SCREEN_W - 48 - 6 * 4) / 7);

const cal = StyleSheet.create({
  root:      { paddingVertical: SPACE[8] },
  nav:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE[10] },
  navArrow:  { fontSize: 26, lineHeight: 30, fontWeight: "300" },
  monthLabel:{ fontSize: FONT.size.base, fontWeight: FONT.weight.extrabold },
  row:       { flexDirection: "row", marginBottom: 2 },
  dayHeader: { width: CELL_SIZE, textAlign: "center", fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, paddingBottom: 4 },
  cell:      { width: CELL_SIZE, height: CELL_SIZE, alignItems: "center", justifyContent: "center" },
  dayText:   { fontSize: FONT.size.sm },
});

// ─── Time picker styles ───────────────────────────────────────────────────────
const tp = StyleSheet.create({
  col:       { alignItems: "center", gap: SPACE[6] },
  arrow:     { padding: SPACE[8] },
  arrowText: { fontSize: 16, lineHeight: 20 },
  val:       { fontSize: 36, fontWeight: FONT.weight.black, width: 60, textAlign: "center" },
  colon:     { fontSize: 36, fontWeight: FONT.weight.black, marginBottom: 2 },
});

// ─── Action menu styles ───────────────────────────────────────────────────────
const am = StyleSheet.create({
  backdrop:   { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" },
  sheetWrap:  { flex: 1, justifyContent: "center", paddingHorizontal: SPACE[24] },
  sheet:      { borderRadius: 20, paddingHorizontal: SPACE[20], paddingTop: SPACE[20], paddingBottom: SPACE[8] },
  sheetTitle: { fontSize: 15, fontWeight: "700", textAlign: "center", marginBottom: SPACE[16] },
  row:        { flexDirection: "row", alignItems: "center", paddingVertical: SPACE[14], gap: SPACE[14], borderBottomWidth: StyleSheet.hairlineWidth },
  iconBox:    { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowEmoji:   { fontSize: 18 },
  rowText:    { flex: 1 },
  rowLabel:   { fontSize: 16, fontWeight: "600" },
  rowSub:     { fontSize: 13, marginTop: 1 },
  divider:    { height: StyleSheet.hairlineWidth, marginVertical: SPACE[4] },
});

// ─── Wizard styles ────────────────────────────────────────────────────────────
const wz = StyleSheet.create({
  overlay:     { flex: 1, justifyContent: "center", alignItems: "center", padding: SPACE[20], backgroundColor: "rgba(0,0,0,0.50)" },
  backdropArea:{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  sheet:       { width: "100%", borderRadius: 24, maxHeight: SCREEN_H * 0.90 },
  handle:      { width: 0, height: 0 }, // not needed for centered card
  stepHeader:  { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE[20], paddingVertical: SPACE[16], gap: SPACE[12] },
  stepTitleBox:{ flex: 1, alignItems: "center" },
  stepTitle:   { fontSize: 18, fontWeight: "700" },
  stepIndicator:{ fontSize: 12, marginTop: 2 },
  dots:        { flexDirection: "row", justifyContent: "center", gap: SPACE[8], marginBottom: SPACE[16] },
  dot:         { width: 28, height: 3, borderRadius: 2 },
  content:     { paddingHorizontal: SPACE[20], paddingBottom: SPACE[40], gap: SPACE[16] },

  hint:        { fontSize: 15, marginBottom: -4 },
  fieldLabel:  { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },

  sportGrid:   { flexDirection: "row", flexWrap: "wrap", gap: SPACE[8] },
  sportChip:   { paddingHorizontal: SPACE[14], paddingVertical: SPACE[10], borderRadius: RADIUS.pill, borderWidth: 1 },
  sportText:   { fontSize: 14, fontWeight: "600" },

  quickRow:    { flexDirection: "row", flexWrap: "wrap", gap: SPACE[8] },
  quickPill:   { paddingHorizontal: SPACE[12], paddingVertical: SPACE[8], borderRadius: RADIUS.pill, borderWidth: 1 },
  quickPillText:{ fontSize: 13, fontWeight: "600" },

  summaryBox:  { borderRadius: RADIUS.md, borderWidth: 1, padding: SPACE[14] },
  summaryLabel:{ fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  summaryValue:{ fontSize: 16, fontWeight: "700" },

  rowBetween:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleBtn:   { paddingHorizontal: SPACE[12], paddingVertical: SPACE[8], borderRadius: RADIUS.pill, borderWidth: 1 },
  toggleText:  { fontSize: 13, fontWeight: "600" },
  timePicker:  { borderRadius: RADIUS.xl, borderWidth: 1, paddingVertical: SPACE[20] },

  locationRow: { flexDirection: "row", gap: SPACE[8], alignItems: "center" },
  textInputFlex:{ flex: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACE[14], paddingVertical: SPACE[12], fontSize: FONT.size.md, borderWidth: 1 },
  textInput:   { borderRadius: RADIUS.md, paddingHorizontal: SPACE[14], paddingVertical: SPACE[12], fontSize: FONT.size.md, borderWidth: 1 },
  mapBtn:      { width: 46, height: 46, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },

  existingNote:{ flexDirection: "row", alignItems: "flex-start", gap: SPACE[8], padding: SPACE[12], borderRadius: RADIUS.md, borderWidth: 1 },
  existingNoteText:{ flex: 1, fontSize: FONT.size.xs },

  nextBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE[8], borderRadius: RADIUS.lg, paddingVertical: SPACE[16] },
  nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  proposeBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE[8], borderRadius: RADIUS.lg, paddingVertical: SPACE[16], marginTop: SPACE[4] },
  proposeBtnText:{ color: "#fff", fontSize: 16, fontWeight: "700" },
});

// ─── Completed sessions styles ───────────────────────────────────────────────
const cs = StyleSheet.create({
  empty:     { alignItems: "center", paddingVertical: SPACE[24], gap: SPACE[8] },
  emptyEmoji:{ fontSize: 32 },
  emptyText: { fontSize: 15, fontWeight: "600" },
  emptySub:  { fontSize: 13, textAlign: "center", paddingHorizontal: SPACE[16] },
  row:       { flexDirection: "row", alignItems: "center", paddingVertical: SPACE[12], gap: SPACE[12] },
  badge:     { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowText:   { flex: 1 },
  sport:     { fontSize: 15, fontWeight: "600" },
  date:      { fontSize: 13, marginTop: 2 },
});

// ─── Main styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE[12], paddingVertical: SPACE[10], borderBottomWidth: 1, gap: SPACE[10] },
  backBtn:      { padding: SPACE[4] },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACE[10] },
  headerInfo:   { flex: 1, gap: 3 },
  headerName:   { fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },
  levelBadge:   { alignSelf: "flex-start", paddingHorizontal: SPACE[6], paddingVertical: 2, borderRadius: RADIUS.pill, borderWidth: 1 },
  levelText:    { fontSize: FONT.size.xs, fontWeight: FONT.weight.extrabold, textTransform: "capitalize", letterSpacing: 0.3 },
  menuBtn:      { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },

  messageList:  { padding: SPACE[16], paddingBottom: SPACE[8], gap: 2 },
  dateLabel:    { textAlign: "center", fontSize: FONT.size.xs, marginVertical: SPACE[16], fontWeight: FONT.weight.semibold },
  bubbleRow:    { flexDirection: "row", alignItems: "flex-end", gap: SPACE[8], marginVertical: 2 },
  bubbleRowMine:{ flexDirection: "row-reverse" },
  bubble:       { maxWidth: "74%", borderRadius: 18, paddingHorizontal: SPACE[14], paddingVertical: SPACE[10], gap: 2 },
  bubbleText:   { fontSize: FONT.size.md, lineHeight: FONT.size.md * 1.4 },
  bubbleMeta:   { flexDirection: "row", alignItems: "center", gap: SPACE[4], alignSelf: "flex-end" },
  bubbleTime:   { fontSize: FONT.size.xs },

  emptyChat:    { alignItems: "center", paddingTop: SPACE[60], gap: SPACE[12] },
  emptyChatName:{ fontSize: FONT.size.lg, fontWeight: FONT.weight.extrabold },
  emptyChatHint:{ fontSize: FONT.size.sm, textAlign: "center", paddingHorizontal: SPACE[32] },

  inputRow:     { flexDirection: "row", alignItems: "flex-end", padding: SPACE[10], gap: SPACE[8], borderTopWidth: 1 },
  input:        { flex: 1, borderRadius: RADIUS.xl, paddingHorizontal: SPACE[16], paddingVertical: SPACE[10], fontSize: FONT.size.md, maxHeight: 120, borderWidth: 1 },
  sendBtn:      { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
