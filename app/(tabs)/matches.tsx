/**
 * Connections
 *
 * Shows pending match requests and accepted connections.
 * Session scheduling is available here as a fallback, but the primary
 * coordination surface is the Chat screen.
 *
 * Leaderboard has been removed — it does not belong in the connections context.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorState } from "../../components/ui/ErrorState";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, FlatList, Alert, Modal, TextInput, ScrollView, RefreshControl,
} from "react-native";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { notifyMatchAccepted } from "../../lib/notifications";
import { notifyUser } from "../../lib/push";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../../lib/theme";
import { useAppData } from "../../lib/appDataContext";
import { Icon } from "../../components/Icon";
import { Avatar } from "../../components/Avatar";
import { ProfileSheet } from "../../components/discover/ProfileSheet";
import { toDiscoverUser, DISCOVER_USER_COLUMNS, type DiscoverUser } from "../../components/discover/PersonCard";

const SPORTS = ["Gym", "Running", "Cycling", "Swimming", "Soccer", "Basketball", "Tennis", "Boxing", "Yoga", "CrossFit", "Hiking", "Other"];

type MatchUser = {
  id:             string;
  username:       string;
  full_name:      string | null;
  fitness_level:  string | null;
  city:           string | null;
  avatar_url:     string | null;
  current_streak: number;
};

type Match = {
  id:         string;
  status:     "pending" | "accepted" | "declined";
  sender_id:  string;
  other_user: MatchUser;
};

type BuddySession = {
  id:           string;
  proposer_id:  string;
  receiver_id:  string;
  match_id:     string;
  sport:        string;
  location:     string | null;
  session_date: string;
  session_time: string | null;
  notes:        string | null;
  status:       string;
};

export default function MatchesScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { appUser, appUserLoading } = useAppData();

  const [pending,         setPending]         = useState<Match[]>([]);
  const [accepted,        setAccepted]        = useState<Match[]>([]);
  const [buddySessions,   setBuddySessions]   = useState<BuddySession[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(false);

  useEffect(() => {
    if (!loading || appUserLoading) return;
    const t = setTimeout(() => { setLoading(false); setError(true); }, 30_000);
    return () => clearTimeout(t);
  }, [loading, appUserLoading]);

  const [refreshing,      setRefreshing]      = useState(false);
  const [myId,            setMyId]            = useState<string | null>(null);

  const lastLoadRef = useRef(0);
  const loadingRef  = useRef(false);
  const mountedRef  = useRef(true);
  const STALE_MS = 5 * 60_000; // 5 min cache per tab

  // Session scheduling
  const [sessionCounts,   setSessionCounts]   = useState<Record<string, number>>({});
  const [schedulingMatch, setSchedulingMatch] = useState<Match | null>(null);
  const [sessionSport,    setSessionSport]    = useState("Gym");
  const [sessionDate,     setSessionDate]     = useState("");
  const [sessionTime,     setSessionTime]     = useState("");
  const [sessionLocation, setSessionLocation] = useState("");
  const [sessionNotes,    setSessionNotes]    = useState("");
  const [sendingSession,  setSendingSession]  = useState(false);
  const [respondingId,    setRespondingId]    = useState<string | null>(null);
  const [sheetUser,       setSheetUser]       = useState<DiscoverUser | null>(null);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
    if (mountedRef.current) setError(false);
    if (!isRefresh && mountedRef.current) setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (mountedRef.current) setMyId(user.id);

    const [{ data: incomingRows }, { data: acceptedRows }] = await Promise.all([
      supabase.from("matches")
        .select("id, status, sender_id")
        .eq("receiver_id", user.id).eq("status", "pending"),
      supabase.from("matches")
        .select("id, status, sender_id, receiver_id")
        .eq("status", "accepted")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
    ]);

    // Collect all user IDs we need to fetch
    const userIdsToFetch = new Set<string>();
    (incomingRows ?? []).forEach((m: any) => userIdsToFetch.add(m.sender_id));
    (acceptedRows ?? []).forEach((m: any) => {
      const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      userIdsToFetch.add(otherId);
    });

    let userMap = new Map<string, MatchUser>();
    if (userIdsToFetch.size > 0) {
      const { data: userRows } = await supabase
        .from("users")
        .select("id, username, full_name, fitness_level, city, avatar_url, current_streak, banned_at")
        .in("id", [...userIdsToFetch])
        .is("banned_at", null);
      userMap = new Map((userRows ?? []).map((u: any) => [u.id, u]));
    }

    setPending((incomingRows ?? [])
      .filter((m: any) => userMap.has(m.sender_id))
      .map((m: any) => ({
        id: m.id, status: m.status, sender_id: m.sender_id, other_user: userMap.get(m.sender_id)!,
      })));

    const acceptedMatches: Match[] = (acceptedRows ?? [])
      .map((m: any) => {
        const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        return { id: m.id, status: m.status, sender_id: m.sender_id, other_user: userMap.get(otherId)! };
      })
      .filter((m: any) => m.other_user);
    const seen = new Set<string>();
    setAccepted(acceptedMatches.filter((m) => {
      if (!m.other_user || seen.has(m.other_user.id)) return false;
      seen.add(m.other_user.id);
      return true;
    }));

    await loadBuddySessions(user.id);

    // Load completed session counts per match
    const matchIds = (acceptedRows ?? []).map((m: any) => m.id);
    if (matchIds.length > 0) {
      const { data: completedRows } = await supabase
        .from("buddy_sessions")
        .select("match_id")
        .in("match_id", matchIds)
        .eq("status", "completed");
      const counts: Record<string, number> = {};
      (completedRows ?? []).forEach((r: any) => {
        counts[r.match_id] = (counts[r.match_id] || 0) + 1;
      });
      setSessionCounts(counts);
    }
    if (mountedRef.current) lastLoadRef.current = Date.now();
    } catch (err) {
      console.error("[Matches] load failed:", err);
      if (!mountedRef.current) return;
      if (isRefresh) {
        Alert.alert("Error", "Could not refresh. Please try again.");
      } else {
        setError(true);
      }
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  async function loadBuddySessions(userId: string) {
    const { data } = await supabase
      .from("buddy_sessions")
      .select("*")
      .or(`proposer_id.eq.${userId},receiver_id.eq.${userId}`)
      .in("status", ["pending", "accepted"])
      .order("session_date", { ascending: true });
    setBuddySessions((data as BuddySession[]) ?? []);
  }

  useFocusEffect(useCallback(() => {
    const elapsed = Date.now() - lastLoadRef.current;
    if (elapsed > STALE_MS || pending.length + accepted.length === 0) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, pending.length, accepted.length]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  async function respondToMatch(matchId: string, status: "accepted" | "declined") {
    if (respondingId) return;
    setRespondingId(matchId);
    try {
      const match = pending.find((p) => p.id === matchId);
      await supabase.from("matches").update({ status }).eq("id", matchId);
      if (status === "accepted" && match) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const partnerName = match.other_user.full_name ?? match.other_user.username;
        notifyMatchAccepted(partnerName, matchId);
        notifyUser(match.sender_id, {
          type: "match_accepted",
          title: "Match Accepted! 🎉",
          body: `${appUser?.full_name ?? appUser?.username ?? "Someone"} accepted your request. Start chatting!`,
          relatedId: matchId,
          data: { type: "match_accepted", matchId },
        });
      }
      await load();
    } catch (err) {
      console.error("[Matches] respondToMatch failed:", err);
    } finally {
      setRespondingId(null);
    }
  }

  async function proposeSession() {
    if (!schedulingMatch || !myId || !sessionDate.trim()) return;
    setSendingSession(true);
    await supabase.from("buddy_sessions").insert({
      proposer_id:  myId,
      receiver_id:  schedulingMatch.other_user.id,
      match_id:     schedulingMatch.id,
      sport:        sessionSport,
      location:     sessionLocation.trim() || null,
      session_date: sessionDate.trim(),
      session_time: sessionTime.trim() || null,
      notes:        sessionNotes.trim() || null,
      status:       "pending",
    });
    await loadBuddySessions(myId);
    setSendingSession(false);
    setSchedulingMatch(null);
    setSessionSport("Gym"); setSessionDate(""); setSessionTime("");
    setSessionLocation(""); setSessionNotes("");
  }

  async function respondToSession(sessionId: string, accept: boolean) {
    await supabase.from("buddy_sessions")
      .update({ status: accept ? "accepted" : "declined" })
      .eq("id", sessionId);
    if (myId) await loadBuddySessions(myId);
  }

  async function openProfile(userId: string) {
    const { data } = await supabase
      .from("users")
      .select(DISCOVER_USER_COLUMNS)
      .eq("id", userId)
      .single();
    if (!data) return;
    setSheetUser(toDiscoverUser(data));
  }

  function getSessionForMatch(matchId: string) {
    return buddySessions.find((s) => s.match_id === matchId);
  }

  function getSessionLabel(session: BuddySession) {
    const time = session.session_time ? ` · ${session.session_time}` : "";
    const loc  = session.location ? `  ·  📍 ${session.location}` : "";
    return `${session.sport} · ${session.session_date}${time}${loc}`;
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
        <ErrorState onRetry={load} message="Could not load matches." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Icon name="back" size={24} color={c.textSecondary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: c.text }]}>Connections</Text>
      </View>

      <FlatList
        data={accepted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} />}
        ListHeaderComponent={
          <>
            {/* Pending requests */}
            {pending.length > 0 && (
              <View style={{ marginBottom: SPACE[20] }}>
                <Text style={[s.sectionLabel, { color: c.textMuted }]}>
                  REQUESTS  <Text style={{ color: c.brand }}>{pending.length}</Text>
                </Text>
                {pending.map((match) => (
                  <TouchableOpacity
                    key={match.id}
                    style={[s.pendingCard, { backgroundColor: c.bgCard, borderColor: c.brandBorder }]}
                    onPress={() => openProfile(match.other_user.id)}
                    activeOpacity={0.8}
                  >
                    <Avatar url={match.other_user.avatar_url} name={match.other_user.username} size={46} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.cardName, { color: c.text }]}>{match.other_user.full_name ?? match.other_user.username}</Text>
                      <Text style={[s.cardSub, { color: c.textMuted }]}>
                        @{match.other_user.username}{match.other_user.city ? `  ·  ${match.other_user.city}` : ""}
                      </Text>
                    </View>
                    <View style={s.actionRow}>
                      {respondingId === match.id ? (
                        <ActivityIndicator color={c.brand} size="small" style={{ paddingHorizontal: SPACE[20] }} />
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[s.declineBtn, { borderColor: c.borderMedium }]}
                            onPress={() => respondToMatch(match.id, "declined")}
                            disabled={!!respondingId}
                          >
                            <Icon name="close" size={16} color={c.textMuted} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[s.acceptBtn, { backgroundColor: c.brand }]}
                            onPress={() => respondToMatch(match.id, "accepted")}
                            disabled={!!respondingId}
                          >
                            <Icon name="checkActive" size={16} color="#fff" />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={[s.sectionLabel, { color: c.textMuted }]}>
              CONNECTIONS  <Text style={{ color: c.brand }}>{accepted.length}</Text>
            </Text>
          </>
        }
        renderItem={({ item: match }) => {
          const session = getSessionForMatch(match.id);
          const isProposer = session?.proposer_id === myId;
          return (
            <View style={[s.matchCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              <View style={s.matchTop}>
                <Avatar url={match.other_user.avatar_url} name={match.other_user.username} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardName, { color: c.text }]}>{match.other_user.full_name ?? match.other_user.username}</Text>
                  <Text style={[s.cardSub, { color: c.textMuted }]}>@{match.other_user.username}</Text>
                  {(sessionCounts[match.id] ?? 0) > 0 && (
                    <Text style={{ fontSize: 11, color: PALETTE.success, marginTop: 2, fontWeight: "500" }}>
                      🏋️ Trained together {sessionCounts[match.id]} time{sessionCounts[match.id] !== 1 ? "s" : ""}
                    </Text>
                  )}
                </View>
                <View style={s.matchActions}>
                  <TouchableOpacity
                    style={[s.chatBtn, { backgroundColor: c.brand }]}
                    onPress={() => router.push(`/chat/${match.id}` as any)}
                  >
                    <Icon name="chatActive" size={18} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.schedBtn, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}
                    onPress={() => setSchedulingMatch(match)}
                  >
                    <Icon name="calendar" size={18} color={c.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              {session && (
                <View style={[
                  s.sessionCard,
                  { borderColor: session.status === "accepted" ? PALETTE.success : c.border },
                  { backgroundColor: session.status === "accepted" ? PALETTE.successSubtle : c.bgCardAlt },
                ]}>
                  <Text style={[s.sessionText, { color: c.textSecondary }]}>{getSessionLabel(session)}</Text>
                  {session.status === "accepted" ? (
                    <Text style={[s.sessionConfirmed, { color: PALETTE.success }]}>✓ Confirmed</Text>
                  ) : isProposer ? (
                    <Text style={[s.sessionPending, { color: c.textMuted }]}>Waiting for response…</Text>
                  ) : (
                    <View style={s.sessionActions}>
                      <TouchableOpacity
                        style={[s.sessionDeclineBtn, { borderColor: c.borderMedium }]}
                        onPress={() => respondToSession(session.id, false)}
                      >
                        <Text style={[s.sessionDeclineTxt, { color: c.textMuted }]}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.sessionAcceptBtn, { backgroundColor: c.brand }]}
                        onPress={() => respondToSession(session.id, true)}
                      >
                        <Text style={s.sessionAcceptTxt}>Accept</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Icon name="matchActive" size={48} color={c.textFaint} />
            <Text style={[s.emptyTitle, { color: c.text }]}>No connections yet</Text>
            <Text style={[s.emptyText, { color: c.textMuted }]}>Go to Discover and connect with partners!</Text>
            <TouchableOpacity
              style={[s.discoverBtn, { backgroundColor: c.brand }]}
              onPress={() => router.push("/(tabs)/discover")}
            >
              <Text style={s.discoverBtnText}>Discover Partners</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Schedule Session Modal */}
      <Modal visible={!!schedulingMatch} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[s.modal, { backgroundColor: c.bg }]}>
          <View style={[s.modalHeader, { borderBottomColor: c.border }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>
              Schedule with {schedulingMatch?.other_user.full_name ?? schedulingMatch?.other_user.username}
            </Text>
            <TouchableOpacity onPress={() => setSchedulingMatch(null)}>
              <Icon name="close" size={22} color={c.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={[s.fieldLabel, { color: c.textMuted }]}>Sport</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACE[16] }}>
              <View style={{ flexDirection: "row", gap: SPACE[8] }}>
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
                  >
                    <Text style={[s.sportChipText, { color: sessionSport === sp ? c.brand : c.textSecondary }]}>{sp}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={[s.fieldLabel, { color: c.textMuted }]}>Date *</Text>
            <TextInput
              style={[s.input, { backgroundColor: c.bgCardAlt, borderColor: c.border, color: c.text }]}
              value={sessionDate}
              onChangeText={setSessionDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={c.textFaint}
            />

            <Text style={[s.fieldLabel, { color: c.textMuted, marginTop: SPACE[14] }]}>Time (optional)</Text>
            <TextInput
              style={[s.input, { backgroundColor: c.bgCardAlt, borderColor: c.border, color: c.text }]}
              value={sessionTime}
              onChangeText={setSessionTime}
              placeholder="e.g. 18:00"
              placeholderTextColor={c.textFaint}
            />

            <Text style={[s.fieldLabel, { color: c.textMuted, marginTop: SPACE[14] }]}>Location (optional)</Text>
            <TextInput
              style={[s.input, { backgroundColor: c.bgCardAlt, borderColor: c.border, color: c.text }]}
              value={sessionLocation}
              onChangeText={setSessionLocation}
              placeholder="e.g. Planet Fitness, Main St"
              placeholderTextColor={c.textFaint}
            />

            <Text style={[s.fieldLabel, { color: c.textMuted, marginTop: SPACE[14] }]}>Notes (optional)</Text>
            <TextInput
              style={[s.input, { height: 80, textAlignVertical: "top", paddingTop: SPACE[12], backgroundColor: c.bgCardAlt, borderColor: c.border, color: c.text }]}
              value={sessionNotes}
              onChangeText={setSessionNotes}
              placeholder="What should they know?"
              placeholderTextColor={c.textFaint}
              multiline
            />

            <TouchableOpacity
              style={[s.proposeBtn, { backgroundColor: c.brand }, (!sessionDate.trim() || sendingSession) && { opacity: 0.4 }]}
              onPress={proposeSession}
              disabled={!sessionDate.trim() || sendingSession}
            >
              {sendingSession
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.proposeBtnText}>Propose Session</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Profile Sheet */}
      <ProfileSheet
        user={sheetUser}
        status="none"
        onConnect={() => {}}
        onClose={() => setSheetUser(null)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:             { flex: 1 },
  header:           { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE[16], paddingTop: SPACE[12], paddingBottom: SPACE[8], borderBottomWidth: 1, gap: SPACE[12] },
  backBtn:          { padding: SPACE[4] },
  title:            { fontSize: FONT.size.xxl, fontWeight: FONT.weight.black, letterSpacing: -0.3, flex: 1 },
  list:             { paddingHorizontal: SPACE[16], paddingTop: SPACE[16], paddingBottom: SPACE[40] },
  sectionLabel:     { fontSize: FONT.size.xs, fontWeight: FONT.weight.extrabold, textTransform: "uppercase", letterSpacing: 1, marginBottom: SPACE[10] },
  pendingCard:      { flexDirection: "row", alignItems: "center", borderRadius: RADIUS.lg, padding: SPACE[12], marginBottom: SPACE[8], borderWidth: 1, gap: SPACE[10] },
  matchCard:        { borderRadius: RADIUS.xl, padding: SPACE[14], marginBottom: SPACE[10], borderWidth: 1, gap: SPACE[10] },
  matchTop:         { flexDirection: "row", alignItems: "center", gap: SPACE[12] },
  cardName:         { fontSize: FONT.size.md, fontWeight: FONT.weight.bold },
  cardSub:          { fontSize: FONT.size.sm, marginTop: 2 },
  matchActions:     { flexDirection: "row", gap: SPACE[8] },
  chatBtn:          { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  schedBtn:         { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  actionRow:        { flexDirection: "row", gap: SPACE[8] },
  declineBtn:       { width: 36, height: 36, borderRadius: RADIUS.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  acceptBtn:        { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  sessionCard:      { borderRadius: RADIUS.md, padding: SPACE[10], borderWidth: 1, gap: SPACE[8] },
  sessionText:      { fontSize: FONT.size.sm },
  sessionConfirmed: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
  sessionPending:   { fontSize: FONT.size.xs },
  sessionActions:   { flexDirection: "row", gap: SPACE[8] },
  sessionDeclineBtn:{ flex: 1, paddingVertical: SPACE[6], borderRadius: RADIUS.sm, borderWidth: 1, alignItems: "center" },
  sessionDeclineTxt:{ fontSize: FONT.size.sm, fontWeight: FONT.weight.medium },
  sessionAcceptBtn: { flex: 1, paddingVertical: SPACE[6], borderRadius: RADIUS.sm, alignItems: "center" },
  sessionAcceptTxt: { color: "#fff", fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  empty:            { alignItems: "center", paddingTop: 80, gap: SPACE[12], paddingHorizontal: SPACE[32] },
  emptyTitle:       { fontSize: FONT.size.xl, fontWeight: FONT.weight.extrabold },
  emptyText:        { fontSize: FONT.size.sm, textAlign: "center" },
  discoverBtn:      { borderRadius: RADIUS.lg, paddingHorizontal: SPACE[28], paddingVertical: SPACE[12], marginTop: SPACE[8] },
  discoverBtnText:  { color: "#fff", fontWeight: FONT.weight.bold, fontSize: FONT.size.md },

  // Modal
  modal:            { flex: 1 },
  modalHeader:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: SPACE[20], paddingVertical: SPACE[16], borderBottomWidth: 1 },
  modalTitle:       { fontSize: FONT.size.lg, fontWeight: FONT.weight.extrabold, flex: 1, marginRight: SPACE[12] },
  modalBody:        { padding: SPACE[20], gap: SPACE[8] },
  fieldLabel:       { fontSize: FONT.size.xs, fontWeight: FONT.weight.extrabold, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: SPACE[8] },
  input:            { borderRadius: RADIUS.lg, paddingHorizontal: SPACE[16], paddingVertical: SPACE[14], fontSize: FONT.size.md, borderWidth: 1 },
  sportChip:        { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[14], paddingVertical: SPACE[8], borderWidth: 1 },
  sportChipText:    { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  proposeBtn:       { borderRadius: RADIUS.xl, paddingVertical: SPACE[16], alignItems: "center", marginTop: SPACE[8] },
  proposeBtnText:   { color: "#fff", fontWeight: FONT.weight.extrabold, fontSize: FONT.size.lg },
});
