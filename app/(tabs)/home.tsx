/**
 * Home Screen — data + orchestration only.
 * UI is fully delegated to components/home/*.
 *
 * Priority logic for the primary action card:
 *   1. confirmed session today
 *   2. pending session request
 *   3. unread messages
 *   4. pending match request
 *   5. at gym + not logged
 *   6. not logged (streak at risk)
 *   7. all caught up
 */

import { useCallback, useEffect, useState } from "react";
import { ScrollView, ActivityIndicator, Alert, RefreshControl, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useTheme, SPACE } from "../../lib/theme";

import { HomeHeader }             from "../../components/home/HomeHeader";
import { PrimaryActionCard }      from "../../components/home/PrimaryActionCard";
import { PendingRequestsSection } from "../../components/home/PendingRequestsSection";
import { BestMatchesSection }     from "../../components/home/BestMatchesSection";
import { CirclesPreviewSection }  from "../../components/home/CirclesPreviewSection";
import { MomentumStrip }          from "../../components/home/MomentumStrip";
import { QuickActionsSection }    from "../../components/home/QuickActionsSection";

import {
  HomeProfile, PendingRequest, SuggestedUser, SessionInfo, CirclePreview,
  PrimaryAction, computePrimaryAction, buildMatchReasons, localToday,
} from "../../components/home/types";

export default function HomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [profile,           setProfile]           = useState<HomeProfile | null>(null);
  const [pendingRequests,   setPendingRequests]   = useState<PendingRequest[]>([]);
  const [suggested,         setSuggested]         = useState<SuggestedUser[]>([]);
  const [circles,           setCircles]           = useState<CirclePreview[]>([]);
  const [confirmedSessions, setConfirmedSessions] = useState<SessionInfo[]>([]);
  const [pendingSessions,   setPendingSessions]   = useState<SessionInfo[]>([]);
  const [unreadCount,       setUnreadCount]       = useState(0);
  const [loading,           setLoading]           = useState(true);
  const [refreshing,        setRefreshing]        = useState(false);
  const [gymToggling,       setGymToggling]       = useState(false);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today    = localToday();

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const uid = user.id;

    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Phase 1 — parallel queries
    const [
      { data: profileData },
      { count: matchCount },
      { count: workoutMonth },
      { data: pendingData },
      { data: likedData },
      { data: sessionData },
      { data: circleData },
    ] = await Promise.all([
      supabase.from("users")
        .select("id, username, full_name, current_streak, last_checkin_date, is_at_gym, gym_checkin_at, sports, fitness_level, city, availability")
        .eq("id", uid).single(),
      supabase.from("matches").select("*", { count: "exact", head: true })
        .eq("status", "accepted").or(`sender_id.eq.${uid},receiver_id.eq.${uid}`),
      supabase.from("workouts").select("*", { count: "exact", head: true })
        .eq("user_id", uid).gte("logged_at", monthAgo),
      supabase.from("matches")
        .select("id, sender_id, sender:users!matches_sender_id_fkey(id, username, full_name, city, fitness_level)")
        .eq("receiver_id", uid).eq("status", "pending").limit(5),
      supabase.from("matches").select("receiver_id").eq("sender_id", uid),
      supabase.from("buddy_sessions")
        .select(`
          id, match_id, sport, session_time, status, proposer_id, receiver_id,
          proposer:users!buddy_sessions_proposer_id_fkey(full_name, username),
          receiver:users!buddy_sessions_receiver_id_fkey(full_name, username)
        `)
        .or(`proposer_id.eq.${uid},receiver_id.eq.${uid}`)
        .eq("session_date", today)
        .in("status", ["confirmed", "pending"]),
      supabase.from("communities")
        .select("id, name, icon, member_count")
        .order("member_count", { ascending: false })
        .limit(2),
    ]);

    // Unread messages — best effort; graceful fallback to 0
    let unread = 0;
    try {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .neq("sender_id", uid)
        .is("read_at", null);
      unread = count ?? 0;
    } catch { /* table may not have read_at — safe to ignore */ }
    setUnreadCount(unread);

    // Auto-expire gym status after 4 hours
    let atGym = profileData?.is_at_gym ?? false;
    if (atGym && profileData?.gym_checkin_at) {
      const age = Date.now() - new Date(profileData.gym_checkin_at).getTime();
      if (age > 4 * 60 * 60 * 1000) {
        atGym = false;
        supabase.from("users").update({ is_at_gym: false, gym_checkin_at: null }).eq("id", uid).then(() => {});
      }
    }

    setProfile({
      id:                  uid,
      username:            profileData?.username ?? "",
      full_name:           profileData?.full_name ?? null,
      current_streak:      profileData?.current_streak ?? 0,
      last_checkin_date:   profileData?.last_checkin_date ?? null,
      match_count:         matchCount ?? 0,
      workout_count_month: workoutMonth ?? 0,
      is_at_gym:           atGym,
      gym_checkin_at:      profileData?.gym_checkin_at ?? null,
    });

    setPendingRequests((pendingData ?? []).map((m: any) => ({
      id:            m.id,
      sender_id:     m.sender_id,
      username:      m.sender.username,
      full_name:     m.sender.full_name,
      city:          m.sender.city,
      fitness_level: m.sender.fitness_level,
    })));

    // Parse sessions
    const allSessions: SessionInfo[] = (sessionData ?? []).map((s: any) => {
      const isProposer = s.proposer_id === uid;
      const partner = isProposer ? s.receiver : s.proposer;
      return {
        id:           s.id,
        match_id:     s.match_id,
        sport:        s.sport ?? "Session",
        session_time: s.session_time ?? null,
        status:       s.status,
        partner_name: partner?.full_name ?? partner?.username ?? "Partner",
      };
    });
    setConfirmedSessions(allSessions.filter((s) => s.status === "confirmed"));
    setPendingSessions(allSessions.filter((s) => s.status === "pending" && (sessionData as any[])?.find((r: any) => r.id === s.id)?.receiver_id === uid));

    // Circles
    setCircles((circleData ?? []).map((cc: any) => ({
      id:           cc.id,
      name:         cc.name,
      icon:         cc.icon ?? "🏋️",
      member_count: cc.member_count ?? 0,
    })));

    // Phase 2 — suggested users (depends on profile data)
    const excludeIds = new Set([uid, ...(likedData ?? []).map((r: any) => r.receiver_id)]);
    const mySports   = profileData?.sports ?? [];
    const myCity     = profileData?.city ?? "";
    const myLevel    = profileData?.fitness_level ?? "";

    const { data: candidates } = await supabase
      .from("users")
      .select("id, username, full_name, city, sports, fitness_level, availability")
      .neq("id", uid).limit(40);

    const scored = (candidates ?? [])
      .filter((u: any) => !excludeIds.has(u.id))
      .map((u: any) => {
        const shared  = (mySports as string[]).filter((s: string) => (u.sports ?? []).includes(s));
        let score     = shared.length * 30;
        if (myLevel && u.fitness_level === myLevel)                                 score += 20;
        if (myCity && u.city?.toLowerCase() === myCity.toLowerCase())               score += 25;
        const reasons = buildMatchReasons(u, profileData ?? {});
        return { ...u, shared_sports: shared, reasons, score };
      })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 3)
      .map((u: any): SuggestedUser => ({
        id:            u.id,
        username:      u.username,
        full_name:     u.full_name ?? null,
        fitness_level: u.fitness_level ?? null,
        city:          u.city ?? null,
        shared_sports: u.shared_sports,
        reasons:       u.reasons,
      }));

    setSuggested(scored);
    setLoading(false);
  }, [today]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function logWorkout() {
    if (!profile) return;
    const { error } = await supabase.from("workouts").insert({
      user_id:   profile.id,
      logged_at: new Date().toISOString(),
      notes:     "Quick check-in",
    });
    if (error) { Alert.alert("Error", error.message); return; }

    const newStreak = profile.current_streak + 1;
    await supabase.from("users").update({
      last_checkin_date: today,
      current_streak:    newStreak,
    }).eq("id", profile.id);

    await supabase.from("feed_posts").insert({
      user_id:   profile.id,
      post_type: "workout",
      content:   newStreak > 1 ? `Day ${newStreak} streak!` : "Just logged my first workout!",
      meta:      { streak: newStreak },
    });

    setProfile((p) => p ? {
      ...p,
      last_checkin_date:   today,
      current_streak:      newStreak,
      workout_count_month: p.workout_count_month + 1,
    } : p);
  }

  async function toggleGym() {
    if (!profile) return;
    setGymToggling(true);
    const next = !profile.is_at_gym;
    await supabase.from("users").update({
      is_at_gym:      next,
      gym_checkin_at: next ? new Date().toISOString() : null,
    }).eq("id", profile.id);
    setProfile((p) => p ? { ...p, is_at_gym: next, gym_checkin_at: next ? new Date().toISOString() : null } : p);
    setGymToggling(false);
  }

  async function respondToMatch(matchId: string, status: "accepted" | "declined") {
    await supabase.from("matches").update({ status }).eq("id", matchId);
    setPendingRequests((prev) => prev.filter((p) => p.id !== matchId));
    if (status === "accepted") {
      setProfile((p) => p ? { ...p, match_count: p.match_count + 1 } : p);
    }
  }

  // ── Derived state ────────────────────────────────────────────────────────────
  const primaryAction: PrimaryAction = profile
    ? computePrimaryAction({ profile, confirmedSessions, pendingSessions, unreadCount, pendingRequests, today })
    : { kind: "log_streak", streak: 0 };

  // If the primary card is already showing the first pending request, remove it
  // from the section below to avoid showing the same person twice consecutively.
  const sectionRequests = primaryAction.kind === "match_request"
    ? pendingRequests.slice(1)
    : pendingRequests;

  const name = profile?.full_name?.split(" ")[0] ?? profile?.username ?? "";

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.brand} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} />}
      >
        <HomeHeader name={name} greeting={greeting} />

        <PrimaryActionCard action={primaryAction} onLogWorkout={logWorkout} />

        <PendingRequestsSection
          requests={sectionRequests}
          onAccept={(id) => respondToMatch(id, "accepted")}
          onDecline={(id) => respondToMatch(id, "declined")}
        />

        <BestMatchesSection users={suggested} />

        <CirclesPreviewSection circles={circles} />

        <MomentumStrip
          streak={profile?.current_streak ?? 0}
          matchCount={profile?.match_count ?? 0}
          workoutsMonth={profile?.workout_count_month ?? 0}
        />

        <QuickActionsSection
          unreadCount={unreadCount}
          isAtGym={profile?.is_at_gym ?? false}
          gymToggling={gymToggling}
          onToggleGym={toggleGym}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1 },
  scroll:{ padding: SPACE[20], paddingBottom: SPACE[48], gap: SPACE[20] },
});
