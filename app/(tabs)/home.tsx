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
import { useFocusEffect } from "expo-router";
import { router } from "expo-router";
import {
  ScrollView, ActivityIndicator, Alert, RefreshControl,
  StyleSheet, View, Text, TouchableOpacity, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { useTheme, SPACE, FONT, RADIUS, PALETTE, SHADOW, TYPE } from "../../lib/theme";
import { Icon } from "../../components/Icon";
import { Avatar } from "../../components/Avatar";

import { HomeHeader }             from "../../components/home/HomeHeader";
import { PrimaryActionCard }      from "../../components/home/PrimaryActionCard";
import { PendingRequestsSection } from "../../components/home/PendingRequestsSection";
import { BestMatchesSection }     from "../../components/home/BestMatchesSection";
import { CirclesPreviewSection }  from "../../components/home/CirclesPreviewSection";
import { MomentumStrip }          from "../../components/home/MomentumStrip";
import { ProfileSheet }           from "../../components/discover/ProfileSheet";
import type { DiscoverUser, RequestStatus } from "../../components/discover/PersonCard";

import {
  HomeProfile, PendingRequest, SuggestedUser, SessionInfo, CirclePreview,
  PrimaryAction, computePrimaryAction, buildMatchReasons, localToday,
} from "../../components/home/types";

const NUDGE_KEY = "profile_nudge_dismissed_at";
const NUDGE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

type ActivePartner = {
  id:         string;
  username:   string;
  full_name:  string | null;
  avatar_url: string | null;
  is_at_gym:  boolean;
  match_id:   string;
};

type NewCircle = {
  id:           string;
  name:         string;
  avatar_emoji: string;
  sport:        string | null;
  city:         string | null;
  field:        string | null;
  description:  string | null;
  max_members:  number | null;
  event_date:   string | null;
  event_time:   string | null;
  member_count: number;
};

type NewCircleMember = {
  id:         string;
  username:   string;
  full_name:  string | null;
  avatar_url: string | null;
};

export default function HomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [profile,           setProfile]           = useState<HomeProfile | null>(null);
  const [pendingRequests,   setPendingRequests]   = useState<PendingRequest[]>([]);
  const [suggested,         setSuggested]         = useState<SuggestedUser[]>([]);
  const [circles,           setCircles]           = useState<CirclePreview[]>([]);
  const [confirmedSessions, setConfirmedSessions] = useState<SessionInfo[]>([]);
  const [pendingSessions,   setPendingSessions]   = useState<SessionInfo[]>([]);
  const [upcomingSessions,  setUpcomingSessions]  = useState<SessionInfo[]>([]);
  const [unreadCount,       setUnreadCount]       = useState(0);
  const [activePartners,    setActivePartners]    = useState<ActivePartner[]>([]);
  const [profileMissing,    setProfileMissing]    = useState<string[]>([]);
  const [nudgeDismissed,    setNudgeDismissed]    = useState(false);
  const [loading,           setLoading]           = useState(true);
  const [refreshing,        setRefreshing]        = useState(false);
  const [gymToggling,       setGymToggling]       = useState(false);
  const [sheetUser,         setSheetUser]         = useState<DiscoverUser | null>(null);
  const [sheetStatus,       setSheetStatus]       = useState<RequestStatus>("none");
  const [newCircles,        setNewCircles]        = useState<NewCircle[]>([]);
  const [selectedNewCircle, setSelectedNewCircle] = useState<NewCircle | null>(null);
  const [newCircleMembers,  setNewCircleMembers]  = useState<NewCircleMember[]>([]);
  const [loadingCircleMem,  setLoadingCircleMem]  = useState(false);
  const [selectedSession,   setSelectedSession]   = useState<SessionInfo | null>(null);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today    = localToday();

  // Check nudge dismiss state once on mount
  useEffect(() => {
    AsyncStorage.getItem(NUDGE_KEY).then((val) => {
      if (val) {
        const dismissed = parseInt(val, 10);
        if (Date.now() - dismissed < NUDGE_TTL) setNudgeDismissed(true);
      }
    });
  }, []);

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const uid = user.id;

    const monthAgo    = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Phase 1 — parallel queries
    const [
      { data: profileData },
      { count: matchCount },
      { count: workoutMonth },
      { data: pendingData },
      { data: likedData },
      { data: sessionData },
      { data: myCircleData },
      { data: acceptedMatches },
      { data: blockData },
    ] = await Promise.all([
      supabase.from("users")
        .select("id, username, full_name, avatar_url, current_streak, last_checkin_date, is_at_gym, gym_checkin_at, sports, fitness_level, city, availability, bio")
        .eq("id", uid).single(),
      supabase.from("matches").select("*", { count: "exact", head: true })
        .eq("status", "accepted").or(`sender_id.eq.${uid},receiver_id.eq.${uid}`),
      supabase.from("workouts").select("*", { count: "exact", head: true })
        .eq("user_id", uid).gte("logged_at", monthAgo),
      supabase.from("matches")
        .select("id, sender_id, sender:users!matches_sender_id_fkey(id, username, full_name, avatar_url, city, fitness_level)")
        .eq("receiver_id", uid).eq("status", "pending").limit(5),
      supabase.from("matches").select("receiver_id").eq("sender_id", uid),
      supabase.from("buddy_sessions")
        .select(`
          id, match_id, sport, session_date, session_time, location, status, proposer_id, receiver_id,
          proposer:users!buddy_sessions_proposer_id_fkey(full_name, username),
          receiver:users!buddy_sessions_receiver_id_fkey(full_name, username)
        `)
        .or(`proposer_id.eq.${uid},receiver_id.eq.${uid}`)
        .eq("session_date", today)
        .in("status", ["accepted", "pending"]),
      // User's own circles — not global popular ones
      supabase.from("community_members")
        .select("community:communities(id, name, avatar_emoji, member_count)")
        .eq("user_id", uid)
        .limit(3),
      supabase.from("matches")
        .select("id, sender_id, receiver_id")
        .eq("status", "accepted")
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`),
      supabase.from("blocks")
        .select("blocked_id")
        .eq("blocker_id", uid),
    ]);

    // Unread messages — filter by THIS user's accepted match IDs only
    let unread = 0;
    try {
      const myMatchIds = (acceptedMatches ?? []).map((m: any) => m.id);
      if (myMatchIds.length > 0) {
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .in("match_id", myMatchIds)
          .neq("sender_id", uid)
          .is("read_at", null);
        unread = count ?? 0;
      }
    } catch { /* table may not have read_at — safe to ignore */ }
    setUnreadCount(unread);

    // Auto-expire gym status after 4 hours
    let atGym = profileData?.is_at_gym ?? false;
    if (atGym && profileData?.gym_checkin_at) {
      const age = Date.now() - new Date(profileData.gym_checkin_at).getTime();
      if (age > 3 * 60 * 60 * 1000) {
        atGym = false;
        supabase.from("users").update({ is_at_gym: false, gym_checkin_at: null }).eq("id", uid).then(() => {});
      }
    }

    setProfile({
      id:                  uid,
      username:            profileData?.username ?? "",
      full_name:           profileData?.full_name ?? null,
      avatar_url:          profileData?.avatar_url ?? null,
      current_streak:      profileData?.current_streak ?? 0,
      last_checkin_date:   profileData?.last_checkin_date ?? null,
      match_count:         matchCount ?? 0,
      workout_count_month: workoutMonth ?? 0,
      is_at_gym:           atGym,
      gym_checkin_at:      profileData?.gym_checkin_at ?? null,
    });

    // Profile completeness check
    const missing: string[] = [];
    if (!profileData?.sports?.length) missing.push("sports");
    if (!profileData?.bio)            missing.push("bio");
    if (!profileData?.city)           missing.push("city");
    setProfileMissing(missing);

    // Fix: also exclude pending-request senders so they don't appear in BestMatches too
    const pendingSenderIds = (pendingData ?? []).map((m: any) => m.sender_id);
    setPendingRequests((pendingData ?? []).map((m: any) => ({
      id:            m.id,
      sender_id:     m.sender_id,
      username:      m.sender.username,
      full_name:     m.sender.full_name,
      avatar_url:    m.sender.avatar_url ?? null,
      city:          m.sender.city,
      fitness_level: m.sender.fitness_level,
    })));

    // Parse today's sessions
    const allSessions: SessionInfo[] = (sessionData ?? []).map((s: any) => {
      const isProposer = s.proposer_id === uid;
      const partner = isProposer ? s.receiver : s.proposer;
      return {
        id:           s.id,
        match_id:     s.match_id,
        sport:        s.sport ?? "Session",
        session_date: s.session_date ?? today,
        session_time: s.session_time ?? null,
        location:     s.location ?? null,
        status:       s.status,
        partner_name: partner?.full_name ?? partner?.username ?? "Partner",
      };
    });
    // "confirmed" = accepted (DB uses "accepted" for confirmed sessions)
    setConfirmedSessions(allSessions.filter((s) => s.status === "accepted"));
    setPendingSessions(allSessions.filter((s) => s.status === "pending" && (sessionData as any[])?.find((r: any) => r.id === s.id)?.receiver_id === uid));

    // Upcoming sessions — today + next 14 days (ALL sessions, proposer or receiver)
    const fourteenDays = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const fourteenDaysStr = `${fourteenDays.getFullYear()}-${String(fourteenDays.getMonth()+1).padStart(2,"0")}-${String(fourteenDays.getDate()).padStart(2,"0")}`;
    const { data: upcomingData } = await supabase
      .from("buddy_sessions")
      .select(`
        id, match_id, sport, session_date, session_time, location, status, proposer_id, receiver_id,
        proposer:users!buddy_sessions_proposer_id_fkey(full_name, username),
        receiver:users!buddy_sessions_receiver_id_fkey(full_name, username)
      `)
      .or(`proposer_id.eq.${uid},receiver_id.eq.${uid}`)
      .gte("session_date", today)
      .lte("session_date", fourteenDaysStr)
      .in("status", ["pending", "accepted"])
      .order("session_date", { ascending: true });

    setUpcomingSessions((upcomingData ?? []).map((s: any) => {
      const isProposer = s.proposer_id === uid;
      const partner    = isProposer ? s.receiver : s.proposer;
      return {
        id:           s.id,
        match_id:     s.match_id,
        sport:        s.sport ?? "Session",
        session_date: s.session_date,
        session_time: s.session_time ?? null,
        location:     s.location ?? null,
        status:       s.status,
        partner_name: partner?.full_name ?? partner?.username ?? "Partner",
      };
    }));

    // Circles — user's own, mapped with correct field name
    setCircles((myCircleData ?? [])
      .map((row: any) => row.community)
      .filter(Boolean)
      .map((cc: any) => ({
        id:           cc.id,
        name:         cc.name,
        icon:         cc.avatar_emoji ?? "🏋️",
        member_count: cc.member_count ?? 0,
      }))
    );

    // Build partnerId → matchId map for deep-link navigation
    const partnerMatchMap = new Map<string, string>();
    for (const m of acceptedMatches ?? []) {
      const partnerId = m.sender_id === uid ? m.receiver_id : m.sender_id;
      partnerMatchMap.set(partnerId, m.id);
    }

    // Active partners — filter by last_active within 2 hours
    const partnerIds = [...partnerMatchMap.keys()];
    if (partnerIds.length > 0) {
      const { data: partnerData } = await supabase
        .from("users")
        .select("id, username, full_name, avatar_url, is_at_gym, last_active")
        .in("id", partnerIds)
        .gte("last_active", twoHoursAgo)
        .limit(8);
      setActivePartners((partnerData ?? []).map((u: any) => ({
        id:         u.id,
        username:   u.username,
        full_name:  u.full_name ?? null,
        avatar_url: u.avatar_url ?? null,
        is_at_gym:  u.is_at_gym ?? false,
        match_id:   partnerMatchMap.get(u.id) ?? "",
      })));
    } else {
      setActivePartners([]);
    }

    // Phase 2 — suggested users
    // Exclude: self, already-sent requests, received pending requests (avoid double-show)
    const excludeIds = new Set([
      uid,
      ...(likedData  ?? []).map((r: any) => r.receiver_id),
      ...(blockData  ?? []).map((b: any) => b.blocked_id),
      ...pendingSenderIds,
    ]);
    const mySports = profileData?.sports ?? [];
    const myCity   = profileData?.city ?? "";
    const myLevel  = profileData?.fitness_level ?? "";

    const { data: candidates } = await supabase
      .from("users")
      .select("id, username, full_name, avatar_url, city, sports, fitness_level, availability")
      .neq("id", uid).limit(40);

    const scored = (candidates ?? [])
      .filter((u: any) => !excludeIds.has(u.id))
      .map((u: any) => {
        const shared  = (mySports as string[]).filter((s: string) => (u.sports ?? []).includes(s));
        let score     = shared.length * 30;
        if (myLevel && u.fitness_level === myLevel)                   score += 20;
        if (myCity && u.city?.toLowerCase() === myCity.toLowerCase()) score += 25;
        const reasons = buildMatchReasons(u, profileData ?? {});
        return { ...u, shared_sports: shared, reasons, score };
      })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 3)
      .map((u: any): SuggestedUser => ({
        id:            u.id,
        username:      u.username,
        full_name:     u.full_name ?? null,
        avatar_url:    u.avatar_url ?? null,
        fitness_level: u.fitness_level ?? null,
        city:          u.city ?? null,
        shared_sports: u.shared_sports,
        reasons:       u.reasons,
      }));

    setSuggested(scored);

    // New circles matching user's interests (created in last 7 days, not yet joined)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const userSports: string[] = profileData?.sports ?? [];
    const { data: newCircleData } = await supabase
      .from("communities")
      .select("id, name, avatar_emoji, sport, city, field, description, max_members, event_date, event_time, created_at")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false });

    // Filter: matches user's sports AND user is not already a member
    const { data: myMemberships } = await supabase
      .from("community_members")
      .select("community_id")
      .eq("user_id", uid);
    const myCircleIds = new Set((myMemberships ?? []).map((m: any) => m.community_id));

    const matchingNew = (newCircleData ?? []).filter((cc: any) =>
      !myCircleIds.has(cc.id) && userSports.some((sp) => cc.sport?.toLowerCase().includes(sp.toLowerCase()) || sp.toLowerCase().includes(cc.sport?.toLowerCase() ?? ""))
    ).map((cc: any) => ({
      id:           cc.id,
      name:         cc.name,
      avatar_emoji: cc.avatar_emoji ?? "🏟️",
      sport:        cc.sport ?? null,
      city:         cc.city ?? null,
      field:        cc.field ?? null,
      description:  cc.description ?? null,
      max_members:  cc.max_members ?? null,
      event_date:   cc.event_date ?? null,
      event_time:   cc.event_time ?? null,
      member_count: 0,
    }));
    setNewCircles(matchingNew);

    setLoading(false);
  }, [today]);

  useFocusEffect(useCallback(() => {
    load();
    // Close any open modal when the tab loses focus
    return () => { setSelectedSession(null); };
  }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function logWorkout() {
    if (!profile) return;
    const { error } = await supabase.from("workouts").insert({
      user_id:       profile.id,
      exercise_type: "Quick Check-in",
      logged_at:     new Date().toISOString(),
      notes:         "Quick check-in",
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

    // Notify all accepted match partners
    const { data: acceptedMs } = await supabase
      .from("matches")
      .select("sender_id, receiver_id")
      .eq("status", "accepted")
      .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`);
    const partnerIds = (acceptedMs ?? []).map((m: any) =>
      m.sender_id === profile.id ? m.receiver_id : m.sender_id
    );
    if (partnerIds.length > 0) {
      const displayName = profile.full_name?.split(" ")[0] ?? profile.username ?? "Your buddy";
      await supabase.from("notifications").insert(
        partnerIds.map((pid: string) => ({
          user_id:    pid,
          type:       "partner_workout",
          title:      "💪 Training buddy is active!",
          body:       `${displayName} just logged a workout. Stay motivated!`,
          related_id: profile.id,
          read:       false,
        }))
      );
    }

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

  async function openMatchProfile(suggested: SuggestedUser) {
    if (!profile) return;
    const { data } = await supabase
      .from("users")
      .select("id, username, full_name, avatar_url, bio, city, fitness_level, age, gender, sports, current_streak, last_active, is_at_gym, availability, training_intent, lat, lng")
      .eq("id", suggested.id)
      .single();
    if (!data) return;

    const { data: match } = await supabase
      .from("matches")
      .select("status")
      .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${suggested.id}),and(sender_id.eq.${suggested.id},receiver_id.eq.${profile.id})`)
      .maybeSingle();

    const status: RequestStatus =
      match?.status === "accepted" ? "accepted" :
      match?.status === "pending"  ? "pending"  : "none";

    setSheetStatus(status);
    setSheetUser({
      id:              data.id,
      username:        data.username,
      full_name:       data.full_name ?? null,
      avatar_url:      data.avatar_url ?? null,
      bio:             data.bio ?? null,
      city:            data.city ?? null,
      fitness_level:   data.fitness_level ?? null,
      age:             data.age ?? null,
      gender:          data.gender ?? null,
      sports:          data.sports ?? [],
      current_streak:  data.current_streak ?? 0,
      last_active:     data.last_active ?? null,
      is_at_gym:       data.is_at_gym ?? false,
      availability:    data.availability ?? null,
      training_intent: data.training_intent ?? null,
      lat:             data.lat ?? null,
      lng:             data.lng ?? null,
      matchScore:      0,
      reasons:         suggested.reasons,
      isNew:           false,
    });
  }

  async function sendRequestFromSheet() {
    if (!profile || !sheetUser) return;
    await supabase.from("matches").insert({
      sender_id:   profile.id,
      receiver_id: sheetUser.id,
      status:      "pending",
    });
    setSheetStatus("pending");
  }

  async function joinCircle(circleId: string) {
    if (!profile) return;
    await supabase.from("community_members").insert({ community_id: circleId, user_id: profile.id });
    setNewCircles((prev) => prev.filter((c) => c.id !== circleId));
    setSelectedNewCircle(null);
  }

  async function openNewCircle(circle: NewCircle) {
    setSelectedNewCircle(circle);
    setLoadingCircleMem(true);
    const { data } = await supabase
      .from("community_members")
      .select("user:users(id, username, full_name, avatar_url)")
      .eq("community_id", circle.id);
    setNewCircleMembers(
      (data ?? []).map((row: any) => row.user).filter(Boolean) as NewCircleMember[]
    );
    setLoadingCircleMem(false);
  }

  async function dismissNudge() {
    setNudgeDismissed(true);
    await AsyncStorage.setItem(NUDGE_KEY, String(Date.now()));
  }

  async function cancelSession(sessionId: string) {
    await supabase.from("buddy_sessions").update({ status: "cancelled" }).eq("id", sessionId);
    setUpcomingSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setSelectedSession(null);
  }

  async function rescheduleSession(sessionId: string, newDate: string, newTime: string | null) {
    await supabase.from("buddy_sessions").update({
      session_date: newDate,
      session_time: newTime,
      status: "pending",
    }).eq("id", sessionId);
    setUpcomingSessions((prev) => prev.map((s) =>
      s.id === sessionId ? { ...s, session_date: newDate, session_time: newTime, status: "pending" } : s
    ));
    setSelectedSession(null);
  }

  // ── Derived state ────────────────────────────────────────────────────────────
  const primaryAction: PrimaryAction = profile
    ? computePrimaryAction({ profile, confirmedSessions, pendingSessions, unreadCount, pendingRequests, today })
    : { kind: "log_streak", streak: 0 };

  const sectionRequests = primaryAction.kind === "match_request"
    ? pendingRequests.slice(1)
    : pendingRequests;

  const name      = profile?.full_name?.split(" ")[0] ?? profile?.username ?? "";
  const isNewUser = !loading && (profile?.match_count ?? 0) === 0 && pendingRequests.length === 0;
  // GymStrip is redundant when PrimaryActionCard already shows the gym prompt
  const showGymStrip = primaryAction.kind !== "at_gym_log";

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
        {/* ── Header + stats always visible above the fold ── */}
        <HomeHeader
          name={name}
          greeting={greeting}
          avatarUrl={profile?.avatar_url}
          unreadCount={unreadCount}
        />

        <MomentumStrip
          streak={profile?.current_streak ?? 0}
          matchCount={profile?.match_count ?? 0}
          weekSessions={upcomingSessions.length}
        />

        {/* ── Primary action ── */}
        <PrimaryActionCard action={primaryAction} onLogWorkout={logWorkout} />

        {/* Gym strip only when primary card isn't already showing the gym prompt */}
        {showGymStrip && (
          <GymStrip
            isAtGym={profile?.is_at_gym ?? false}
            toggling={gymToggling}
            onToggle={toggleGym}
          />
        )}

        {/* ── Onboarding nudges — mutually exclusive ── */}
        {isNewUser
          ? <NewUserCard />
          : (!nudgeDismissed && profileMissing.length > 0) && (
              <ProfileNudge missing={profileMissing} onDismiss={dismissNudge} />
            )
        }

        {/* ── Upcoming sessions ── */}
        {upcomingSessions.length > 0 && (
          <UpcomingSessionsSection
            sessions={upcomingSessions}
            onSelect={setSelectedSession}
          />
        )}

        {/* ── Social feed ── */}
        {activePartners.length > 0 && <ActiveNowStrip partners={activePartners} />}

        <PendingRequestsSection
          requests={sectionRequests}
          onAccept={(id) => respondToMatch(id, "accepted")}
          onDecline={(id) => respondToMatch(id, "declined")}
        />

        <BestMatchesSection users={suggested} onPress={openMatchProfile} />

        <NewCirclesSection
          circles={newCircles}
          onPress={openNewCircle}
          onJoin={joinCircle}
          onDismiss={(id) => setNewCircles((prev) => prev.filter((c) => c.id !== id))}
        />

        <CirclesPreviewSection circles={circles} />

        {/* ── Challenges shortcut ── */}
        <TouchableOpacity
          style={[cs.banner, { backgroundColor: c.bgCard, borderColor: c.border }]}
          onPress={() => router.push("/(tabs)/challenges" as any)}
          activeOpacity={0.8}
        >
          <Text style={cs.bannerEmoji}>🏆</Text>
          <View style={{ flex: 1 }}>
            <Text style={[cs.bannerTitle, { color: c.text }]}>Challenges</Text>
            <Text style={[cs.bannerSub, { color: c.textMuted }]}>Join community fitness challenges</Text>
          </View>
          <Icon name="chevronRight" size={16} color={c.textMuted} />
        </TouchableOpacity>
      </ScrollView>

      <ProfileSheet
        user={sheetUser}
        status={sheetStatus}
        onConnect={sendRequestFromSheet}
        onClose={() => setSheetUser(null)}
        onBlock={(userId) => {
          setSuggested((prev) => prev.filter((u) => u.id !== userId));
          setSheetUser(null);
        }}
      />

      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onCancel={cancelSession}
          onReschedule={rescheduleSession}
        />
      )}

      {/* ── New Circle detail popup ──────────────────────────────────── */}
      {selectedNewCircle && (
        <TouchableOpacity
          style={nc.backdrop}
          activeOpacity={1}
          onPress={() => setSelectedNewCircle(null)}
        >
          <TouchableOpacity style={[nc.card, { backgroundColor: c.bgCard }]} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <TouchableOpacity style={nc.closeBtn} onPress={() => setSelectedNewCircle(null)} hitSlop={10}>
              <Icon name="close" size={20} color={c.textMuted} />
            </TouchableOpacity>

            <View style={nc.top}>
              <View style={[nc.emoji, { backgroundColor: c.bgCardAlt }]}>
                <Text style={{ fontSize: 36 }}>{selectedNewCircle.avatar_emoji}</Text>
              </View>
              <Text style={[nc.name, { color: c.text }]}>{selectedNewCircle.name}</Text>
              <View style={nc.chips}>
                {selectedNewCircle.sport && (
                  <View style={[nc.chip, { backgroundColor: c.bgCardAlt, borderColor: c.borderMedium }]}>
                    <Text style={[nc.chipText, { color: c.textMuted }]}>{selectedNewCircle.sport}</Text>
                  </View>
                )}
                {selectedNewCircle.city && (
                  <View style={[nc.chip, { backgroundColor: c.bgCardAlt, borderColor: c.borderMedium }]}>
                    <Icon name="location" size={10} color={c.textMuted} />
                    <Text style={[nc.chipText, { color: c.textMuted }]}>{selectedNewCircle.city}</Text>
                  </View>
                )}
              </View>
              {selectedNewCircle.event_date && (
                <View style={[nc.field, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                  <Text style={{ fontSize: 14 }}>📅</Text>
                  <Text style={[nc.fieldText, { color: c.textSecondary }]}>
                    {formatNewCircleDate(selectedNewCircle.event_date)}
                    {selectedNewCircle.event_time ? `  ·  ${selectedNewCircle.event_time}` : ""}
                  </Text>
                </View>
              )}
              {selectedNewCircle.field && (
                <View style={[nc.field, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                  <Text style={{ fontSize: 14 }}>📍</Text>
                  <Text style={[nc.fieldText, { color: c.textSecondary }]} numberOfLines={2}>{selectedNewCircle.field}</Text>
                </View>
              )}
              {selectedNewCircle.description && (
                <Text style={[nc.desc, { color: c.textMuted }]}>{selectedNewCircle.description}</Text>
              )}
            </View>

            <View style={[nc.divider, { backgroundColor: c.border }]} />
            <Text style={[nc.memberHeader, { color: c.textMuted }]}>
              {newCircleMembers.length}{selectedNewCircle.max_members ? `/${selectedNewCircle.max_members}` : ""} MEMBER{newCircleMembers.length !== 1 ? "S" : ""}
            </Text>
            {loadingCircleMem ? (
              <ActivityIndicator color={c.brand} size="small" style={{ marginVertical: SPACE[12] }} />
            ) : (
              <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
                {newCircleMembers.map((m) => (
                  <View key={m.id} style={nc.memberRow}>
                    <Avatar url={m.avatar_url} name={m.full_name ?? m.username} size={30} />
                    <Text style={[nc.memberName, { color: c.text }]}>{m.full_name ?? m.username}</Text>
                  </View>
                ))}
                {newCircleMembers.length === 0 && (
                  <Text style={[{ fontSize: FONT.size.sm, color: c.textFaint, textAlign: "center", paddingVertical: SPACE[8] }]}>No members yet — be the first!</Text>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[nc.joinBtn, { backgroundColor: c.brand }]}
              onPress={() => joinCircle(selectedNewCircle.id)}
              activeOpacity={0.85}
            >
              <Text style={nc.joinText}>Join Circle</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// ─── Upcoming Sessions Section ────────────────────────────────────────────────
function UpcomingSessionsSection({ sessions, onSelect }: {
  sessions: SessionInfo[];
  onSelect: (sess: SessionInfo) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  function formatDate(dateStr: string): string {
    const d        = new Date(dateStr + "T12:00:00");
    const today    = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === today.toDateString())    return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  }

  const STATUS: Record<string, { color: string; bg: string }> = {
    accepted: { color: "#fff",     bg: "#22C55E" },
    pending:  { color: "#92400E",  bg: "#FEF3C7" },
  };

  return (
    <View style={{ gap: SPACE[10] }}>
      <Text style={[us.sectionTitle, { color: c.text }]}>Upcoming Sessions</Text>

      <View style={[us.card, SHADOW.sm, { backgroundColor: c.bgCard, borderColor: c.border }]}>
        {sessions.map((sess, idx) => {
          const st = STATUS[sess.status] ?? { color: c.textMuted, bg: c.bgCardAlt };
          return (
            <TouchableOpacity
              key={sess.id}
              style={[
                us.row,
                idx < sessions.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
              ]}
              onPress={() => onSelect(sess)}
              activeOpacity={0.75}
            >
              {/* Sport icon */}
              <View style={[us.iconWrap, { backgroundColor: c.bgCardAlt }]}>
                <Icon name={sportIcon(sess.sport)} size={20} color={c.textMuted} />
              </View>

              <View style={{ flex: 1, gap: 3 }}>
                {/* Title row: sport + partner + status badge */}
                <View style={us.rowTop}>
                  <Text style={[us.sport, { color: c.text }]} numberOfLines={1}>
                    {sess.sport}{" "}
                    <Text style={[us.partnerName, { color: c.text }]}>with {sess.partner_name}</Text>
                  </Text>
                  <View style={[us.badge, { backgroundColor: st.bg }]}>
                    <Text style={[us.badgeText, { color: st.color }]}>
                      {sess.status.charAt(0).toUpperCase() + sess.status.slice(1)}
                    </Text>
                  </View>
                </View>

                {/* Time */}
                <Text style={[us.meta, { color: c.textMuted }]}>
                  {formatDate(sess.session_date)}{sess.session_time ? `, ${sess.session_time}` : ""}
                </Text>

                {/* Location */}
                {sess.location && (
                  <View style={us.locRow}>
                    <Icon name="location" size={11} color={c.textMuted} />
                    <Text style={[us.meta, { color: c.textMuted }]} numberOfLines={1}>{sess.location}</Text>
                  </View>
                )}
              </View>

              <Icon name="chevronRight" size={16} color={c.textFaint} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function sportIcon(sport: string): import("../../components/Icon").IconName {
  const lower = sport.toLowerCase();
  if (lower.includes("yoga") || lower.includes("pilates")) return "heartActive";
  if (lower.includes("run") || lower.includes("cardio"))   return "goal";
  return "workout";
}

function sportEmoji(sport: string): string {
  const lower = sport.toLowerCase();
  if (lower.includes("yoga") || lower.includes("pilates")) return "🧘";
  if (lower.includes("run") || lower.includes("cardio"))   return "🏃";
  if (lower.includes("cycl") || lower.includes("bike"))    return "🚴";
  if (lower.includes("swim"))                              return "🏊";
  if (lower.includes("box"))                               return "🥊";
  if (lower.includes("tennis"))                            return "🎾";
  if (lower.includes("basket"))                            return "🏀";
  if (lower.includes("soccer") || lower.includes("football")) return "⚽";
  if (lower.includes("hik") || lower.includes("climb"))    return "🧗";
  return "🏋️";
}

const us = StyleSheet.create({
  sectionTitle: { ...TYPE.sectionTitle },
  card:         { borderRadius: RADIUS.xl, borderWidth: 1, overflow: "hidden" },
  row:          { flexDirection: "row", alignItems: "center", gap: SPACE[12], paddingHorizontal: SPACE[16], paddingVertical: SPACE[16] },
  iconWrap:     { width: 42, height: 42, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  rowTop:       { flexDirection: "row", alignItems: "center", gap: SPACE[8] },
  sport:        { ...TYPE.bodyMedium, flex: 1 },
  partnerName:  { fontWeight: FONT.weight.bold },
  badge:        { paddingHorizontal: SPACE[8], paddingVertical: 3, borderRadius: RADIUS.pill },
  badgeText:    { fontSize: 12, fontWeight: FONT.weight.bold },
  meta:         { ...TYPE.caption },
  locRow:       { flexDirection: "row", alignItems: "center", gap: SPACE[4] },
});

// ─── Gym Strip ────────────────────────────────────────────────────────────────
function GymStrip({ isAtGym, toggling, onToggle }: {
  isAtGym: boolean; toggling: boolean; onToggle: () => void;
}) {
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const activeBg     = isDark ? "#0D2D1A" : "#ECFDF5";
  const activeBorder = isDark ? "#166534" : "#BBF7D0";
  const pinColor     = isAtGym ? PALETTE.success : c.brand;

  return (
    <TouchableOpacity
      style={[
        gs.card,
        SHADOW.md,
        isAtGym
          ? { backgroundColor: activeBg, borderColor: activeBorder }
          : { backgroundColor: c.bgCard, borderColor: c.border },
      ]}
      onPress={onToggle}
      activeOpacity={0.75}
      disabled={toggling}
    >
      {/* Decorative ripple circles — right side */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[gs.ripple1, { borderColor: c.bgCardAlt }]} />
        <View style={[gs.ripple2, { borderColor: c.bgCardAlt }]} />
        <View style={[gs.ripple3, { borderColor: c.bgCardAlt }]} />
      </View>

      {/* Top row — icon + title + subtitle */}
      <View style={gs.topRow}>
        <View style={[gs.pinWrap, { backgroundColor: isAtGym ? "#22C55E18" : "#FF450012" }]}>
          {toggling
            ? <ActivityIndicator size="small" color={pinColor} />
            : <Icon name="location" size={24} color={pinColor} />
          }
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[gs.label, { color: isAtGym ? PALETTE.success : c.text }]}>
            {isAtGym ? "At the gym now" : "Check in at gym"}
          </Text>
          <Text style={[gs.sub, { color: c.textMuted }]}>
            {isAtGym ? "Your matches can see you're here" : "Find partners at your gym"}
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={[gs.divider, { backgroundColor: c.border }]} />

      {/* Bottom row — gym name */}
      <View style={gs.bottomRow}>
        <Icon name="location" size={13} color={c.textMuted} />
        <Text style={[gs.gymName, { color: c.textSecondary }]}>
          {isAtGym ? "Checked in" : "Summit Fitness"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Active Now Strip ─────────────────────────────────────────────────────────
function ActiveNowStrip({ partners }: { partners: ActivePartner[] }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[an.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
      <View style={an.header}>
        <View style={an.dot} />
        <Text style={[an.title, { color: c.text }]}>Active now</Text>
        <Text style={[an.sub, { color: c.textMuted }]}>
          {partners.length} {partners.length === 1 ? "buddy" : "buddies"} online
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={an.row}>
        {partners.map((p) => (
          <Pressable
            key={p.id}
            style={an.item}
            onPress={() => router.push(`/chat/${p.match_id}` as any)}
          >
            <View style={an.avatarWrap}>
              <Avatar url={p.avatar_url} name={p.full_name ?? p.username} size={46} />
              {p.is_at_gym && <View style={[an.gymBadge, { borderColor: c.bgCard }]} />}
              <View style={[an.activeDot, { borderColor: c.bgCard }]} />
            </View>
            <Text style={[an.name, { color: c.textSecondary }]} numberOfLines={1}>
              {p.full_name?.split(" ")[0] ?? p.username}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Profile Nudge ────────────────────────────────────────────────────────────
function ProfileNudge({ missing, onDismiss }: { missing: string[]; onDismiss: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const label = missing.length === 1
    ? `Add your ${missing[0]} to get better matches`
    : `Add ${missing.slice(0, 2).join(" & ")} to get better matches`;

  return (
    <View style={[pn.card, { backgroundColor: c.bgCard, borderColor: c.brand + "33" }]}>
      <TouchableOpacity
        style={pn.inner}
        onPress={() => router.push("/(tabs)/profile")}
        activeOpacity={0.8}
      >
        <View style={[pn.iconWrap, { backgroundColor: c.brand + "18" }]}>
          <Icon name="profile" size={18} color={c.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[pn.title, { color: c.text }]}>Complete your profile</Text>
          <Text style={[pn.sub, { color: c.textMuted }]}>{label}</Text>
        </View>
        <Icon name="chevronRight" size={16} color={c.textMuted} />
      </TouchableOpacity>
      <TouchableOpacity style={pn.dismiss} onPress={onDismiss} hitSlop={8}>
        <Icon name="close" size={13} color={c.textFaint} />
      </TouchableOpacity>
    </View>
  );
}

// ─── New User Card ────────────────────────────────────────────────────────────
function NewUserCard() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <TouchableOpacity
      style={[nu.card, { backgroundColor: c.brand + "12", borderColor: c.brand + "44" }]}
      onPress={() => router.push("/(tabs)/discover")}
      activeOpacity={0.8}
    >
      <Text style={nu.emoji}>👋</Text>
      <View style={{ flex: 1 }}>
        <Text style={[nu.title, { color: c.text }]}>Find your first training buddy</Text>
        <Text style={[nu.sub, { color: c.textMuted }]}>Browse people near you → tap Discover</Text>
      </View>
      <Icon name="chevronRight" size={16} color={c.brand} />
    </TouchableOpacity>
  );
}

// ─── New Circles Section ──────────────────────────────────────────────────────
function formatNewCircleDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow";
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function NewCirclesSection({ circles, onPress, onJoin, onDismiss }: {
  circles: NewCircle[];
  onPress: (circle: NewCircle) => void;
  onJoin: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  if (circles.length === 0) return null;
  return (
    <View style={{ marginBottom: SPACE[20] }}>
      <Text style={[{ fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 1, color: c.textMuted, marginBottom: SPACE[10], paddingHorizontal: SPACE[20] }]}>
        NEW CIRCLES FOR YOU
      </Text>
      {circles.map((circle) => (
        <TouchableOpacity
          key={circle.id}
          style={[{ flexDirection: "row", alignItems: "center", gap: SPACE[12], paddingHorizontal: SPACE[14], paddingVertical: SPACE[12], backgroundColor: c.bgCard, borderRadius: RADIUS.xl, marginHorizontal: SPACE[16], marginBottom: SPACE[8], borderWidth: 1, borderColor: c.brandBorder }]}
          onPress={() => onPress(circle)}
          activeOpacity={0.85}
        >
          <View style={[{ width: 44, height: 44, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center", backgroundColor: c.bgCardAlt }]}>
            <Text style={{ fontSize: 22 }}>{circle.avatar_emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[{ fontSize: FONT.size.md, fontWeight: FONT.weight.bold, color: c.text }]} numberOfLines={1}>{circle.name}</Text>
            <Text style={[{ fontSize: FONT.size.xs, color: c.textMuted, marginTop: 2 }]}>
              {[circle.sport, circle.city].filter(Boolean).join(" · ") || "New circle"}
            </Text>
          </View>
          <TouchableOpacity
            style={[{ borderRadius: RADIUS.md, paddingHorizontal: SPACE[12], paddingVertical: SPACE[7], backgroundColor: c.brand }]}
            onPress={(e) => { e.stopPropagation(); onJoin(circle.id); }}
            activeOpacity={0.85}
          >
            <Text style={[{ color: "#fff", fontWeight: FONT.weight.bold, fontSize: FONT.size.sm }]}>Join</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); onDismiss(circle.id); }} hitSlop={10}>
            <Icon name="close" size={16} color={c.textFaint} />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const gs = StyleSheet.create({
  card:      { borderRadius: RADIUS.xl, borderWidth: 1 },
  topRow:    { flexDirection: "row", alignItems: "center", gap: SPACE[12], paddingHorizontal: SPACE[16], paddingTop: SPACE[16], paddingBottom: SPACE[14] },
  pinWrap:   { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  divider:   { height: 1, marginHorizontal: SPACE[16] },
  bottomRow: { flexDirection: "row", alignItems: "center", gap: SPACE[6], paddingHorizontal: SPACE[16], paddingVertical: SPACE[12] },
  label:     { ...TYPE.cardTitle },
  sub:       { ...TYPE.caption, marginTop: 3 },
  gymName:   { ...TYPE.caption, fontWeight: FONT.weight.medium },
  ripple1:   { position: "absolute", width: 200, height: 200, borderRadius: 100, borderWidth: 1, opacity: 0.5, top: -80, right: -50 },
  ripple2:   { position: "absolute", width: 140, height: 140, borderRadius: 70,  borderWidth: 1, opacity: 0.4, top: -40, right: -10 },
  ripple3:   { position: "absolute", width: 90,  height: 90,  borderRadius: 45,  borderWidth: 1, opacity: 0.3, top:   5, right:  30 },
});

const an = StyleSheet.create({
  card:      { borderRadius: RADIUS.xl, borderWidth: 1, paddingVertical: SPACE[14], paddingHorizontal: SPACE[14] },
  header:    { flexDirection: "row", alignItems: "center", gap: SPACE[6], marginBottom: SPACE[12] },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: PALETTE.success },
  title:     { fontSize: FONT.size.base, fontWeight: FONT.weight.bold, flex: 1 },
  sub:       { fontSize: FONT.size.xs },
  row:       { gap: SPACE[16], paddingRight: SPACE[4] },
  item:      { alignItems: "center", gap: SPACE[6], width: 56 },
  avatarWrap:{ width: 46, height: 46, position: "relative" },
  activeDot: { position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: PALETTE.success, borderWidth: 2 },
  gymBadge:  { position: "absolute", top: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: "#F59E0B", borderWidth: 2 },
  name:      { fontSize: FONT.size.xs, fontWeight: FONT.weight.medium, textAlign: "center", maxWidth: 56 },
});

const pn = StyleSheet.create({
  card:    { borderRadius: RADIUS.xl, borderWidth: 1, overflow: "hidden" },
  inner:   { flexDirection: "row", alignItems: "center", gap: SPACE[12], padding: SPACE[14], paddingRight: 36 },
  iconWrap:{ width: 36, height: 36, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  title:   { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  sub:     { fontSize: FONT.size.xs, marginTop: 2 },
  dismiss: { position: "absolute", top: SPACE[10], right: SPACE[12], padding: SPACE[4] },
});

const nu = StyleSheet.create({
  card:  { flexDirection: "row", alignItems: "center", gap: SPACE[12], borderRadius: RADIUS.xl, borderWidth: 1, padding: SPACE[16] },
  emoji: { fontSize: 24 },
  title: { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  sub:   { fontSize: FONT.size.xs, marginTop: 2 },
});

// ─── New Circle popup styles ──────────────────────────────────────────────────
const nc = StyleSheet.create({
  backdrop:    { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: SPACE[20], zIndex: 100 },
  card:        { width: "100%", borderRadius: RADIUS.xxl, padding: SPACE[20], maxHeight: "80%" },
  closeBtn:    { alignSelf: "flex-end", marginBottom: SPACE[4] },
  top:         { alignItems: "center", gap: SPACE[8] },
  emoji:       { width: 72, height: 72, borderRadius: RADIUS.xl, alignItems: "center", justifyContent: "center" },
  name:        { fontSize: FONT.size.xl, fontWeight: FONT.weight.black, textAlign: "center" },
  chips:       { flexDirection: "row", gap: SPACE[6], flexWrap: "wrap", justifyContent: "center" },
  chip:        { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: RADIUS.pill, paddingHorizontal: SPACE[8], paddingVertical: 3, borderWidth: 1 },
  chipText:    { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
  field:       { flexDirection: "row", alignItems: "flex-start", gap: SPACE[6], paddingHorizontal: SPACE[12], paddingVertical: SPACE[8], borderRadius: RADIUS.md, borderWidth: 1, marginTop: SPACE[4] },
  fieldText:   { flex: 1, fontSize: FONT.size.sm },
  desc:        { fontSize: FONT.size.sm, textAlign: "center", lineHeight: FONT.size.sm * 1.5 },
  divider:     { height: 1, marginVertical: SPACE[14] },
  memberHeader:{ fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 1, marginBottom: SPACE[8] },
  memberRow:   { flexDirection: "row", alignItems: "center", gap: SPACE[10], paddingVertical: SPACE[5] },
  memberName:  { fontSize: FONT.size.md, fontWeight: FONT.weight.semibold },
  joinBtn:     { borderRadius: RADIUS.lg, paddingVertical: SPACE[14], alignItems: "center", marginTop: SPACE[12] },
  joinText:    { color: "#fff", fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },
});

// ─── Session Detail Modal ─────────────────────────────────────────────────────
const MODAL_MONTHS   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MODAL_DAYS     = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const MODAL_MINUTES  = [0,5,10,15,20,25,30,35,40,45,50,55];

function SessionCalendar({ value, onChange, colors }: {
  value: string; onChange: (d: string) => void; colors: any;
}) {
  const today   = new Date();
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
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const dayStr = (d: number) => `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const isSelected = (d: number) => value === dayStr(d);
  const isPast = (d: number) => dayStr(d) < todayStr;

  return (
    <View>
      <View style={sc.calNav}>
        <TouchableOpacity onPress={() => setVm(({year:y,month:m}) => m===0?{year:y-1,month:11}:{year:y,month:m-1})} style={sc.calNavBtn}>
          <Text style={[sc.calNavArrow, { color: colors.brand }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[sc.calMonth, { color: colors.text }]}>{MODAL_MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={() => setVm(({year:y,month:m}) => m===11?{year:y+1,month:0}:{year:y,month:m+1})} style={sc.calNavBtn}>
          <Text style={[sc.calNavArrow, { color: colors.brand }]}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={sc.calDayRow}>
        {MODAL_DAYS.map((d) => (
          <Text key={d} style={[sc.calDayLabel, { color: colors.textMuted }]}>{d}</Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={sc.calWeekRow}>
          {row.map((day, di) => {
            if (!day) return <View key={di} style={sc.calCell} />;
            const past = isPast(day);
            const sel  = isSelected(day);
            return (
              <TouchableOpacity
                key={di}
                style={[sc.calCell, sel && { backgroundColor: colors.brand, borderRadius: 20 }]}
                onPress={() => !past && onChange(dayStr(day))}
                disabled={past}
              >
                <Text style={[sc.calDayNum, { color: sel ? "#fff" : past ? colors.textFaint : colors.text }]}>
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

function SessionDetailModal({ session, onClose, onCancel, onReschedule }: {
  session:       SessionInfo | null;
  onClose:       () => void;
  onCancel:      (id: string) => void;
  onReschedule:  (id: string, date: string, time: string | null) => void;
}) {
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const [view,        setView]        = useState<"detail" | "reschedule">("detail");
  const [newDate,     setNewDate]     = useState("");
  const [newHour,     setNewHour]     = useState(9);
  const [newMinute,   setNewMinute]   = useState(0);
  const [useTime,     setUseTime]     = useState(false);
  const [submitting,  setSubmitting]  = useState(false);

  // Reset when session changes
  useEffect(() => {
    if (session) {
      setView("detail");
      setNewDate(session.session_date);
      if (session.session_time) {
        const [h, m] = session.session_time.split(":").map(Number);
        setNewHour(h ?? 9);
        setNewMinute(MODAL_MINUTES.includes(m) ? m : 0);
        setUseTime(true);
      } else {
        setNewHour(9); setNewMinute(0); setUseTime(false);
      }
      setSubmitting(false);
    }
  }, [session]);

  if (!session) return null;

  const STATUS_COLOR: Record<string, string> = { accepted: "#22C55E", pending: "#F59E0B" };
  const statusColor = STATUS_COLOR[session.status] ?? c.textMuted;

  function formatDetailDate(dateStr: string, timeStr: string | null): string {
    const d = new Date(dateStr + "T12:00:00");
    const label = d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    return timeStr ? `${label}  ·  ${timeStr}` : label;
  }

  async function handleCancel() {
    Alert.alert(
      "Cancel session?",
      `This will cancel your ${session.sport} session with ${session.partner_name}.`,
      [
        { text: "Keep it", style: "cancel" },
        { text: "Cancel session", style: "destructive", onPress: () => onCancel(session.id) },
      ]
    );
  }

  async function handleReschedule() {
    if (!newDate) return;
    setSubmitting(true);
    const timeVal = useTime
      ? `${String(newHour).padStart(2,"0")}:${String(newMinute).padStart(2,"0")}`
      : null;
    await onReschedule(session.id, newDate, timeVal);
    setSubmitting(false);
  }

  return (
    <Pressable style={sd.backdrop} onPress={onClose}>
      <Pressable style={[sd.card, { backgroundColor: c.bgCard }]} onPress={(e) => e.stopPropagation()}>

          {/* Header */}
          <View style={sd.header}>
            <View style={[sd.emojiWrap, { backgroundColor: statusColor + "18" }]}>
              <Text style={{ fontSize: 22 }}>{sportEmoji(session.sport)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[sd.sportName, { color: c.text }]}>{session.sport}</Text>
              <Text style={[sd.partnerText, { color: c.textSecondary }]}>with {session.partner_name}</Text>
            </View>
            <View style={[sd.statusPill, { backgroundColor: statusColor + "18", borderColor: statusColor + "50" }]}>
              <Text style={[sd.statusText, { color: statusColor }]}>{session.status}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={sd.closeBtn} hitSlop={8}>
              <Icon name="close" size={16} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={[sd.divider, { backgroundColor: c.border }]} />

          {view === "detail" ? (
            <>
              {/* Details */}
              <View style={sd.detailRows}>
                <View style={sd.detailRow}>
                  <Text style={sd.detailIcon}>📅</Text>
                  <Text style={[sd.detailText, { color: c.text }]}>
                    {formatDetailDate(session.session_date, session.session_time)}
                  </Text>
                </View>
                {session.location && (
                  <View style={sd.detailRow}>
                    <Text style={sd.detailIcon}>📍</Text>
                    <Text style={[sd.detailText, { color: c.text }]}>{session.location}</Text>
                  </View>
                )}
              </View>

              <View style={[sd.divider, { backgroundColor: c.border }]} />

              {/* Actions */}
              <View style={sd.actions}>
                <TouchableOpacity
                  style={[sd.cancelBtn, { borderColor: c.borderMedium }]}
                  onPress={handleCancel}
                  activeOpacity={0.8}
                >
                  <Text style={[sd.cancelText, { color: c.textMuted }]}>Cancel session</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[sd.rescheduleBtn, { backgroundColor: c.brand }]}
                  onPress={() => setView("reschedule")}
                  activeOpacity={0.85}
                >
                  <Text style={sd.rescheduleText}>Reschedule</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* Reschedule view */}
              <View style={sd.rescheduleContainer}>
                <Text style={[sd.rescheduleTitle, { color: c.text }]}>Pick a new date</Text>
                <SessionCalendar value={newDate} onChange={setNewDate} colors={c} />

                {/* Time toggle */}
                <TouchableOpacity
                  style={[sd.timeToggle, { borderColor: c.border }]}
                  onPress={() => setUseTime((v) => !v)}
                  activeOpacity={0.8}
                >
                  <Text style={[sd.timeToggleText, { color: useTime ? c.brand : c.textMuted }]}>
                    {useTime ? "⏰  Remove time" : "⏰  Add time (optional)"}
                  </Text>
                </TouchableOpacity>

                {useTime && (
                  <View style={sd.timeRow}>
                    {/* Hour spinner */}
                    <View style={[sd.spinnerBox, { borderColor: c.border, backgroundColor: c.bgCardAlt }]}>
                      <TouchableOpacity onPress={() => setNewHour((h) => (h + 1) % 24)} style={sd.spinBtn}>
                        <Text style={[sd.spinArrow, { color: c.brand }]}>▲</Text>
                      </TouchableOpacity>
                      <Text style={[sd.spinValue, { color: c.text }]}>{String(newHour).padStart(2,"0")}</Text>
                      <TouchableOpacity onPress={() => setNewHour((h) => (h - 1 + 24) % 24)} style={sd.spinBtn}>
                        <Text style={[sd.spinArrow, { color: c.brand }]}>▼</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[sd.timeSep, { color: c.text }]}>:</Text>
                    {/* Minute spinner */}
                    <View style={[sd.spinnerBox, { borderColor: c.border, backgroundColor: c.bgCardAlt }]}>
                      <TouchableOpacity onPress={() => setNewMinute((m) => { const i = MODAL_MINUTES.indexOf(m); return MODAL_MINUTES[(i+1)%MODAL_MINUTES.length]; })} style={sd.spinBtn}>
                        <Text style={[sd.spinArrow, { color: c.brand }]}>▲</Text>
                      </TouchableOpacity>
                      <Text style={[sd.spinValue, { color: c.text }]}>{String(newMinute).padStart(2,"0")}</Text>
                      <TouchableOpacity onPress={() => setNewMinute((m) => { const i = MODAL_MINUTES.indexOf(m); return MODAL_MINUTES[(i-1+MODAL_MINUTES.length)%MODAL_MINUTES.length]; })} style={sd.spinBtn}>
                        <Text style={[sd.spinArrow, { color: c.brand }]}>▼</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              <View style={[sd.divider, { backgroundColor: c.border }]} />

              <View style={sd.actions}>
                <TouchableOpacity
                  style={[sd.cancelBtn, { borderColor: c.borderMedium }]}
                  onPress={() => setView("detail")}
                  activeOpacity={0.8}
                >
                  <Text style={[sd.cancelText, { color: c.textMuted }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[sd.rescheduleBtn, { backgroundColor: submitting || !newDate ? c.textFaint : c.brand }]}
                  onPress={handleReschedule}
                  disabled={submitting || !newDate}
                  activeOpacity={0.85}
                >
                  {submitting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={sd.rescheduleText}>Propose</Text>
                  }
                </TouchableOpacity>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
  );
}

const sc = StyleSheet.create({
  calNav:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE[8] },
  calNavBtn:   { padding: SPACE[4], width: 32, alignItems: "center" },
  calNavArrow: { fontSize: 22, fontWeight: "700", lineHeight: 26 },
  calMonth:    { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  calDayRow:   { flexDirection: "row", marginBottom: SPACE[4] },
  calDayLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: FONT.weight.semibold },
  calWeekRow:  { flexDirection: "row" },
  calCell:     { flex: 1, height: 36, alignItems: "center", justifyContent: "center" },
  calDayNum:   { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium },
});

const sd = StyleSheet.create({
  backdrop:           { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: SPACE[24], zIndex: 100 },
  card:               { width: "100%", borderRadius: RADIUS.xl, overflow: "hidden" },
  header:             { flexDirection: "row", alignItems: "center", gap: SPACE[10], padding: SPACE[16] },
  emojiWrap:          { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  sportName:          { fontSize: FONT.size.base, fontWeight: FONT.weight.extrabold },
  partnerText:        { fontSize: FONT.size.xs, marginTop: 1 },
  statusPill:         { paddingHorizontal: SPACE[8], paddingVertical: 3, borderRadius: RADIUS.pill, borderWidth: 1 },
  statusText:         { fontSize: 10, fontWeight: FONT.weight.extrabold, textTransform: "capitalize" },
  closeBtn:           { padding: SPACE[4] },
  divider:            { height: 1 },
  detailRows:         { padding: SPACE[16], gap: SPACE[10] },
  detailRow:          { flexDirection: "row", alignItems: "flex-start", gap: SPACE[10] },
  detailIcon:         { fontSize: 15, lineHeight: 22 },
  detailText:         { fontSize: FONT.size.sm, flex: 1, lineHeight: 22 },
  actions:            { flexDirection: "row", gap: SPACE[10], padding: SPACE[16] },
  cancelBtn:          { flex: 1, paddingVertical: SPACE[12], borderRadius: RADIUS.md, borderWidth: 1, alignItems: "center" },
  cancelText:         { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  rescheduleBtn:      { flex: 1, paddingVertical: SPACE[12], borderRadius: RADIUS.md, alignItems: "center" },
  rescheduleText:     { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold, color: "#fff" },
  rescheduleContainer:{ padding: SPACE[16], gap: SPACE[12] },
  rescheduleTitle:    { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold, marginBottom: SPACE[4] },
  timeToggle:         { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACE[10], alignItems: "center" },
  timeToggleText:     { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium },
  timeRow:            { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE[8] },
  spinnerBox:         { alignItems: "center", borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACE[20], paddingVertical: SPACE[4] },
  spinBtn:            { padding: SPACE[6] },
  spinArrow:          { fontSize: 14, fontWeight: FONT.weight.bold },
  spinValue:          { fontSize: FONT.size.xl, fontWeight: FONT.weight.bold, minWidth: 36, textAlign: "center" },
  timeSep:            { fontSize: FONT.size.xl, fontWeight: FONT.weight.bold },
});

const s = StyleSheet.create({
  root:  { flex: 1 },
  scroll:{ padding: SPACE[20], paddingBottom: SPACE[48], gap: SPACE[20] },
});

const cs = StyleSheet.create({
  banner:      { flexDirection: "row", alignItems: "center", gap: SPACE[14], borderRadius: RADIUS.xl, padding: SPACE[16], borderWidth: 1 },
  bannerEmoji: { fontSize: 28 },
  bannerTitle: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  bannerSub:   { fontSize: FONT.size.sm, marginTop: 2 },
});
