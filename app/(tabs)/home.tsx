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

import React, { useCallback, useEffect, useRef, useState } from "react";
// FM-101: ErrorState for load() failure recovery
import { ErrorState } from "../../components/ui/ErrorState";
import { useFocusEffect , router } from "expo-router";
import {
  ScrollView, ActivityIndicator, Alert, RefreshControl,
  StyleSheet, View, Text, TouchableOpacity, Pressable, TextInput, KeyboardAvoidingView, Platform,
  InteractionManager, ImageBackground, Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { useNotifications } from "../../lib/notificationContext";
import { notifyMatchAccepted } from "../../lib/notifications";
import { notifyUser } from "../../lib/push";
import { useTheme, SPACE, FONT, RADIUS, PALETTE, SHADOW, TYPE } from "../../lib/theme";
import { useAppData } from "../../lib/appDataContext";
import { getSportPhoto } from "../../lib/sportPhotos";
import { Icon } from "../../components/Icon";
import { Avatar } from "../../components/Avatar";

import { HomeSkeleton }            from "../../components/ui/Skeleton";
import { HomeHeader }             from "../../components/home/HomeHeader";
import { PrimaryActionCard }      from "../../components/home/PrimaryActionCard";
import { PendingRequestsSection } from "../../components/home/PendingRequestsSection";
import { BestMatchesSection }     from "../../components/home/BestMatchesSection";
import { SectionHeader }          from "../../components/ui/SectionHeader";
import { CirclesPreviewSection }  from "../../components/home/CirclesPreviewSection";
import { MomentumStrip }          from "../../components/home/MomentumStrip";
import { ProfileSheet }           from "../../components/discover/ProfileSheet";
import { toDiscoverUser, type DiscoverUser, type RequestStatus } from "../../components/discover/PersonCard";

import {
  HomeProfile, PendingRequest, SuggestedUser, SessionInfo, CirclePreview,
  PrimaryAction, computePrimaryAction, buildMatchReasons, localToday,
} from "../../components/home/types";

const NUDGE_KEY              = "profile_nudge_dismissed_at";
const NUDGE_TTL              = 7 * 24 * 60 * 60 * 1000; // 7 days
const DISMISSED_CIRCLES_KEY  = "dismissed_circle_ids";      // new circles (not yet joined)

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
  creator_id:   string | null;
};

type NewCircleMember = {
  id:         string;
  username:   string;
  full_name:  string | null;
  avatar_url: string | null;
};

const SCREEN_H  = Dimensions.get("window").height;
const NC_HERO_H = 200; // hero image height in circle popup

export default function HomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { unreadMessages: unreadCount, unreadCount: notifUnread, refresh: refreshNotifs } = useNotifications();
  const { appUser, appUserLoading: _appUserLoading, updateAppUser, fetchAppUser } = useAppData();

  const [profile,           setProfile]           = useState<HomeProfile | null>(null);
  const [pendingRequests,   setPendingRequests]   = useState<PendingRequest[]>([]);
  const [suggested,         setSuggested]         = useState<SuggestedUser[]>([]);
  const [circles,           setCircles]           = useState<CirclePreview[]>([]);
  const [confirmedSessions, setConfirmedSessions] = useState<SessionInfo[]>([]);
  const [pendingSessions,   setPendingSessions]   = useState<SessionInfo[]>([]);
  const [upcomingSessions,  setUpcomingSessions]  = useState<SessionInfo[]>([]);
  // unreadCount comes from useNotifications() context (realtime)
  const [activePartners,    setActivePartners]    = useState<ActivePartner[]>([]);
  const [profileMissing,    setProfileMissing]    = useState<string[]>([]);
  const [nudgeDismissed,    setNudgeDismissed]    = useState(false);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState(false);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => { setLoading(false); setError(true); }, 30_000);
    return () => clearTimeout(t);
  }, [loading]);

  // Fix 2: mark unmounted so async load() won't setState after component gone
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [refreshing,        setRefreshing]        = useState(false);
  const [gymToggling,       setGymToggling]       = useState(false);
  const [sheetUser,         setSheetUser]         = useState<DiscoverUser | null>(null);
  const [sheetStatus,       setSheetStatus]       = useState<RequestStatus>("none");
  const [newCircles,        setNewCircles]        = useState<NewCircle[]>([]);
  const [selectedNewCircle, setSelectedNewCircle] = useState<NewCircle | null>(null);
  const [newCircleMembers,  setNewCircleMembers]  = useState<NewCircleMember[]>([]);
  const [loadingCircleMem,  setLoadingCircleMem]  = useState(false);
  const [selectedCircle,    setSelectedCircle]    = useState<CirclePreview | null>(null);
  const [circleMembers,     setCircleMembers]     = useState<NewCircleMember[]>([]);
  const [loadingCircle,     setLoadingCircle]     = useState(false);
  const [selectedSession,   setSelectedSession]   = useState<SessionInfo | null>(null);

  const today    = localToday();
  const lastLoadRef    = useRef(0);
  const loadingRef     = useRef(false);  // Fix 1: prevent double-fire
  const mountedRef     = useRef(true);   // Fix 2: prevent setState after unmount
  const STALE_MS = 30_000; // 30s cache — keep PrimaryActionCard fresh
  const dismissedCircleIdsRef   = useRef<Set<string>>(new Set());
  const dismissedMyCircleIdsRef = useRef<Set<string>>(new Set());

  // Check nudge dismiss state once on mount
  useEffect(() => {
    AsyncStorage.getItem(NUDGE_KEY).then((val) => {
      if (val) {
        const dismissed = parseInt(val, 10);
        if (Date.now() - dismissed < NUDGE_TTL) setNudgeDismissed(true);
      }
    });
    // Load permanently dismissed new-circle IDs (undiscovered circles only)
    AsyncStorage.getItem(DISMISSED_CIRCLES_KEY).then((val) => {
      if (val) { try { dismissedCircleIdsRef.current = new Set(JSON.parse(val)); } catch {} }
    });
    // My circles dismiss is session-only (not persisted) — new events re-surface circles
  }, []);

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    if (loadingRef.current) return; // Fix 1: block concurrent calls
    loadingRef.current = true;
    try {
    if (mountedRef.current) setError(false);
    if (!isRefresh && mountedRef.current) setLoading(true);
    let { data: { user } } = await supabase.auth.getUser();
    // After a crash the session JWT may be stale — refresh once and retry
    if (!user) {
      await supabase.auth.refreshSession().catch(() => {});
      ({ data: { user } } = await supabase.auth.getUser());
    }
    if (!user) return;
    const uid = user.id;

    // Use global AppDataContext for own profile; fall back to direct fetch if context failed
    const profileData = appUser ?? await fetchAppUser();
    if (!profileData) throw new Error("Could not load user profile");

    // Update last_active after render — deferred so it doesn't block the RPC
    InteractionManager.runAfterInteractions(() => {
      supabase.from("users").update({ last_active: new Date().toISOString() }).eq("id", uid).then(() => {});
    });

    // ── Fix 6: Single RPC replaces ~13 sequential/parallel queries ────────────
    const { data: homeData, error: rpcError } = await supabase
      .rpc("get_home_data", { p_user_id: uid });
    if (rpcError) throw rpcError;

    const hd = homeData as any;

    // Auto-expire gym status after 3 hours
    let atGym = profileData.is_at_gym ?? false;
    if (atGym && profileData.gym_checkin_at) {
      const age = Date.now() - new Date(profileData.gym_checkin_at).getTime();
      if (age > 3 * 60 * 60 * 1000) {
        atGym = false;
        supabase.from("users").update({ is_at_gym: false, gym_checkin_at: null }).eq("id", uid).then(() => {});
        updateAppUser({ is_at_gym: false, gym_checkin_at: null });
      }
    }

    if (!mountedRef.current) return; // Fix 2: component may have unmounted during await

    setProfile({
      id:                  uid,
      username:            profileData.username ?? "",
      full_name:           profileData.full_name ?? null,
      avatar_url:          profileData.avatar_url ?? null,
      current_streak:      profileData.current_streak ?? 0,
      last_checkin_date:   profileData.last_checkin_date ?? null,
      match_count:         hd.match_count ?? 0,
      workout_count_month: hd.workout_count_month ?? 0,
      is_at_gym:           atGym,
      gym_checkin_at:      profileData.gym_checkin_at ?? null,
      gym_name:            profileData.gym_name ?? null,
    });

    // Profile completeness check
    const missing: string[] = [];
    if (!profileData?.sports?.length) missing.push("sports");
    if (!profileData?.bio)            missing.push("bio");
    if (!profileData?.city)           missing.push("city");
    setProfileMissing(missing);

    // Pending match requests
    setPendingRequests((hd.pending_requests ?? []).map((m: any) => ({
      id:            m.id,
      sender_id:     m.sender_id,
      username:      m.username,
      full_name:     m.full_name,
      avatar_url:    m.avatar_url ?? null,
      city:          m.city,
      fitness_level: m.fitness_level,
    })));

    // Today's sessions
    const allSessions: SessionInfo[] = (hd.sessions_today ?? []).map((s: any) => ({
      id:           s.id,
      match_id:     s.match_id,
      sport:        s.sport ?? "Session",
      session_date: s.session_date ?? today,
      session_time: s.session_time ?? null,
      location:     s.location ?? null,
      status:       s.status,
      partner_name: s.partner_name ?? "Partner",
    }));
    setConfirmedSessions(allSessions.filter((s) => s.status === "accepted"));
    setPendingSessions(allSessions.filter((s) =>
      s.status === "pending" &&
      (hd.sessions_today ?? []).find((r: any) => r.id === s.id)?.receiver_id === uid
    ));

    // Upcoming sessions
    setUpcomingSessions((hd.upcoming_sessions ?? []).map((s: any) => ({
      id:           s.id,
      match_id:     s.match_id,
      sport:        s.sport ?? "Session",
      session_date: s.session_date,
      session_time: s.session_time ?? null,
      location:     s.location ?? null,
      status:       s.status,
      partner_name: s.partner_name ?? "Partner",
    })));

    // My circles (active only, not dismissed).
    // Circles with an upcoming event (within the next 7 days) sort first so
    // "scheduled for Sunday" style info is visible above the fold — previously
    // events could sit in the 3rd or 4th grid slot and get missed.
    const todayStr = today;
    const sevenDaysOut = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const rankCircle = (cc: any): number => {
      if (!cc.event_date) return 2;
      if (cc.event_date >= todayStr && cc.event_date <= sevenDaysOut) return 0; // this week
      if (cc.event_date >= todayStr) return 1; // later this month+
      return 3;
    };
    setCircles((hd.my_circles ?? [])
      .filter((cc: any) =>
        (!cc.event_date || cc.event_date >= todayStr) &&
        !dismissedMyCircleIdsRef.current.has(cc.id)
      )
      .sort((a: any, b: any) => {
        const r = rankCircle(a) - rankCircle(b);
        if (r !== 0) return r;
        if (a.event_date && b.event_date) return a.event_date.localeCompare(b.event_date);
        return 0;
      })
      .map((cc: any) => ({
        id:           cc.id,
        name:         cc.name,
        icon:         cc.avatar_emoji ?? "🏋️",
        member_count: cc.member_count ?? 0,
        sport:        cc.sport ?? null,
        city:         cc.city ?? null,
        field:        cc.field ?? null,
        description:  cc.description ?? null,
        event_date:   cc.event_date ?? null,
        event_time:   cc.event_time ?? null,
        creator_id:   cc.creator_id ?? null,
      })));

    // Active partners (within 2 hours) from accepted_matches
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const activeP = (hd.accepted_matches ?? []).filter((m: any) =>
      m.last_active && m.last_active >= twoHoursAgo
    );
    setActivePartners(activeP.map((m: any) => ({
      id:         m.partner_id,
      username:   m.username,
      full_name:  m.full_name ?? null,
      avatar_url: m.avatar_url ?? null,
      is_at_gym:  m.is_at_gym ?? false,
      match_id:   m.match_id,
    })));

    // Suggested users — score client-side (data already filtered by RPC)
    const mySports = profileData?.sports ?? [];
    const myCity   = profileData?.city ?? "";
    const myLevel  = profileData?.fitness_level ?? "";
    const scored = (hd.candidates ?? [])
      .map((u: any) => {
        const shared  = (mySports as string[]).filter((s: string) => (u.sports ?? []).includes(s));
        let score     = shared.length * 30;
        if (myLevel && u.fitness_level === myLevel)                   score += 20;
        if (myCity && u.city?.toLowerCase() === myCity.toLowerCase()) score += 25;
        const reasons = buildMatchReasons(u, { ...profileData, sports: profileData?.sports ?? undefined });
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

    // New circles (RPC already filtered: last 7 days, not joined, max 20)
    const myCircleIds = new Set((hd.my_circles ?? []).map((c: any) => c.id as string));
    const userSports: string[] = profileData?.sports ?? [];
    const matchingNew = (hd.new_circles ?? []).filter((cc: any) =>
      !myCircleIds.has(cc.id) &&
      !dismissedCircleIdsRef.current.has(cc.id) &&
      (!cc.event_date || cc.event_date >= todayStr) &&
      userSports.some((sp) =>
        cc.sport?.toLowerCase().includes(sp.toLowerCase()) ||
        sp.toLowerCase().includes(cc.sport?.toLowerCase() ?? "")
      )
    );
    setNewCircles(matchingNew.map((cc: any) => ({
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
      member_count: cc.member_count ?? 0,
      creator_id:   cc.creator_id ?? null,
    })));

    lastLoadRef.current = Date.now();
    } catch (err) {
      console.error("[Home] load failed:", err);
      if (!mountedRef.current) return;
      if (isRefresh) {
        Alert.alert("Error", "Could not refresh. Please try again.");
      } else {
        setError(true);
      }
    } finally {
      loadingRef.current = false; // Fix 1: release lock
      if (mountedRef.current) setLoading(false);
    }
  }, [today, appUser, updateAppUser, fetchAppUser]);

  // Trigger load immediately on mount — load() handles fetchAppUser() fallback internally
  useEffect(() => {
    if (!profile && !loadingRef.current) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only; useFocusEffect covers stale re-fetch

  useFocusEffect(useCallback(() => {
    // Always refresh notification counts (instant — from context)
    refreshNotifs();
    // Skip heavy re-fetch if data was loaded recently
    const elapsed = Date.now() - lastLoadRef.current;
    if (elapsed > STALE_MS || !profile) {
      load();
    }
    // Close any open modal when the tab loses focus
    return () => { setSelectedSession(null); };
  }, [load, profile, refreshNotifs]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const [checkingIn, setCheckingIn] = useState(false);

  async function logWorkout() {
    if (!profile || checkingIn) return;
    setCheckingIn(true);
    try {
      // Atomic RPC: handles consecutive-day logic + duplicate prevention server-side
      const { data: result, error: rpcError } = await supabase.rpc("log_checkin", {
        p_user_id: profile.id,
      });
      if (rpcError) throw rpcError;

      // AC1: server already rejected the duplicate — show button as done, no other side effects
      if (result?.already_checked_in) {
        setProfile((p) => p ? { ...p, last_checkin_date: today } : p);
        return;
      }

      const newStreak = result?.streak ?? profile.current_streak + 1;

      await supabase.from("feed_posts").insert({
        user_id:   profile.id,
        post_type: "workout",
        content:   newStreak > 1 ? `Day ${newStreak} streak! 🔥` : "Just logged my first workout!",
        meta:      { streak: newStreak },
      });

      // Notify partners once per day (server enforced via RPC; client skips if already checked in)
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
      // Mirror into AppDataContext so any reader that prefers `appUser`
      // (Home header streak badge, Activity tab, etc) sees the new value
      // immediately. Without this, users tap Check In and the streak
      // indicator stays at the old value until the next refresh.
      updateAppUser({ current_streak: newStreak, last_checkin_date: today });
    } catch (err) {
      console.error("[logWorkout] failed:", err);
      Alert.alert("Error", "Could not log your workout. Please try again.");
    } finally {
      setCheckingIn(false);
    }
  }

  async function toggleGym() {
    if (!profile) return;
    setGymToggling(true);
    const next = !profile.is_at_gym;
    const checkinAt = next ? new Date().toISOString() : null;
    await supabase.from("users").update({
      is_at_gym:      next,
      gym_checkin_at: checkinAt,
    }).eq("id", profile.id);
    setProfile((p) => p ? { ...p, is_at_gym: next, gym_checkin_at: checkinAt } : p);
    updateAppUser({ is_at_gym: next, gym_checkin_at: checkinAt });
    setGymToggling(false);
  }

  async function respondToMatch(matchId: string, status: "accepted" | "declined") {
    const req = pendingRequests.find((p) => p.id === matchId);
    await supabase.from("matches").update({ status }).eq("id", matchId);
    setPendingRequests((prev) => prev.filter((p) => p.id !== matchId));
    if (status === "accepted" && req) {
      setProfile((p) => p ? { ...p, match_count: p.match_count + 1 } : p);
      const myName = profile?.full_name ?? profile?.username ?? "Someone";
      // Local notification for myself
      notifyMatchAccepted(req.full_name ?? req.username, matchId);
      // Notify the sender
      notifyUser(req.sender_id, {
        type: "match_accepted",
        title: "Match Accepted! 🎉",
        body: `${myName} accepted your request. Start chatting!`,
        relatedId: matchId,
        data: { type: "match_accepted", matchId },
      });
    }
  }

  async function openMatchProfile(suggested: SuggestedUser) {
    if (!profile) return;
    // Peer profile fetch — lat/lng intentionally excluded.
    // If distance to this partner is needed in future, use the
    // get_nearby_users RPC with p_only_id, which returns server-
    // computed distance_km without exposing raw coords.
    const { data } = await supabase
      .from("users")
      .select("id, username, full_name, avatar_url, bio, city, fitness_level, age, gender, sports, current_streak, last_active, is_at_gym, availability, training_intent")
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

    // Compute matchScore using same logic as Discover (sports overlap + level + city)
    const mySports   = appUser?.sports ?? [];
    const myLevel    = appUser?.fitness_level ?? "";
    const myCity     = appUser?.city ?? "";
    const myAvail    = appUser?.availability ?? {};
    const theirSports = data.sports ?? [];
    const shared     = mySports.filter((s: string) => theirSports.includes(s));
    let computedScore = shared.length > 0 && theirSports.length > 0
      ? Math.round((shared.length / Math.min(mySports.length, theirSports.length)) * 30) : 0;
    if (myLevel && data.fitness_level === myLevel) computedScore += 20;
    const mySlots    = Object.entries(myAvail as Record<string, boolean>).filter(([, v]) => v).map(([k]) => k);
    const theirSlots = Object.entries((data.availability ?? {}) as Record<string, boolean>).filter(([, v]) => v).map(([k]) => k);
    if (mySlots.length > 0 && theirSlots.length > 0) {
      const avOverlap = mySlots.filter((s) => theirSlots.includes(s)).length;
      computedScore += Math.round((avOverlap / Math.max(mySlots.length, theirSlots.length)) * 15);
    }
    if (data.last_active) {
      const hrs = (Date.now() - new Date(data.last_active).getTime()) / 3600000;
      if (hrs <= 24) computedScore += 20; else if (hrs <= 72) computedScore += 12; else if (hrs <= 168) computedScore += 5;
    }
    if (data.is_at_gym) computedScore += 10;
    if (!appUser?.training_intent || !data.training_intent) computedScore += 5; // neutral intent
    if (myCity && data.city?.toLowerCase() === myCity.toLowerCase()) computedScore += 15;
    computedScore = Math.min(computedScore, 100);

    setSheetStatus(status);
    setSheetUser(toDiscoverUser(data, { matchScore: computedScore, reasons: suggested.reasons, isNew: false }));
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

  async function openMyCircle(circle: CirclePreview) {
    setSelectedCircle(circle);
    setLoadingCircle(true);
    const { data } = await supabase
      .from("community_members")
      .select("user:users(id, username, full_name, avatar_url)")
      .eq("community_id", circle.id);
    setCircleMembers(
      (data ?? []).map((row: any) => row.user).filter(Boolean) as NewCircleMember[]
    );
    setLoadingCircle(false);
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
  // Fix 7: Progressive loading — header/strip render instantly from appUser cache.
  // Only the dynamic sections skeleton while the RPC loads.
  // Full-screen skeleton only shown on very first load (no appUser yet).
  if (loading && !appUser) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <HomeSkeleton />
      </SafeAreaView>
    );
  }

  if (error && !profile) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <ErrorState onRetry={load} message="Could not load your home feed." />
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
        {/* ── Header + stats: always instant — sourced from appUser context cache ── */}
        <HomeHeader
          name={name}
          avatarUrl={appUser?.avatar_url ?? profile?.avatar_url}
          unreadCount={notifUnread}
          streak={appUser?.current_streak ?? profile?.current_streak ?? 0}
          isAtGym={profile?.is_at_gym ?? false}
        />

        <MomentumStrip
          streak={appUser?.current_streak ?? profile?.current_streak ?? 0}
          matchCount={profile?.match_count ?? 0}
          weekSessions={upcomingSessions.length}
          circlesCount={circles.length}
        />

        {/* ── Active partners — real people, surfaces immediately ── */}
        {activePartners.length > 0 && <ActiveNowStrip partners={activePartners} />}

        {/* ── Partner spotlight — community moment card ── */}
        {activePartners.length > 0 && (
          <PartnerSpotlight partner={activePartners[0]} />
        )}

        {/* ── Primary action: skeleton while loading, real card after RPC returns ── */}
        {loading && !profile
          ? <HomeSkeleton sectionsOnly />
          : <PrimaryActionCard action={primaryAction} onLogWorkout={logWorkout} checkingIn={checkingIn} />
        }

        {/* Gym strip only when primary card isn't already showing the gym prompt */}
        {showGymStrip && (
          <GymStrip
            isAtGym={profile?.is_at_gym ?? false}
            toggling={gymToggling}
            onToggle={toggleGym}
            gymName={profile?.gym_name ?? null}
          />
        )}

        {/* ── Your Sessions ── */}
        {upcomingSessions.length > 0 && (
          <UpcomingSessionsSection
            sessions={upcomingSessions}
            onSelect={setSelectedSession}
          />
        )}

        {/* ── Onboarding nudges — mutually exclusive ── */}
        {isNewUser
          ? <NewUserCard />
          : (!nudgeDismissed && profileMissing.length > 0) && (
              <ProfileNudge missing={profileMissing} onDismiss={dismissNudge} />
            )
        }

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
          onDismiss={(id) => {
            // Remove from UI
            setNewCircles((prev) => prev.filter((c) => c.id !== id));
            // Persist so it never shows again on this device
            dismissedCircleIdsRef.current.add(id);
            AsyncStorage.setItem(DISMISSED_CIRCLES_KEY, JSON.stringify([...dismissedCircleIdsRef.current]));
          }}
        />

        <CirclesPreviewSection
          circles={circles}
          onPress={openMyCircle}
          onDismiss={(id) => {
            setCircles((prev) => prev.filter((cc) => cc.id !== id));
            dismissedMyCircleIdsRef.current.add(id); // session-only hide
          }}
        />

        {/* ── Challenges shortcut ── */}
        <TouchableOpacity
          style={[cs.banner, { backgroundColor: c.bgCard, borderColor: c.border }]}
          onPress={() => router.push("/(tabs)/challenges" as any)}
          activeOpacity={0.8}
        >
          <View style={[cs.iconWrap, { backgroundColor: "#F59E0B18" }]}>
            <Icon name="leaderboard" size={22} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[cs.bannerTitle, { color: c.text }]}>Community Challenges</Text>
            <Text style={[cs.bannerSub, { color: c.textMuted }]}>Compete with local athletes</Text>
          </View>
          <View style={[cs.pill, { backgroundColor: c.brandSubtle }]}>
            <Text style={[cs.pillText, { color: c.brand }]}>Join</Text>
          </View>
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
        <NewCircleModal
          circle={selectedNewCircle}
          members={newCircleMembers}
          loadingMembers={loadingCircleMem}
          currentUserId={profile?.id ?? null}
          onJoin={() => joinCircle(selectedNewCircle.id)}
          onDismiss={() => {
            setSelectedNewCircle(null);
            // Persist dismiss so it never shows on home again
            dismissedCircleIdsRef.current.add(selectedNewCircle.id);
            setNewCircles((prev) => prev.filter((c) => c.id !== selectedNewCircle.id));
            AsyncStorage.setItem(DISMISSED_CIRCLES_KEY, JSON.stringify([...dismissedCircleIdsRef.current]));
          }}
          onClose={() => setSelectedNewCircle(null)}
        />
      )}

      {/* ── My Circle detail popup (Local Circles) ──────────────────── */}
      {selectedCircle && (
        <MyCircleModal
          circle={selectedCircle}
          members={circleMembers}
          loadingMembers={loadingCircle}
          currentUserId={profile?.id ?? null}
          onCancelCircle={(id) => setCircles((prev) => prev.filter((cc) => cc.id !== id))}
          onClose={() => setSelectedCircle(null)}
        />
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

  const STATUS: Record<string, { color: string; bg: string; dot: string }> = {
    accepted: { color: "#16A34A", bg: "#DCFCE7", dot: "#16A34A" },
    pending:  { color: "#D97706", bg: "#FEF3C7", dot: "#D97706" },
  };

  return (
    <View style={{ gap: SPACE[10] }}>
      <SectionHeader
        title="Your Sessions"
        count={sessions.length}
        action={{ label: "See all", onPress: () => router.push("/(tabs)/messages") }}
      />

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
                    <View style={[us.badgeDot, { backgroundColor: st.dot }]} />
                    <Text style={[us.badgeText, { color: st.color }]}>
                      {sess.status === "accepted" ? "Confirmed" : "Pending"}
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


const us = StyleSheet.create({
  card:         { borderRadius: RADIUS.xl, borderWidth: 1, overflow: "hidden" },
  row:          { flexDirection: "row", alignItems: "center", gap: SPACE[12], paddingHorizontal: SPACE[16], paddingVertical: SPACE[16] },
  iconWrap:     { width: 42, height: 42, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  rowTop:       { flexDirection: "row", alignItems: "center", gap: SPACE[8] },
  sport:        { ...TYPE.bodyMedium, flex: 1 },
  partnerName:  { fontWeight: FONT.weight.bold },
  badge:        { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: SPACE[10], paddingVertical: 4, borderRadius: RADIUS.pill },
  badgeDot:     { width: 6, height: 6, borderRadius: 3 },
  badgeText:    { fontSize: 12, fontWeight: FONT.weight.bold },
  meta:         { ...TYPE.caption },
  locRow:       { flexDirection: "row", alignItems: "center", gap: SPACE[4] },
});

// ─── Gym Strip ────────────────────────────────────────────────────────────────
function GymStrip({ isAtGym, toggling, onToggle, gymName }: {
  isAtGym: boolean; toggling: boolean; onToggle: () => void; gymName?: string | null;
}) {
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const activeBg     = isDark ? "#0D2D1A" : "#ECFDF5";
  const activeBorder = isDark ? "#166534" : "#BBF7D0";
  const pinColor     = isAtGym ? PALETTE.success : c.brand;
  const cardBg       = isAtGym ? activeBg     : c.bgCard;
  const cardBorder   = isAtGym ? activeBorder : c.border;

  return (
    <TouchableOpacity
      style={[gs.card, SHADOW.md, { backgroundColor: cardBg, borderColor: cardBorder }]}
      onPress={onToggle}
      activeOpacity={0.75}
      disabled={toggling}
    >
      {/* Top section — icon + title + subtitle */}
      <View style={gs.topRow}>
        <View style={[gs.pinWrap, { backgroundColor: isAtGym ? "#22C55E18" : c.brandSubtle }]}>
          {toggling
            ? <ActivityIndicator size="small" color={pinColor} />
            : <Icon name="location" size={24} color={pinColor} />
          }
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[gs.label, { color: isAtGym ? PALETTE.success : c.text }]}>
            {isAtGym ? "You're checked in" : "Check in at gym"}
          </Text>
          <Text style={[gs.sublabel, { color: c.textMuted }]}>
            {isAtGym ? "Tap to check out" : "Find partners at your gym"}
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={[gs.divider, { backgroundColor: cardBorder }]} />

      {/* Bottom section — gym name */}
      <View style={gs.bottomRow}>
        <Icon name="location" size={13} color={c.textMuted} />
        <Text style={[gs.gymNameText, { color: c.textMuted }]}>
          {gymName ?? "Your gym"}
        </Text>
        {isAtGym && (
          <>
            <View style={gs.activeDot} />
            <Text style={gs.activeText}>Active now</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Active Now Strip ─────────────────────────────────────────────────────────
function ActiveNowStrip({ partners }: { partners: ActivePartner[] }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const atGymCount = partners.filter((p) => p.is_at_gym).length;

  return (
    <View style={{ gap: SPACE[12] }}>
      {/* Section label */}
      <View style={an.headerRow}>
        <View style={an.liveRow}>
          <View style={an.dot} />
          <Text style={[an.title, { color: c.text }]}>Active Now</Text>
        </View>
        <Text style={[an.sub, { color: c.textMuted }]}>
          {atGymCount > 0 ? `${atGymCount} at gym · ` : ""}{partners.length} partner{partners.length > 1 ? "s" : ""}
        </Text>
      </View>

      {/* Horizontal scroll of partner cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={an.row}>
        {partners.map((p) => (
          <Pressable
            key={p.id}
            style={[an.card, { backgroundColor: c.bgCard, borderColor: p.is_at_gym ? PALETTE.success + "60" : c.border }, SHADOW.sm]}
            onPress={() => router.push(`/chat/${p.match_id}` as any)}
          >
            <View style={an.avatarWrap}>
              <Avatar url={p.avatar_url} name={p.full_name ?? p.username} size={64} />
              <View style={[an.activeDot, { borderColor: c.bgCard, backgroundColor: p.is_at_gym ? "#F59E0B" : PALETTE.success }]} />
            </View>
            <Text style={[an.name, { color: c.text }]} numberOfLines={1}>
              {p.full_name?.split(" ")[0] ?? p.username}
            </Text>
            <View style={[an.statusPill, { backgroundColor: p.is_at_gym ? "#F59E0B18" : PALETTE.success + "18" }]}>
              <Text style={[an.statusText, { color: p.is_at_gym ? "#F59E0B" : PALETTE.success }]}>
                {p.is_at_gym ? "At gym" : "Active"}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Partner Spotlight ────────────────────────────────────────────────────────
const GYM_PHOTO_URL = "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900&q=80";

function PartnerSpotlight({ partner }: { partner: ActivePartner }) {
  const firstName = partner.full_name?.split(" ")[0] ?? partner.username;
  const isAtGym   = partner.is_at_gym;

  return (
    <ImageBackground
      source={{ uri: GYM_PHOTO_URL }}
      style={ps.card}
      imageStyle={{ borderRadius: RADIUS.xxl }}
      resizeMode="cover"
    >
      <LinearGradient
        colors={isAtGym
          ? ["rgba(0,0,0,0.05)", "rgba(5,30,15,0.88)"]
          : ["rgba(0,0,0,0.05)", "rgba(0,0,0,0.80)"]}
        style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.xxl }]}
      />

      <View style={ps.content}>
        {/* Live pill */}
        <View style={[ps.livePill, { backgroundColor: isAtGym ? PALETTE.success + "CC" : "rgba(255,255,255,0.20)" }]}>
          <View style={[ps.liveDot, { backgroundColor: isAtGym ? "#fff" : PALETTE.success }]} />
          <Text style={ps.liveText}>{isAtGym ? "Live at gym" : "Active"}</Text>
        </View>

        {/* Avatar + name */}
        <View style={ps.row}>
          <Avatar url={partner.avatar_url} name={partner.full_name ?? partner.username} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={ps.name}>{firstName}</Text>
            <Text style={ps.sub}>
              {isAtGym ? "Training right now — send a message" : "Recently active · tap to say hello"}
            </Text>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={ps.cta}
          onPress={() => router.push(`/chat/${partner.match_id}` as any)}
          activeOpacity={0.85}
        >
          <Icon name="chatActive" size={16} color="#fff" />
          <Text style={ps.ctaText}>Message {firstName}</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const ps = StyleSheet.create({
  card:     { height: 190, borderRadius: RADIUS.xxl, overflow: "hidden", justifyContent: "flex-end" },
  content:  { padding: SPACE[16], gap: SPACE[12] },
  livePill: { flexDirection: "row", alignItems: "center", gap: SPACE[4], alignSelf: "flex-start",
              paddingHorizontal: SPACE[10], paddingVertical: 4, borderRadius: RADIUS.pill },
  liveDot:  { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 11, fontWeight: FONT.weight.extrabold, color: "#fff", letterSpacing: 0.3 },
  row:      { flexDirection: "row", alignItems: "center", gap: SPACE[12] },
  name:     { fontSize: FONT.size.lg, fontWeight: FONT.weight.black, color: "#fff", letterSpacing: -0.3 },
  sub:      { fontSize: FONT.size.xs, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  cta:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE[8],
              backgroundColor: "rgba(255,255,255,0.18)", borderRadius: RADIUS.pill,
              paddingVertical: SPACE[12], borderWidth: 1, borderColor: "rgba(255,255,255,0.30)" },
  ctaText:  { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold, color: "#fff" },
});

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
      <View style={[nu.iconWrap, { backgroundColor: c.brand + "20" }]}>
        <Icon name="discoverActive" size={20} color={c.brand} />
      </View>
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
    <View style={{ gap: SPACE[10] }}>
      <SectionHeader
        title="New Circles For You"
        action={{ label: "See all", onPress: () => router.push("/(tabs)/circles" as any) }}
      />
      {circles.map((circle) => (
        <TouchableOpacity
          key={circle.id}
          style={[ncr.row, { backgroundColor: c.bgCard, borderColor: c.brandBorder }, SHADOW.sm]}
          onPress={() => onPress(circle)}
          activeOpacity={0.85}
        >
          <View style={[ncr.emojiWrap, { backgroundColor: c.bgCardAlt }]}>
            <Text style={ncr.emoji}>{circle.avatar_emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[ncr.name, { color: c.text }]} numberOfLines={1}>{circle.name}</Text>
            <Text style={[ncr.meta, { color: c.textMuted }]}>
              {[circle.sport, circle.city].filter(Boolean).join(" · ") || "New circle"}
            </Text>
          </View>
          <TouchableOpacity
            style={[ncr.joinBtn, { backgroundColor: c.brand }]}
            onPress={(e) => { e.stopPropagation(); onJoin(circle.id); }}
            activeOpacity={0.85}
          >
            <Text style={ncr.joinTxt}>Join</Text>
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
  card:        { borderRadius: RADIUS.xl, borderWidth: 1, overflow: "hidden" },
  topRow:      { flexDirection: "row", alignItems: "center", gap: SPACE[14], paddingHorizontal: SPACE[16], paddingTop: SPACE[16], paddingBottom: SPACE[14] },
  pinWrap:     { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  label:       { ...TYPE.cardTitle },
  sublabel:    { fontSize: FONT.size.sm, marginTop: 2 },
  divider:     { height: 1, marginHorizontal: SPACE[16] },
  bottomRow:   { flexDirection: "row", alignItems: "center", gap: SPACE[6], paddingHorizontal: SPACE[16], paddingVertical: SPACE[12] },
  gymNameText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium, flex: 1 },
  activeDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E" },
  activeText:  { fontSize: 12, fontWeight: FONT.weight.bold, color: "#22C55E" },
});

const an = StyleSheet.create({
  headerRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  liveRow:    { flexDirection: "row", alignItems: "center", gap: SPACE[6] },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: PALETTE.success },
  title:      { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  sub:        { fontSize: FONT.size.xs },
  row:        { gap: SPACE[10], paddingRight: SPACE[4] },
  card:       { alignItems: "center", gap: SPACE[8], padding: SPACE[14],
                borderRadius: RADIUS.xl, borderWidth: 1, width: 100 },
  avatarWrap: { width: 64, height: 64, position: "relative" },
  activeDot:  { position: "absolute", bottom: 1, right: 1, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  name:       { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold, textAlign: "center" },
  statusPill: { paddingHorizontal: SPACE[8], paddingVertical: 3, borderRadius: RADIUS.pill },
  statusText: { fontSize: 10, fontWeight: FONT.weight.bold },
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
  card:     { flexDirection: "row", alignItems: "center", gap: SPACE[12], borderRadius: RADIUS.xl, borderWidth: 1, padding: SPACE[16] },
  iconWrap: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  title:    { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  sub:      { fontSize: FONT.size.xs, marginTop: 2 },
});

// ─── New Circles row styles ───────────────────────────────────────────────────
const ncr = StyleSheet.create({
  row:      { flexDirection: "row", alignItems: "center", gap: SPACE[12], paddingHorizontal: SPACE[14], paddingVertical: SPACE[14], borderRadius: RADIUS.xl, borderWidth: 1 },
  emojiWrap:{ width: 46, height: 46, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center" },
  emoji:    { fontSize: 22 },
  name:     { fontSize: FONT.size.md, fontWeight: FONT.weight.bold },
  meta:     { fontSize: FONT.size.xs, marginTop: 2 },
  joinBtn:  { paddingHorizontal: SPACE[14], paddingVertical: SPACE[8], borderRadius: RADIUS.pill },
  joinTxt:  { color: "#fff", fontWeight: FONT.weight.bold, fontSize: FONT.size.sm },
});

// ─── Sport background photos — see lib/sportPhotos.ts ────────────────────────

// ─── New Circle Modal ─────────────────────────────────────────────────────────
function NewCircleModal({ circle, members, loadingMembers, currentUserId, onJoin, onDismiss, onClose }: {
  circle:          NewCircle;
  members:         NewCircleMember[];
  loadingMembers:  boolean;
  currentUserId:   string | null;
  onJoin:          () => void;
  onDismiss:       () => void;  // X = dismiss forever from home
  onClose:         () => void;  // close without dismissing
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isCreator = circle.creator_id !== null && circle.creator_id === currentUserId;
  const photoUrl  = getSportPhoto(circle.sport, circle.name);

  return (
    <Pressable style={nc.backdrop} onPress={onClose}>
      <Pressable style={nc.sheet} onPress={(e) => e.stopPropagation()}>

        {/* ── Sport hero image with gradient ── */}
        <View style={nc.heroWrap}>
          <Image
            source={{ uri: photoUrl }}
            style={nc.heroImg}
            contentFit="cover"
            cachePolicy="disk"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.75)"]}
            style={nc.heroGrad}
          />
          {/* Close (X) — top-right */}
          <TouchableOpacity style={nc.closeBtn} onPress={onClose} hitSlop={12}>
            <View style={nc.closeBg}>
              <Icon name="close" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          {/* Sport badge — top-left */}
          {circle.sport && (
            <View style={nc.sportBadge}>
              <Text style={nc.sportBadgeText}>{circle.sport}</Text>
            </View>
          )}
          {/* Circle name overlaid on gradient */}
          <View style={nc.heroBottom}>
            <Text style={nc.heroName} numberOfLines={2}>{circle.name}</Text>
            {circle.city && (
              <View style={nc.heroLocRow}>
                <Icon name="location" size={12} color="rgba(255,255,255,0.8)" />
                <Text style={nc.heroLoc}>{circle.city}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Details body ── */}
        <ScrollView
          style={{ backgroundColor: c.bgCard, maxHeight: NC_BODY_MAX_H }}
          contentContainerStyle={nc.body}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Date & Location */}
          {(circle.event_date || circle.field) && (
            <View style={nc.metaRow}>
              {circle.event_date && (
                <View style={[nc.metaChip, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                  <Icon name="calendar" size={12} color={c.textMuted} />
                  <Text style={[nc.metaText, { color: c.textSecondary }]}>
                    {formatNewCircleDate(circle.event_date)}{circle.event_time ? `  ·  ${circle.event_time}` : ""}
                  </Text>
                </View>
              )}
              {circle.field && (
                <View style={[nc.metaChip, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                  <Icon name="location" size={12} color={c.textMuted} />
                  <Text style={[nc.metaText, { color: c.textSecondary }]} numberOfLines={1}>{circle.field}</Text>
                </View>
              )}
            </View>
          )}

          {/* Description */}
          {circle.description && (
            <Text style={[nc.desc, { color: c.textMuted }]}>{circle.description}</Text>
          )}

          {/* Members */}
          <View style={nc.membersSection}>
            <Text style={[nc.membersLabel, { color: c.textMuted }]}>
              {loadingMembers ? "Loading members..." :
                `${members.length}${circle.max_members ? `/${circle.max_members}` : ""} member${members.length !== 1 ? "s" : ""}`
              }
            </Text>
            {loadingMembers ? (
              <ActivityIndicator color={c.brand} size="small" />
            ) : (
              <View style={nc.avatarRow}>
                {members.slice(0, 6).map((m) => (
                  <View key={m.id} style={nc.avatarItem}>
                    <Avatar url={m.avatar_url} name={m.full_name ?? m.username} size={34} />
                  </View>
                ))}
                {members.length === 0 && (
                  <Text style={[nc.emptyMembers, { color: c.textFaint }]}>Be the first to join!</Text>
                )}
              </View>
            )}
          </View>

          {/* Action buttons */}
          <View style={nc.actions}>
            {!isCreator && (
              <TouchableOpacity
                style={[nc.joinBtn, { backgroundColor: c.brand }]}
                onPress={onJoin}
                activeOpacity={0.85}
              >
                <Text style={nc.joinText}>Join Circle</Text>
              </TouchableOpacity>
            )}
            {isCreator && (
              <View style={[nc.joinBtn, { backgroundColor: c.bgCardAlt, borderWidth: 1, borderColor: c.border }]}>
                <Text style={[nc.joinText, { color: c.textMuted }]}>You created this circle</Text>
              </View>
            )}
            <TouchableOpacity
              style={[nc.dismissBtn, { borderColor: c.border }]}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <Text style={[nc.dismissText, { color: c.textMuted }]}>Not interested</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

      </Pressable>
    </Pressable>
  );
}

// ─── My Circle Modal (Local Circles) ─────────────────────────────────────────
function MyCircleModal({ circle, members, loadingMembers, currentUserId, onCancelCircle, onClose }: {
  circle:          CirclePreview;
  members:         NewCircleMember[];
  loadingMembers:  boolean;
  currentUserId:   string | null;
  onCancelCircle:  (id: string) => void;
  onClose:         () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isCreator = circle.creator_id !== null && circle.creator_id === currentUserId;
  const photoUrl  = getSportPhoto(circle.sport, circle.name);

  // ── Edit state ────────────────────────────────────────────────────────────
  const [view,        setView]        = useState<"detail" | "edit">("detail");
  const [editName,    setEditName]    = useState(circle.name);
  const [editDesc,    setEditDesc]    = useState(circle.description ?? "");
  const [editField,   setEditField]   = useState(circle.field ?? "");
  const [editDate,    setEditDate]    = useState(circle.event_date ?? "");
  const [editTime,    setEditTime]    = useState(circle.event_time ?? "");
  const [saving,      setSaving]      = useState(false);

  async function handleSave() {
    if (!editName.trim()) return;
    setSaving(true);
    await supabase.from("communities").update({
      name:        editName.trim(),
      description: editDesc.trim() || null,
      field:       editField.trim() || null,
      event_date:  editDate || null,
      event_time:  editTime.trim() || null,
    }).eq("id", circle.id);
    setSaving(false);
    setView("detail");
    // Reflect name change locally
    circle.name        = editName.trim();
    circle.description = editDesc.trim() || null;
    circle.field       = editField.trim() || null;
    circle.event_date  = editDate || null;
    circle.event_time  = editTime.trim() || null;
  }

  function handleCancelCircle() {
    Alert.alert(
      "Cancel event?",
      "This will permanently delete the circle and remove all members.",
      [
        { text: "Keep it", style: "cancel" },
        { text: "Delete circle", style: "destructive", onPress: async () => {
          await supabase.from("communities").delete().eq("id", circle.id);
          onCancelCircle(circle.id);
          onClose();
        }},
      ]
    );
  }

  return (
    <Pressable style={nc.backdrop} onPress={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%", alignItems: "center", paddingHorizontal: SPACE[16] }}>
      <Pressable style={[nc.sheet, { width: "100%" }]} onPress={(e) => e.stopPropagation()}>

        {/* Hero image */}
        <View style={nc.heroWrap}>
          <Image source={{ uri: photoUrl }} style={nc.heroImg} contentFit="cover" cachePolicy="disk" />
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.75)"]} style={nc.heroGrad} />
          <TouchableOpacity style={nc.closeBtn} onPress={view === "edit" ? () => setView("detail") : onClose} hitSlop={12}>
            <View style={nc.closeBg}>
              <Icon name="close" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          {circle.sport && (
            <View style={nc.sportBadge}>
              <Text style={nc.sportBadgeText}>{circle.sport}</Text>
            </View>
          )}
          <View style={nc.heroBottom}>
            <Text style={nc.heroName} numberOfLines={2}>{view === "edit" ? editName || circle.name : circle.name}</Text>
            {circle.city && (
              <View style={nc.heroLocRow}>
                <Icon name="location" size={12} color="rgba(255,255,255,0.8)" />
                <Text style={nc.heroLoc}>{circle.city}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Detail view ── */}
        {view === "detail" && (
          <ScrollView
            style={{ backgroundColor: c.bgCard }}
            contentContainerStyle={nc.body}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {(circle.event_date || circle.field) && (
              <View style={nc.metaRow}>
                {circle.event_date && (
                  <View style={[nc.metaChip, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                    <Icon name="calendar" size={12} color={c.textMuted} />
                    <Text style={[nc.metaText, { color: c.textSecondary }]}>
                      {formatNewCircleDate(circle.event_date)}{circle.event_time ? `  ·  ${circle.event_time}` : ""}
                    </Text>
                  </View>
                )}
                {circle.field && (
                  <View style={[nc.metaChip, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                    <Icon name="location" size={12} color={c.textMuted} />
                    <Text style={[nc.metaText, { color: c.textSecondary }]} numberOfLines={1}>{circle.field}</Text>
                  </View>
                )}
              </View>
            )}

            {circle.description && (
              <Text style={[nc.desc, { color: c.textMuted }]}>{circle.description}</Text>
            )}

            <View style={nc.membersSection}>
              <Text style={[nc.membersLabel, { color: c.textMuted }]}>
                {loadingMembers ? "Loading members..." : `${members.length} member${members.length !== 1 ? "s" : ""}`}
              </Text>
              {loadingMembers ? (
                <ActivityIndicator color={c.brand} size="small" />
              ) : (
                <View style={nc.avatarRow}>
                  {members.slice(0, 6).map((m) => (
                    <View key={m.id} style={nc.avatarItem}>
                      <Avatar url={m.avatar_url} name={m.full_name ?? m.username} size={34} />
                    </View>
                  ))}
                  {members.length === 0 && (
                    <Text style={[nc.emptyMembers, { color: c.textFaint }]}>No members yet</Text>
                  )}
                </View>
              )}
            </View>

            <View style={nc.actions}>
              <TouchableOpacity
                style={[nc.joinBtn, { backgroundColor: c.brand }]}
                onPress={() => { onClose(); router.push("/(tabs)/circles" as any); }}
                activeOpacity={0.85}
              >
                <Text style={nc.joinText}>Open Circle</Text>
              </TouchableOpacity>

              {isCreator && (
                <View style={mc.creatorRow}>
                  <TouchableOpacity
                    style={[mc.creatorBtn, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}
                    onPress={() => setView("edit")}
                    activeOpacity={0.8}
                  >
                    <Icon name="edit" size={15} color={c.brand} />
                    <Text style={[mc.creatorBtnText, { color: c.brand }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[mc.creatorBtn, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}
                    onPress={handleCancelCircle}
                    activeOpacity={0.8}
                  >
                    <Icon name="close" size={15} color="#DC2626" />
                    <Text style={[mc.creatorBtnText, { color: "#DC2626" }]}>Cancel Event</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {/* ── Edit view ── */}
        {view === "edit" && (
          <ScrollView style={[nc.body, { backgroundColor: c.bgCard }]} keyboardShouldPersistTaps="handled">
            <Text style={[mc.editLabel, { color: c.textMuted }]}>Circle Name</Text>
            <TextInput
              style={[mc.editInput, { backgroundColor: c.bgCardAlt, borderColor: c.border, color: c.text }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Circle name"
              placeholderTextColor={c.textFaint}
            />

            <Text style={[mc.editLabel, { color: c.textMuted }]}>Description</Text>
            <TextInput
              style={[mc.editInput, mc.editTextArea, { backgroundColor: c.bgCardAlt, borderColor: c.border, color: c.text }]}
              value={editDesc}
              onChangeText={setEditDesc}
              placeholder="What's this circle about?"
              placeholderTextColor={c.textFaint}
              multiline
              numberOfLines={3}
            />

            <Text style={[mc.editLabel, { color: c.textMuted }]}>Location / Venue</Text>
            <TextInput
              style={[mc.editInput, { backgroundColor: c.bgCardAlt, borderColor: c.border, color: c.text }]}
              value={editField}
              onChangeText={setEditField}
              placeholder="e.g. Central Park Court 3"
              placeholderTextColor={c.textFaint}
            />

            <Text style={[mc.editLabel, { color: c.textMuted }]}>Event Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[mc.editInput, { backgroundColor: c.bgCardAlt, borderColor: c.border, color: c.text }]}
              value={editDate}
              onChangeText={setEditDate}
              placeholder="2025-06-15"
              placeholderTextColor={c.textFaint}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={[mc.editLabel, { color: c.textMuted }]}>Event Time (HH:MM)</Text>
            <TextInput
              style={[mc.editInput, { backgroundColor: c.bgCardAlt, borderColor: c.border, color: c.text }]}
              value={editTime}
              onChangeText={setEditTime}
              placeholder="09:00"
              placeholderTextColor={c.textFaint}
              keyboardType="numbers-and-punctuation"
            />

            <View style={[nc.actions, { marginTop: 4 }]}>
              <TouchableOpacity
                style={[nc.joinBtn, { backgroundColor: saving ? c.bgCardAlt : c.brand }]}
                onPress={handleSave}
                disabled={saving || !editName.trim()}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={nc.joinText}>Save Changes</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[nc.dismissBtn, { borderColor: c.border }]}
                onPress={() => setView("detail")}
                activeOpacity={0.7}
              >
                <Text style={[nc.dismissText, { color: c.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

      </Pressable>
      </KeyboardAvoidingView>
    </Pressable>
  );
}

const mc = StyleSheet.create({
  creatorRow:     { flexDirection: "row", gap: SPACE[10] },
  creatorBtn:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE[6], paddingVertical: SPACE[12], borderRadius: RADIUS.lg, borderWidth: 1 },
  creatorBtnText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  editLabel:      { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: SPACE[6], marginTop: SPACE[12] },
  editInput:      { borderRadius: RADIUS.md, borderWidth: 1, paddingHorizontal: SPACE[12], paddingVertical: SPACE[10], fontSize: FONT.size.sm },
  editTextArea:   { minHeight: 80, textAlignVertical: "top" },
});

// ─── New Circle popup styles ──────────────────────────────────────────────────
const NC_BODY_MAX_H = SCREEN_H * 0.72 - NC_HERO_H; // scrollable body height

const nc = StyleSheet.create({
  backdrop:       { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", paddingHorizontal: SPACE[16], zIndex: 100 },
  sheet:          { width: "100%", borderRadius: 28, overflow: "hidden" },
  // Hero image
  heroWrap:       { height: 200, position: "relative" },
  heroImg:        { width: "100%", height: "100%" },
  heroGrad:       { position: "absolute", bottom: 0, left: 0, right: 0, height: 120 },
  closeBtn:       { position: "absolute", top: SPACE[14], right: SPACE[14] },
  closeBg:        { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  sportBadge:     { position: "absolute", top: SPACE[14], left: SPACE[14], backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: SPACE[10], paddingVertical: 5, borderRadius: RADIUS.pill },
  sportBadgeText: { color: "#fff", fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 0.8 },
  heroBottom:     { position: "absolute", bottom: SPACE[16], left: SPACE[16], right: SPACE[16], gap: 4 },
  heroName:       { color: "#fff", fontSize: 22, fontWeight: FONT.weight.black, textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  heroLocRow:     { flexDirection: "row", alignItems: "center", gap: 4 },
  heroLoc:        { color: "rgba(255,255,255,0.85)", fontSize: FONT.size.sm },
  // Body
  body:           { paddingHorizontal: SPACE[20], paddingTop: SPACE[16], paddingBottom: SPACE[24], gap: SPACE[14] },
  metaRow:        { gap: SPACE[8] },
  metaChip:       { flexDirection: "row", alignItems: "center", gap: SPACE[6], paddingHorizontal: SPACE[12], paddingVertical: SPACE[8], borderRadius: RADIUS.md, borderWidth: 1 },
  metaText:       { fontSize: FONT.size.sm, flex: 1 },
  desc:           { fontSize: FONT.size.sm, lineHeight: FONT.size.sm * 1.55 },
  // Members
  membersSection: { gap: SPACE[8] },
  membersLabel:   { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 1 },
  avatarRow:      { flexDirection: "row", alignItems: "center" },
  avatarItem:     { borderWidth: 2, borderColor: "#fff", borderRadius: 19, marginRight: -8 },
  emptyMembers:   { fontSize: FONT.size.sm, marginLeft: SPACE[4] },
  // Actions
  actions:        { gap: SPACE[10] },
  joinBtn:        { borderRadius: RADIUS.lg, paddingVertical: SPACE[14], alignItems: "center" },
  joinText:       { color: "#fff", fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },
  dismissBtn:     { borderRadius: RADIUS.lg, paddingVertical: SPACE[10], alignItems: "center", borderWidth: 1 },
  dismissText:    { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
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
  const { theme, isDark: _isDark } = useTheme();
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
    if (!session) return;
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
    if (!session || !newDate) return;
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
              <Icon name={sportIcon(session.sport)} size={22} color={statusColor} />
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
                  <Icon name="calendar" size={16} color={c.textMuted} />
                  <Text style={[sd.detailText, { color: c.text }]}>
                    {formatDetailDate(session.session_date, session.session_time)}
                  </Text>
                </View>
                {session.location && (
                  <View style={sd.detailRow}>
                    <Icon name="location" size={16} color={c.textMuted} />
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
  scroll:{ paddingHorizontal: SPACE[20], paddingTop: SPACE[14], paddingBottom: SPACE[60], gap: SPACE[24] },
});

const cs = StyleSheet.create({
  banner:      { flexDirection: "row", alignItems: "center", gap: SPACE[14], borderRadius: RADIUS.xl, padding: SPACE[14], borderWidth: 1 },
  iconWrap:    { width: 48, height: 48, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center" },
  bannerTitle: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  bannerSub:   { fontSize: FONT.size.sm, marginTop: 2 },
  pill:        { paddingHorizontal: SPACE[14], paddingVertical: SPACE[8], borderRadius: RADIUS.pill },
  pillText:    { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
});
