/**
 * Discover Screen
 *
 * Swipe view: Tinder-style card deck (default)
 * List  view: ranked PersonCards with filters
 * Map   view: sports venues + nearby users
 *
 * Features:
 *  - useFocusEffect re-loads on every tab focus
 *  - Haptic feedback on like / pass / send request
 *  - Undo toast (3-second window) after every action
 *  - At-Gym strip deduped from main list
 *  - "NEW" badge on users joined within 7 days
 *  - Expandable sport chips
 *  - Inline search bar
 *  - Matched users → Chat deep link
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, router } from "expo-router";
import { ErrorState } from "../../components/ui/ErrorState";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, ScrollView, Modal, Alert,
  TouchableWithoutFeedback, TextInput, InteractionManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { supabase } from "../../lib/supabase";
import { notifyUser } from "../../lib/push";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../../lib/theme";
import { useAppData } from "../../lib/appDataContext";
import { Icon } from "../../components/Icon";
import { EmptyState } from "../../components/ui/EmptyState";
import { DiscoverSkeleton } from "../../components/ui/Skeleton";
import { BlurOverlay } from "../../components/ui/BlurOverlay";
import { PersonCard, DiscoverUser, RequestStatus } from "../../components/discover/PersonCard";
import { ProfileSheet } from "../../components/discover/ProfileSheet";
import { DiscoverMap } from "../../components/discover/DiscoverMap";
import { SwipeDeck, SwipeDeckRef } from "../../components/discover/SwipeDeck";
import { GridCard } from "../../components/discover/GridCard";

// ─── Types ────────────────────────────────────────────────────────────────────
type MyProfile = {
  id:              string;
  sports:          string[] | null;
  fitness_level:   string | null;
  availability:    Record<string, boolean> | null;
  city:            string | null;
  training_intent: string | null;
  show_me:         string | null;  // "everyone" | "men" | "women"
  lat:             number | null;
  lng:             number | null;
  gender:          string | null;
};

type Filters = {
  sports:    string[];       // multi-select
  levels:    string[];       // multi-select
  schedules: string[];       // multi-select
  atGym:     boolean;
  intents:   string[];       // multi-select
  showMe:    string | null;  // "everyone" | "men" | "women" — single (preference)
  maxKm:     number | null;
};

// Swipe undo — no time limit, tracks last swipe only
type SwipeAction = { userId: string; dbId: string; action: "like" | "pass" } | null;

// Connect undo — time-limited toast for list-view Send Request
type UndoState = { userId: string; dbId: string; name: string } | null;

const EMPTY_FILTERS: Filters = { sports: [], levels: [], schedules: [], atGym: false, intents: [], showMe: null, maxKm: null };

const INTENT_OPTIONS = [
  { value: "guidance", label: "I want guidance",       emoji: "📚" },
  { value: "teaching", label: "I enjoy helping others", emoji: "🎓" },
  { value: "equal",    label: "Equal training partner", emoji: "🤝" },
];

const SHOW_ME_OPTIONS = [
  { value: "everyone", label: "Everyone" },
  { value: "men",      label: "Men" },
  { value: "women",    label: "Women" },
];

const DISTANCE_OPTIONS = [5, 10, 25, 50];

// Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Intent compatibility bonus (0–15 pts)
function intentBonus(myIntent: string | null, theirIntent: string | null): number {
  if (!myIntent || !theirIntent) return 5; // neutral
  if (myIntent === "guidance"  && theirIntent === "teaching")  return 15;
  if (myIntent === "teaching"  && theirIntent === "guidance")  return 15;
  if (myIntent === "equal"     && theirIntent === "equal")     return 12;
  if (myIntent === "equal"     || theirIntent === "equal")     return 8;
  return 2; // same intent but not complementary (both want guidance)
}
const NEW_THRESHOLD = 7 * 24 * 60 * 60 * 1000;
const PAGE_SIZE     = 20;
const SELECT_FIELDS = "id, username, full_name, bio, city, fitness_level, age, gender, sports, current_streak, last_active, avatar_url, is_at_gym, availability, training_intent, lat, lng, created_at, sessions_completed, reliability_score";

function mapUser(u: any): DiscoverUser {
  return {
    id:                 u.id,
    username:           u.username,
    full_name:          u.full_name ?? null,
    avatar_url:         u.avatar_url ?? null,
    bio:                u.bio ?? null,
    city:               u.city ?? null,
    fitness_level:      u.fitness_level ?? null,
    gender:             u.gender ?? null,
    training_intent:    u.training_intent ?? null,
    lat:                u.lat ?? null,
    lng:                u.lng ?? null,
    age:                u.age ?? null,
    sports:             u.sports ?? null,
    current_streak:     u.current_streak ?? 0,
    last_active:        u.last_active ?? null,
    is_at_gym:          u.is_at_gym ?? false,
    availability:       u.availability ?? null,
    sessions_completed: u.sessions_completed ?? 0,
    reliability_score:  u.reliability_score ?? 100,
    matchScore:         0,
    reasons:            [],
    isNew:              !!(u.created_at && Date.now() - new Date(u.created_at).getTime() < NEW_THRESHOLD),
  };
}

const LEVEL_ORDER: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };
const SCHEDULE_LABELS: Record<string, string> = {
  morning: "Mornings", afternoon: "Afternoons", evening: "Evenings", weekend: "Weekends",
};

// ─── Scoring ──────────────────────────────────────────────────────────────────
function calcMatchScore(me: MyProfile, other: DiscoverUser): number {
  let score = 0;
  const mySports    = me.sports ?? [];
  const theirSports = other.sports ?? [];

  if (mySports.length > 0 && theirSports.length > 0) {
    const overlap = mySports.filter((s) => theirSports.includes(s)).length;
    score += Math.round((overlap / Math.min(mySports.length, theirSports.length)) * 30);
  }

  if (me.fitness_level && other.fitness_level) {
    const diff = Math.abs(
      (LEVEL_ORDER[me.fitness_level] ?? 1) - (LEVEL_ORDER[other.fitness_level] ?? 1)
    );
    if (diff === 0) score += 20;
    else if (diff === 1) score += 10;
  }

  const mySlots    = Object.entries(me.availability ?? {}).filter(([, v]) => v).map(([k]) => k);
  const theirSlots = Object.entries((other.availability ?? {}) as Record<string, boolean>).filter(([, v]) => v).map(([k]) => k);
  if (mySlots.length > 0 && theirSlots.length > 0) {
    const overlap = mySlots.filter((s) => theirSlots.includes(s)).length;
    score += Math.round((overlap / Math.max(mySlots.length, theirSlots.length)) * 15);
  }

  if (other.last_active) {
    const hrs = (Date.now() - new Date(other.last_active).getTime()) / 3600000;
    if (hrs <= 24)       score += 20;
    else if (hrs <= 72)  score += 12;
    else if (hrs <= 168) score += 5;
  }

  if (other.is_at_gym) score += 10;

  // Intent compatibility (replaces 10pts last_active slot at max)
  score += intentBonus(me.training_intent, other.training_intent);

  // Proximity bonus (if both have coordinates)
  if (me.lat && me.lng && other.lat && other.lng) {
    const km = haversineKm(me.lat, me.lng, other.lat, other.lng);
    if (km <= 5)  score += 10;
    else if (km <= 15) score += 6;
    else if (km <= 30) score += 3;
  }

  return Math.min(score, 100);
}

function buildReasons(me: MyProfile, other: DiscoverUser): string[] {
  const reasons: string[] = [];
  const shared = (me.sports ?? []).filter((s) => (other.sports ?? []).includes(s));
  if (shared.length === 1)    reasons.push(shared[0]);
  else if (shared.length > 1) reasons.push(`${shared.length} shared sports`);

  if (me.fitness_level && other.fitness_level === me.fitness_level) reasons.push("Same level");

  const mySlots    = Object.entries(me.availability ?? {}).filter(([, v]) => v).map(([k]) => k);
  const theirSlots = Object.entries((other.availability ?? {}) as Record<string, boolean>).filter(([, v]) => v).map(([k]) => k);
  const sharedSlots = mySlots.filter((s) => theirSlots.includes(s));
  const SLOT: Record<string, string> = {
    morning: "Trains mornings", afternoon: "Trains afternoons",
    evening: "Trains evenings", weekend:   "Trains weekends",
  };
  if (sharedSlots.length > 0) reasons.push(SLOT[sharedSlots[0]] ?? sharedSlots[0]);

  if (me.city && other.city?.toLowerCase() === me.city.toLowerCase()) reasons.push("Same city");

  // Proximity
  if (me.lat && me.lng && other.lat && other.lng) {
    const km = Math.round(haversineKm(me.lat, me.lng, other.lat, other.lng));
    if (km <= 30) reasons.push(`${km} km away`);
  }

  // Trust signal
  if (other.sessions_completed >= 3 && other.reliability_score >= 80)
    reasons.push("Verified partner");

  // Intent compatibility
  if (me.training_intent && other.training_intent) {
    if (me.training_intent === "guidance" && other.training_intent === "teaching")
      reasons.push("Great match — mentor/learner");
    else if (me.training_intent === "teaching" && other.training_intent === "guidance")
      reasons.push("Great match — mentor/learner");
    else if (me.training_intent === "equal" && other.training_intent === "equal")
      reasons.push("Both want equal partner");
  }

  return reasons.slice(0, 3);
}

function activeFilterCount(f: Filters): number {
  return f.sports.length + f.levels.length + f.schedules.length +
    (f.atGym ? 1 : 0) + f.intents.length + (f.showMe ? 1 : 0) + (f.maxKm ? 1 : 0);
}

function applyFilters(
  users: DiscoverUser[],
  f: Filters,
  myProfile: MyProfile | null,
  query: string,
): DiscoverUser[] {
  return users.filter((u) => {
    if (f.atGym && !u.is_at_gym) return false;
    if (f.sports.length > 0 && !f.sports.some((s) => (u.sports ?? []).includes(s))) return false;
    if (f.levels.length > 0 && !f.levels.includes(u.fitness_level ?? "")) return false;
    if (f.schedules.length > 0) {
      const slots = Object.entries((u.availability ?? {}) as Record<string, boolean>)
        .filter(([, v]) => v).map(([k]) => k);
      if (!f.schedules.some((s) => slots.includes(s))) return false;
    }
    if (f.intents.length > 0 && !f.intents.includes(u.training_intent ?? "")) return false;
    if (f.showMe && f.showMe !== "everyone" && u.gender) {
      const genderMatch = f.showMe === "men" ? u.gender === "male" : u.gender === "female";
      if (!genderMatch) return false;
    }
    if (f.maxKm && myProfile?.lat && myProfile?.lng && u.lat && u.lng) {
      if (haversineKm(myProfile.lat, myProfile.lng, u.lat, u.lng) > f.maxKm) return false;
    }
    if (query.trim()) {
      if (!(u.full_name ?? u.username ?? "").toLowerCase().includes(query.toLowerCase())) return false;
    }
    return true;
  });
}

// ─── FilterPill ───────────────────────────────────────────────────────────────
function FilterPill({ label, active, dot, onPress, c }: {
  label: string; active: boolean; dot?: string;
  onPress: () => void;
  c: ReturnType<typeof useTheme>["theme"]["colors"];
}) {
  return (
    <TouchableOpacity
      style={[fp.pill, { backgroundColor: active ? c.brand : c.bgCard, borderColor: active ? c.brand : c.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {dot && <View style={[fp.dot, { backgroundColor: dot }]} />}
      <Text style={[fp.label, { color: active ? "#fff" : c.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}
const fp = StyleSheet.create({
  pill:  { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: SPACE[12], paddingVertical: SPACE[8], borderRadius: RADIUS.pill, borderWidth: 1 },
  dot:   { width: 7, height: 7, borderRadius: 4 },
  label: { fontSize: 13, fontWeight: FONT.weight.semibold },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { appUser, appUserLoading } = useAppData();

  const [myProfile,    setMyProfile]    = useState<MyProfile | null>(null);
  const [users,        setUsers]        = useState<DiscoverUser[]>([]);   // new people (swipe deck)
  const [pendingUsers, setPendingUsers] = useState<DiscoverUser[]>([]);   // sent requests (list only)
  const [statuses,     setStatuses]     = useState<Record<string, RequestStatus>>({});
  const [matchIds,     setMatchIds]     = useState<Record<string, string>>({});
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(false);

  useEffect(() => {
    if (!loading || appUserLoading) return; // wait for AppDataContext before starting timeout
    const t = setTimeout(() => { setLoading(false); setError(true); }, 30_000);
    return () => clearTimeout(t);
  }, [loading, appUserLoading]);

  const [refreshing,   setRefreshing]   = useState(false);
  const [filters,      setFilters]      = useState<Filters>(EMPTY_FILTERS);
  const [viewMode,     setViewMode]     = useState<"swipe" | "list" | "map">("list");
  const [showFilter,   setShowFilter]   = useState(false);
  const [selectedUser, setSelectedUser] = useState<DiscoverUser | null>(null);
  const [showSearch,      setShowSearch]      = useState(false);
  const [searchQuery,     setSearchQuery]     = useState("");
  const [lastSwipe,       setLastSwipe]       = useState<SwipeAction>(null);  // persistent undo
  const [connectUndo,     setConnectUndo]     = useState<UndoState>(null);    // toast undo

  const [rawOffset,    setRawOffset]    = useState(0);
  const [hasMore,      setHasMore]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);

  const swipeDeckRef     = useRef<SwipeDeckRef>(null);
  const connectTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUserIdRef = useRef<string>("");
  const excludedRef      = useRef<Set<string>>(new Set());
  const myProfileRef     = useRef<MyProfile | null>(null);
  const lastLoadRef      = useRef(0);
  const loadingRef       = useRef(false);
  const mountedRef       = useRef(true);
  const STALE_MS = 5 * 60_000; // 5 min cache per tab

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // ── Data loading ────────────────────────────────────────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
    if (mountedRef.current) setError(false);
    if (!isRefresh && mountedRef.current) setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    currentUserIdRef.current = user.id;

    InteractionManager.runAfterInteractions(() => {
      supabase.from("users").update({ last_active: new Date().toISOString() }).eq("id", user.id).then(() => {});
    });

    // Use AppDataContext for own profile — no users table query needed
    const meData = appUser;
    if (!meData) return;

    const [
      { data: matchData },
      { data: passData },
      { data: blockData },
    ] = await Promise.all([
      supabase.from("matches")
        .select("id, receiver_id, sender_id, status")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .in("status", ["pending", "accepted"]),
      // passes table may not exist yet — fail gracefully
      supabase.from("passes").select("passed_id").eq("user_id", user.id).then((r) => ({ data: r.data ?? [], error: null })),
      // blocks table may not exist yet — fail gracefully
      supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id).then((r) => ({ data: r.data ?? [], error: null })),
    ]);

    const me: MyProfile = {
      id:              user.id,
      sports:          meData.sports ?? null,
      fitness_level:   meData.fitness_level ?? null,
      availability:    meData.availability ?? null,
      city:            meData.city ?? null,
      training_intent: meData.training_intent ?? null,
      show_me:         meData.show_me ?? null,
      lat:             meData.lat ?? null,
      lng:             meData.lng ?? null,
      gender:          meData.gender ?? null,
    };
    setMyProfile(me);

    const excluded = new Set([
      user.id,
      ...(matchData  ?? []).map((m: any) => m.sender_id === user.id ? m.receiver_id : m.sender_id),
      ...(passData   ?? []).map((p: any) => p.passed_id),
      ...(blockData  ?? []).map((b: any) => b.blocked_id),
    ]);

    const initialStatuses: Record<string, RequestStatus> = {};
    const initialMatchIds: Record<string, string> = {};
    for (const m of matchData ?? []) {
      const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      if (m.status === "accepted") {
        initialStatuses[otherId] = "accepted";
        initialMatchIds[otherId] = m.id;
      } else if (m.sender_id === user.id) {
        initialStatuses[otherId] = "pending";
      }
    }
    setMatchIds(initialMatchIds);

    // ── Persist excluded + myProfile for loadMore() ─────────────────────────
    excludedRef.current = excluded;
    myProfileRef.current = me;

    // ── Pending sent requests — shown in list view with cancel option ───────
    const pendingSentIds = (matchData ?? [])
      .filter((m: any) => m.status === "pending" && m.sender_id === user.id)
      .map((m: any) => m.receiver_id);

    const [{ data: candidates }, { data: pendingProfiles }] = await Promise.all([
      supabase.from("users").select(SELECT_FIELDS).neq("id", user.id).is("banned_at", null)
        .order("created_at", { ascending: false })
        .range(0, PAGE_SIZE - 1),
      pendingSentIds.length > 0
        ? supabase.from("users").select(SELECT_FIELDS).in("id", pendingSentIds).is("banned_at", null)
        : Promise.resolve({ data: [] }),
    ]);

    // Pending users for list view (already liked, awaiting response)
    setPendingUsers((pendingProfiles ?? []).map(mapUser));

    const scored: DiscoverUser[] = (candidates ?? [])
      .filter((u: any) => !excluded.has(u.id))
      .map((u: any): DiscoverUser => {
        const partial = mapUser(u);
        partial.matchScore = calcMatchScore(me, partial);
        partial.reasons    = buildReasons(me, partial);
        return partial;
      })
      .sort((a, b) => {
        if (a.is_at_gym !== b.is_at_gym) return a.is_at_gym ? -1 : 1;
        return b.matchScore - a.matchScore;
      });

    setUsers(scored);
    setStatuses(initialStatuses);
    setRawOffset(PAGE_SIZE);
    setHasMore((candidates?.length ?? 0) >= PAGE_SIZE);
    if (mountedRef.current) lastLoadRef.current = Date.now();
    } catch (err) {
      console.error("[Discover] load failed:", err);
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
  }, [appUser]);

  // ── Load next page ───────────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { data: nextPage } = await supabase
        .from("users")
        .select(SELECT_FIELDS)
        .neq("id", currentUserIdRef.current)
        .is("banned_at", null)
        .order("created_at", { ascending: false })
        .range(rawOffset, rawOffset + PAGE_SIZE - 1);

      if (!nextPage || nextPage.length === 0) { setHasMore(false); return; }

      const me = myProfileRef.current;
      const newUsers: DiscoverUser[] = nextPage
        .filter((u: any) => !excludedRef.current.has(u.id))
        .map((u: any) => {
          const partial = mapUser(u);
          if (me) {
            partial.matchScore = calcMatchScore(me, partial);
            partial.reasons    = buildReasons(me, partial);
          }
          return partial;
        });

      setUsers((prev) => [...prev, ...newUsers]);
      setRawOffset((prev) => prev + PAGE_SIZE);
      setHasMore(nextPage.length >= PAGE_SIZE);
    } catch (err) {
      console.error("[Discover] loadMore failed:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, rawOffset]);

  // Trigger load once appUser becomes available
  useEffect(() => {
    if (appUser && users.length === 0) load();
  }, [appUser]);

  // Reload on focus if stale or empty; always reset filters
  useFocusEffect(useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setSearchQuery("");
    if (!appUser) return;
    const elapsed = Date.now() - lastLoadRef.current;
    if (elapsed > STALE_MS || users.length === 0) load();
  }, [load, users.length, appUser]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  // ── Swipe undo — no time limit, single last action ──────────────────────────
  async function doSwipeUndo() {
    if (!lastSwipe) return;
    const a = lastSwipe;
    setLastSwipe(null);
    Haptics.selectionAsync();
    if (a.action === "pass") {
      await supabase.from("passes").delete().eq("id", a.dbId);
    } else {
      await supabase.from("matches").delete().eq("id", a.dbId);
      setStatuses((prev) => { const n = { ...prev }; delete n[a.userId]; return n; });
      setMatchIds((prev) => { const n = { ...prev }; delete n[a.userId]; return n; });
    }
    swipeDeckRef.current?.undoLast();
  }

  // ── Like (swipe right) ──────────────────────────────────────────────────────
  async function onLike(userId: string) {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    excludedRef.current.add(userId);
    setStatuses((prev) => ({ ...prev, [userId]: "pending" }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { data } = await supabase.from("matches")
      .insert({ sender_id: uid, receiver_id: userId, status: "pending" })
      .select("id").single();
    if (data) {
      setLastSwipe({ userId, dbId: data.id, action: "like" });
      const senderName = appUser?.full_name ?? appUser?.username ?? "Someone";
      notifyUser(userId, {
        type: "match_request",
        title: "New Match Request 🤝",
        body: `${senderName} wants to connect with you!`,
        relatedId: data.id,
        data: { type: "match_request", relatedId: data.id },
      });
    }
  }

  // ── Pass (swipe left) ──────────────────────────────────────────────────────
  async function onPass(userId: string) {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    excludedRef.current.add(userId);
    Haptics.selectionAsync();
    const { data } = await supabase.from("passes")
      .insert({ user_id: uid, passed_id: userId })
      .select("id").single();
    if (data) setLastSwipe({ userId, dbId: data.id, action: "pass" });
  }

  // ── Connect (list view Send Request) — time-limited toast ───────────────────
  async function connect(userId: string) {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    setStatuses((prev) => ({ ...prev, [userId]: "pending" }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const { data } = await supabase.from("matches")
      .insert({ sender_id: uid, receiver_id: userId, status: "pending" })
      .select("id").single();
    if (data) {
      const u = users.find((u) => u.id === userId);
      if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
      setConnectUndo({ userId, dbId: data.id, name: u?.full_name ?? u?.username ?? "" });
      connectTimerRef.current = setTimeout(() => setConnectUndo(null), 4000);
      // Notify the receiver
      const { data: me } = await supabase.from("users").select("full_name, username").eq("id", uid).single();
      notifyUser(userId, {
        type: "match_request",
        title: "New Match Request 🤝",
        body: `${me?.full_name ?? me?.username ?? "Someone"} wants to train with you!`,
        relatedId: data.id,
        data: { type: "match_request", relatedId: data.id },
      });
    }
  }

  // ── Connect undo (list view, time-limited toast) ────────────────────────────
  async function doConnectUndo() {
    if (!connectUndo) return;
    if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
    const a = connectUndo;
    setConnectUndo(null);
    await supabase.from("matches").delete().eq("id", a.dbId);
    setStatuses((prev) => { const n = { ...prev }; delete n[a.userId]; return n; });
  }

  // ── Cancel / withdraw pending request (tap Pending button) ───────────────────
  async function cancelRequest(userId: string) {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    // Optimistic update — remove from pending list and statuses
    setStatuses((prev) => { const n = { ...prev }; delete n[userId]; return n; });
    setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
    Haptics.selectionAsync();
    await supabase.from("matches")
      .delete()
      .eq("sender_id", uid)
      .eq("receiver_id", userId)
      .eq("status", "pending");
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const atGymUsers   = users.filter((u) => u.is_at_gym);
  const atGymUserIds = new Set(atGymUsers.map((u) => u.id));
  const sportOptions = myProfile?.sports?.length ? myProfile.sports : ["Gym", "Running", "Cycling"];
  const filterCount  = activeFilterCount(filters);

  const displayed = applyFilters(users, filters, myProfile, searchQuery);

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <DiscoverSkeleton />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <ErrorState onRetry={load} message="Could not load profiles." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>

      {/* ── Sticky header ────────────────────────────────────────────────── */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <View>
          <Text style={[s.title, { color: c.text }]}>Discover</Text>
          {viewMode === "list" && displayed.length > 0 && (
            <Text style={[s.subtitle, { color: c.textMuted }]}>
              {displayed.length} partner{displayed.length !== 1 ? "s" : ""}
              {filterCount > 0 ? ` · ${filterCount} filter${filterCount > 1 ? "s" : ""}` : ""}
            </Text>
          )}
        </View>
        <View style={s.headerActions}>
          {/* Search */}
          <TouchableOpacity
            style={[s.headerBtn, { backgroundColor: showSearch ? c.brand : c.bgCard, borderColor: showSearch ? c.brand : c.border }]}
            onPress={() => { setShowSearch((v) => !v); if (showSearch) setSearchQuery(""); }}
          >
            <Icon name="search" size={18} color={showSearch ? "#fff" : c.textSecondary} />
          </TouchableOpacity>

          {/* Filter */}
          <TouchableOpacity
            style={[s.headerBtn, { backgroundColor: c.bgCard, borderColor: filterCount > 0 ? c.brand : c.border }]}
            onPress={() => setShowFilter(true)}
          >
            <Icon name="filter" size={18} color={filterCount > 0 ? c.brand : c.textSecondary} />
            {filterCount > 0 && (
              <View style={[s.filterBadge, { backgroundColor: c.brand }]}>
                <Text style={s.filterBadgeText}>{filterCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Mode toggle: swipe / list / map */}
          <View style={[s.modeSeg, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
            {(["swipe", "list", "map"] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[s.modeBtn, viewMode === mode && { backgroundColor: c.brand }]}
                onPress={() => setViewMode(mode)}
              >
                <Icon
                  name={mode === "swipe" ? "discoverActive" : mode === "list" ? "list" : "map"}
                  size={15}
                  color={viewMode === mode ? "#fff" : c.textSecondary}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* ── Search bar ───────────────────────────────────────────────────── */}
      {showSearch && (
        <View style={[s.searchBar, { backgroundColor: c.bgCard, borderBottomColor: c.border }]}>
          <Icon name="search" size={16} color={c.textMuted} />
          <TextInput
            style={[s.searchInput, { color: c.text }]}
            placeholder="Search by name…"
            placeholderTextColor={c.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityLabel="Search users by name"
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Icon name="close" size={16} color={c.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Profile completion nudge ─────────────────────────────────────── */}
      {myProfile && (!myProfile.sports || myProfile.sports.length === 0) && (
        <TouchableOpacity
          style={[s.nudgeBanner, { backgroundColor: c.brand + "18", borderColor: c.brand + "40" }]}
          onPress={() => router.push("/(tabs)/profile")}
          activeOpacity={0.8}
        >
          <Text style={[s.nudgeText, { color: c.brand }]}>
            Add your sports to see real match scores
          </Text>
          <Text style={[s.nudgeAction, { color: c.brand }]}>Complete profile →</Text>
        </TouchableOpacity>
      )}

      {/* ── Swipe view — always mounted to preserve currentIndex state ─── */}
      <View style={{ flex: 1, display: viewMode === "swipe" ? "flex" : "none" }}>
        <SwipeDeck
          ref={swipeDeckRef}
          users={users}
          statuses={statuses}
          onLike={onLike}
          onPass={onPass}
          onCardPress={(u) => setSelectedUser(u)}
          canUndo={!!lastSwipe}
          onUndo={doSwipeUndo}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onDeckLow={() => { if (hasMore && !loadingMore) loadMore(); }}
          onInvite={() => router.push("/referral" as any)}
          onJoinCircle={() => router.push("/(tabs)/circles" as any)}
          onCompleteProfile={() => router.push("/(tabs)/profile" as any)}
        />
      </View>

      {/* ── Map view ─────────────────────────────────────────────────────── */}
      {viewMode === "map" && (
        <DiscoverMap
          users={users}
          statuses={statuses}
          onUserPress={(u) => setSelectedUser(u)}
        />
      )}

      {/* ── List view (2-column grid) ─────────────────────────────────────── */}
      {viewMode === "list" && (
        <FlatList
          data={[...pendingUsers, ...displayed]}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={s.grid}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} />}
          ListHeaderComponent={
            <View style={{ gap: SPACE[10], marginBottom: SPACE[4] }}>
              {/* Quick filter pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACE[8], paddingRight: 4 }}>
                <FilterPill
                  label="At gym now"
                  active={filters.atGym}
                  dot="#4ADE80"
                  onPress={() => setFilters((f) => ({ ...f, atGym: !f.atGym }))}
                  c={c}
                />
                <FilterPill
                  label="Nearby"
                  active={filters.maxKm === 25}
                  onPress={() => setFilters((f) => ({ ...f, maxKm: f.maxKm === 25 ? null : 25 }))}
                  c={c}
                />
                {(["beginner", "intermediate", "advanced"] as const).map((lv) => (
                  <FilterPill
                    key={lv}
                    label={lv.charAt(0).toUpperCase() + lv.slice(1)}
                    active={filters.levels.includes(lv)}
                    onPress={() => setFilters((f) => ({
                      ...f,
                      levels: f.levels.includes(lv) ? f.levels.filter((l) => l !== lv) : [...f.levels, lv],
                    }))}
                    c={c}
                  />
                ))}
                {myProfile?.sports?.slice(0, 4).map((sp) => (
                  <FilterPill
                    key={sp}
                    label={sp}
                    active={filters.sports.includes(sp)}
                    onPress={() => setFilters((f) => ({
                      ...f,
                      sports: f.sports.includes(sp) ? f.sports.filter((s) => s !== sp) : [...f.sports, sp],
                    }))}
                    c={c}
                  />
                ))}
              </ScrollView>
              {/* Always-visible partner count */}
              <View style={s.countRow}>
                <Text style={[s.peopleCount, { color: c.text }]}>
                  <Text style={{ fontWeight: FONT.weight.black }}>{[...pendingUsers, ...displayed].length}</Text>
                  {" partner"}{[...pendingUsers, ...displayed].length !== 1 ? "s" : ""} {filterCount > 0 ? "matching filters" : "near you"}
                </Text>
                {filterCount > 0 && (
                  <TouchableOpacity onPress={() => setFilters(EMPTY_FILTERS)}>
                    <Text style={[s.clearFilters, { color: c.brand }]}>Clear all</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <GridCard
              user={item}
              status={statuses[item.id] ?? "none"}
              onPress={() => setSelectedUser(item)}
              onConnect={() => connect(item.id)}
              matchId={matchIds[item.id]}
            />
          )}
          onEndReached={() => { if (hasMore && !loadingMore) loadMore(); }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator color={c.brand} style={{ paddingVertical: SPACE[20] }} />
              : null
          }
          ListEmptyComponent={
            filterCount > 0 ? (
              <EmptyState
                icon="search"
                title="No matches found"
                subtitle="Try adjusting your filters."
              />
            ) : (
              <DiscoverEmptyState
                onInvite={() => router.push("/referral" as any)}
                onJoinCircle={() => router.push("/(tabs)/circles" as any)}
                onCompleteProfile={() => router.push("/(tabs)/profile" as any)}
              />
            )
          }
        />
      )}

      {/* ── Profile sheet ────────────────────────────────────────────────── */}
      <ProfileSheet
        user={selectedUser}
        status={selectedUser ? (statuses[selectedUser.id] ?? "none") : "none"}
        onConnect={() => { if (selectedUser) connect(selectedUser.id); }}
        onClose={() => setSelectedUser(null)}
        onBlock={(userId) => {
          setUsers((prev) => prev.filter((u) => u.id !== userId));
          setSelectedUser(null);
        }}
      />

      {/* ── Filter modal ─────────────────────────────────────────────────── */}
      <FilterModal
        visible={showFilter}
        filters={filters}
        sportOptions={sportOptions}
        atGymCount={atGymUsers.length}
        allUsers={[...pendingUsers, ...users]}
        myProfile={myProfile}
        onApply={(f) => { setFilters(f); setShowFilter(false); }}
        onClose={() => setShowFilter(false)}
      />

      {/* ── Connect undo toast (list view only) ─────────────────────────── */}
      {connectUndo && (
        <View style={[s.undoToast, { backgroundColor: c.bgCard, borderColor: c.border, shadowColor: c.text }]}>
          <Text style={[s.undoLabel, { color: c.text }]} numberOfLines={1}>
            Request sent to {connectUndo.name}
          </Text>
          <TouchableOpacity
            style={[s.undoBtn, { backgroundColor: c.brand }]}
            onPress={doConnectUndo}
            activeOpacity={0.8}
          >
            <Text style={s.undoBtnText}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Discover Empty State ─────────────────────────────────────────────────────
function DiscoverEmptyState({ onInvite, onJoinCircle, onCompleteProfile }: {
  onInvite: () => void;
  onJoinCircle: () => void;
  onCompleteProfile: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={{ alignItems: "center", paddingVertical: SPACE[48], paddingHorizontal: SPACE[24], gap: SPACE[12] }}>
      <Text style={{ fontSize: 52 }}>🔍</Text>
      <Text style={{ fontSize: FONT.size.xl, fontWeight: FONT.weight.black, color: c.text, textAlign: "center" }}>
        No partners nearby yet
      </Text>
      <Text style={{ fontSize: FONT.size.base, color: c.textMuted, textAlign: "center" }}>
        Grow the community or complete your profile to improve matches.
      </Text>
      <TouchableOpacity style={{ backgroundColor: c.brand, paddingVertical: SPACE[14], paddingHorizontal: SPACE[32], borderRadius: RADIUS.xl, marginTop: SPACE[8], width: "100%", alignItems: "center" }} onPress={onInvite} activeOpacity={0.85}>
        <Text style={{ color: "#fff", fontSize: FONT.size.base, fontWeight: FONT.weight.bold }}>👥 Invite Friends</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{ backgroundColor: c.bgCard, paddingVertical: SPACE[14], paddingHorizontal: SPACE[32], borderRadius: RADIUS.xl, width: "100%", alignItems: "center" }} onPress={onJoinCircle} activeOpacity={0.85}>
        <Text style={{ color: c.text, fontSize: FONT.size.base, fontWeight: FONT.weight.bold }}>⭕ Join a Circle</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{ backgroundColor: c.bgCard, paddingVertical: SPACE[14], paddingHorizontal: SPACE[32], borderRadius: RADIUS.xl, width: "100%", alignItems: "center" }} onPress={onCompleteProfile} activeOpacity={0.85}>
        <Text style={{ color: c.text, fontSize: FONT.size.base, fontWeight: FONT.weight.bold }}>✏️ Complete Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Filter Modal ─────────────────────────────────────────────────────────────
function FilterModal({
  visible, filters, sportOptions, atGymCount, allUsers, myProfile, onApply, onClose,
}: {
  visible:      boolean;
  filters:      Filters;
  sportOptions: string[];
  atGymCount:   number;
  allUsers:     DiscoverUser[];
  myProfile:    MyProfile | null;
  onApply:      (f: Filters) => void;
  onClose:      () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [draft, setDraft] = useState<Filters>(filters);
  useEffect(() => { if (visible) setDraft(filters); }, [visible]);

  const activeCount  = activeFilterCount(draft);
  const previewCount = applyFilters(allUsers, draft, myProfile, "").length;

  function toggleArr<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <BlurOverlay onPress={onClose}>
      <View style={fm.sheet} pointerEvents="box-none">
        <View style={[fm.card, { backgroundColor: c.bgCard }]}>

          {/* Handle bar */}
          <View style={[fm.handle, { backgroundColor: c.border }]} />

          <View style={fm.headerRow}>
            <Text style={[fm.title, { color: c.text }]}>Filters</Text>
            <View style={fm.headerRight}>
              {activeCount > 0 && (
                <TouchableOpacity onPress={() => setDraft(EMPTY_FILTERS)}>
                  <Text style={[fm.reset, { color: c.brand }]}>Clear all</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[fm.closeBtn, { backgroundColor: c.bgCardAlt }]}
                onPress={onClose}
                hitSlop={8}
              >
                <Icon name="close" size={14} color={c.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={fm.content}>

            {/* At gym now */}
            <TouchableOpacity
              style={[fm.toggleRow, { backgroundColor: c.bgCardAlt, borderColor: draft.atGym ? PALETTE.success : c.border }]}
              onPress={() => setDraft((d) => ({ ...d, atGym: !d.atGym }))}
              activeOpacity={0.8}
            >
              <View style={fm.toggleLeft}>
                <View style={[fm.liveDot, { backgroundColor: PALETTE.success }]} />
                <View>
                  <Text style={[fm.toggleLabel, { color: c.text }]}>At gym now</Text>
                  <Text style={[fm.toggleSub, { color: c.textMuted }]}>{atGymCount} currently training</Text>
                </View>
              </View>
              <View style={[fm.checkbox, { borderColor: draft.atGym ? PALETTE.success : c.border, backgroundColor: draft.atGym ? PALETTE.success : "transparent" }]}>
                {draft.atGym && <Text style={fm.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>

            <View style={fm.section}>
              <Text style={[fm.sectionTitle, { color: c.textMuted }]}>FITNESS LEVEL</Text>
              <Text style={[fm.sectionHint, { color: c.textFaint }]}>Pick one or more</Text>
              <View style={fm.options}>
                {["beginner", "intermediate", "advanced"].map((lv) => (
                  <OptionChip
                    key={lv}
                    label={lv.charAt(0).toUpperCase() + lv.slice(1)}
                    active={draft.levels.includes(lv)}
                    onPress={() => setDraft((d) => ({ ...d, levels: toggleArr(d.levels, lv) }))}
                  />
                ))}
              </View>
            </View>

            <View style={fm.section}>
              <Text style={[fm.sectionTitle, { color: c.textMuted }]}>TRAINS</Text>
              <Text style={[fm.sectionHint, { color: c.textFaint }]}>Pick one or more</Text>
              <View style={fm.options}>
                {Object.entries(SCHEDULE_LABELS).map(([key, label]) => (
                  <OptionChip
                    key={key}
                    label={label}
                    active={draft.schedules.includes(key)}
                    onPress={() => setDraft((d) => ({ ...d, schedules: toggleArr(d.schedules, key) }))}
                  />
                ))}
              </View>
            </View>

            <View style={fm.section}>
              <Text style={[fm.sectionTitle, { color: c.textMuted }]}>SPORT</Text>
              <Text style={[fm.sectionHint, { color: c.textFaint }]}>Pick one or more</Text>
              <View style={fm.options}>
                {sportOptions.map((sp) => (
                  <OptionChip
                    key={sp}
                    label={sp}
                    active={draft.sports.includes(sp)}
                    onPress={() => setDraft((d) => ({ ...d, sports: toggleArr(d.sports, sp) }))}
                  />
                ))}
              </View>
            </View>

            <View style={fm.section}>
              <Text style={[fm.sectionTitle, { color: c.textMuted }]}>TRAINING INTENT</Text>
              <Text style={[fm.sectionHint, { color: c.textFaint }]}>Pick one or more</Text>
              <View style={fm.options}>
                {INTENT_OPTIONS.map(({ value, label, emoji }) => (
                  <OptionChip
                    key={value}
                    label={`${emoji} ${label}`}
                    active={draft.intents.includes(value)}
                    onPress={() => setDraft((d) => ({ ...d, intents: toggleArr(d.intents, value) }))}
                  />
                ))}
              </View>
            </View>

            <View style={fm.section}>
              <Text style={[fm.sectionTitle, { color: c.textMuted }]}>WHO I WANT TO MEET</Text>
              <View style={fm.options}>
                {SHOW_ME_OPTIONS.map(({ value, label }) => (
                  <OptionChip
                    key={value}
                    label={label}
                    active={draft.showMe === value}
                    onPress={() => setDraft((d) => ({ ...d, showMe: d.showMe === value ? null : value }))}
                  />
                ))}
              </View>
            </View>

            <View style={fm.section}>
              <Text style={[fm.sectionTitle, { color: c.textMuted }]}>MAX DISTANCE</Text>
              <View style={fm.options}>
                {DISTANCE_OPTIONS.map((km) => (
                  <OptionChip
                    key={km}
                    label={`${km} km`}
                    active={draft.maxKm === km}
                    onPress={() => setDraft((d) => ({ ...d, maxKm: d.maxKm === km ? null : km }))}
                  />
                ))}
              </View>
            </View>

          </ScrollView>

          <TouchableOpacity
            style={[fm.applyBtn, { backgroundColor: c.brand }]}
            onPress={() => onApply(draft)}
            activeOpacity={0.85}
          >
            <Text style={fm.applyText}>
              Show {previewCount} partner{previewCount !== 1 ? "s" : ""}
              {activeCount > 0 ? ` · ${activeCount} filter${activeCount > 1 ? "s" : ""} active` : ""}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      </BlurOverlay>
    </Modal>
  );
}

function OptionChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <TouchableOpacity
      style={[fm.optionChip, { backgroundColor: active ? c.brand : "transparent", borderColor: active ? c.brand : c.borderMedium }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[fm.optionText, { color: active ? "#fff" : c.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── At Gym Bubble ────────────────────────────────────────────────────────────
import { Avatar as AvatarComp } from "../../components/Avatar";

function AtGymBubble({ user, onPress }: { user: DiscoverUser; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const name = (user.full_name ?? user.username).split(" ")[0];
  return (
    <TouchableOpacity style={s.bubble} onPress={onPress} activeOpacity={0.8}>
      <View style={[s.bubbleRing, { borderColor: PALETTE.success }]}>
        <View style={s.bubbleAvatarWrap}>
          <View style={{ width: 44, height: 44, borderRadius: 22, overflow: "hidden" }}>
            <AvatarComp url={user.avatar_url} name={user.full_name ?? user.username} size={44} />
          </View>
          <View style={[s.bubbleDot, { borderColor: c.bg }]} />
        </View>
      </View>
      <Text style={[s.bubbleName, { color: c.textSecondary }]} numberOfLines={1}>{name}</Text>
    </TouchableOpacity>
  );
}

function FilterChip({
  label, active, onPress, dot,
}: { label: string; active: boolean; onPress: () => void; dot?: boolean }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <TouchableOpacity
      style={[s.chip, active ? { backgroundColor: c.brand, borderColor: c.brand } : { backgroundColor: "transparent", borderColor: c.borderMedium }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {dot && !active && <View style={s.chipDot} />}
      <Text style={[s.chipText, { color: active ? "#fff" : c.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: SPACE[16], paddingBottom: SPACE[48], gap: SPACE[16] },
  grid:        { paddingHorizontal: SPACE[16], paddingTop: SPACE[4], paddingBottom: SPACE[60], gap: 10 },
  countRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 },
  peopleCount: { fontSize: 13, fontWeight: FONT.weight.medium },
  clearFilters:{ fontSize: 13, fontWeight: FONT.weight.semibold },

  header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: SPACE[16], paddingVertical: SPACE[12], borderBottomWidth: 1 },
  title:         { fontSize: FONT.size.xxxl, fontWeight: FONT.weight.black, letterSpacing: -0.5 },
  subtitle:      { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: SPACE[8], alignItems: "center" },
  headerBtn:     { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  filterBadge:   { position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  filterBadgeText:{ color: "#fff", fontSize: 10, fontWeight: "800" },

  // Mode segment
  modeSeg:       { flexDirection: "row", borderRadius: RADIUS.md, borderWidth: 1, overflow: "hidden" },
  modeBtn:       { width: 34, height: 34, alignItems: "center", justifyContent: "center" },

  // Search bar
  searchBar:     { flexDirection: "row", alignItems: "center", gap: SPACE[8], paddingHorizontal: SPACE[16], paddingVertical: SPACE[10], borderBottomWidth: 1 },
  searchInput:   { flex: 1, fontSize: FONT.size.base, paddingVertical: 0 },

  // Profile nudge banner
  nudgeBanner:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: SPACE[16], marginTop: SPACE[8], paddingHorizontal: SPACE[12], paddingVertical: SPACE[10], borderRadius: RADIUS.md, borderWidth: 1 },
  nudgeText:     { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium, flex: 1 },
  nudgeAction:   { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold, marginLeft: SPACE[8] },

  atGymHeader: { flexDirection: "row", alignItems: "center", gap: SPACE[6] },
  liveDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: PALETTE.success },
  atGymTitle:  { fontSize: FONT.size.base, fontWeight: FONT.weight.bold, flex: 1 },
  atGymCount:  { fontSize: FONT.size.sm },

  bubble:         { alignItems: "center", gap: SPACE[4], width: 56 },
  bubbleRing:     { borderRadius: 26, borderWidth: 2, padding: 2 },
  bubbleAvatarWrap:{ position: "relative" },
  bubbleDot:      { position: "absolute", bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: PALETTE.success, borderWidth: 2 },
  bubbleName:     { fontSize: FONT.size.xs, fontWeight: FONT.weight.medium, textAlign: "center" },

  chips:    { gap: SPACE[8], paddingRight: SPACE[4] },
  chip:     { flexDirection: "row", alignItems: "center", gap: SPACE[4], paddingHorizontal: SPACE[14], paddingVertical: SPACE[8], borderRadius: RADIUS.pill, borderWidth: 1 },
  chipDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: PALETTE.success },
  chipText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },

  // Undo toast
  undoToast:   { position: "absolute", bottom: SPACE[28], left: SPACE[16], right: SPACE[16], flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: RADIUS.xl, borderWidth: 1, padding: SPACE[14], paddingLeft: SPACE[16], shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  undoLabel:   { flex: 1, fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, marginRight: SPACE[12] },
  undoBtn:     { paddingHorizontal: SPACE[14], paddingVertical: SPACE[8], borderRadius: RADIUS.lg },
  undoBtnText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.extrabold, color: "#fff" },
});

const fm = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.50)" },
  sheet:       { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
  card:        { borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, overflow: "hidden", maxHeight: "85%" },
  handle:      { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginTop: SPACE[12], marginBottom: SPACE[4] },

  headerRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACE[20], paddingVertical: SPACE[12] },
  headerRight: { flexDirection: "row", alignItems: "center", gap: SPACE[12] },
  title:       { fontSize: FONT.size.xl, fontWeight: FONT.weight.black },
  reset:       { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  closeBtn:    { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },

  content:     { paddingHorizontal: SPACE[20], paddingBottom: SPACE[20], gap: SPACE[20] },
  section:     { gap: SPACE[8] },
  sectionTitle:{ fontSize: FONT.size.xs, fontWeight: FONT.weight.extrabold, letterSpacing: 1 },
  sectionHint: { fontSize: 11, marginTop: -4 },
  options:     { flexDirection: "row", flexWrap: "wrap", gap: SPACE[8] },
  optionChip:  { paddingHorizontal: SPACE[14], paddingVertical: SPACE[8], borderRadius: RADIUS.pill, borderWidth: 1 },
  optionText:  { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },

  toggleRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: RADIUS.lg, borderWidth: 1.5, padding: SPACE[14] },
  toggleLeft:  { flexDirection: "row", alignItems: "center", gap: SPACE[10] },
  liveDot:     { width: 10, height: 10, borderRadius: 5 },
  toggleLabel: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  toggleSub:   { fontSize: FONT.size.xs, marginTop: 2 },
  checkbox:    { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  checkmark:   { color: "#fff", fontSize: 14, fontWeight: "800", lineHeight: 16 },

  applyBtn:    { margin: SPACE[20], marginTop: SPACE[8], borderRadius: RADIUS.pill, paddingVertical: SPACE[16], alignItems: "center" },
  applyText:   { color: "#fff", fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },
});
