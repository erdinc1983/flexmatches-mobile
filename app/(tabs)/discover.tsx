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
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, ScrollView, Modal,
  TouchableWithoutFeedback, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { supabase } from "../../lib/supabase";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../../lib/theme";
import { Icon } from "../../components/Icon";
import { EmptyState } from "../../components/ui/EmptyState";
import { PersonCard, DiscoverUser, RequestStatus } from "../../components/discover/PersonCard";
import { ProfileSheet } from "../../components/discover/ProfileSheet";
import { DiscoverMap } from "../../components/discover/DiscoverMap";
import { SwipeDeck, SwipeDeckRef } from "../../components/discover/SwipeDeck";

// ─── Types ────────────────────────────────────────────────────────────────────
type MyProfile = {
  id:            string;
  sports:        string[] | null;
  fitness_level: string | null;
  availability:  Record<string, boolean> | null;
  city:          string | null;
};

type Filters = {
  sport:    string | null;
  level:    string | null;
  schedule: string | null;
  atGym:    boolean;
};

// Swipe undo — no time limit, tracks last swipe only
type SwipeAction = { userId: string; dbId: string; action: "like" | "pass" } | null;

// Connect undo — time-limited toast for list-view Send Request
type UndoState = { userId: string; dbId: string; name: string } | null;

const EMPTY_FILTERS: Filters = { sport: null, level: null, schedule: null, atGym: false };
const NEW_THRESHOLD = 7 * 24 * 60 * 60 * 1000;

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

  if (me.city && other.city?.toLowerCase() === me.city.toLowerCase()) reasons.push("Nearby");
  return reasons.slice(0, 3);
}

function activeFilterCount(f: Filters): number {
  return [f.sport, f.level, f.schedule, f.atGym].filter(Boolean).length;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [myProfile,    setMyProfile]    = useState<MyProfile | null>(null);
  const [users,        setUsers]        = useState<DiscoverUser[]>([]);   // new people (swipe deck)
  const [pendingUsers, setPendingUsers] = useState<DiscoverUser[]>([]);   // sent requests (list only)
  const [statuses,     setStatuses]     = useState<Record<string, RequestStatus>>({});
  const [matchIds,     setMatchIds]     = useState<Record<string, string>>({});
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [filters,      setFilters]      = useState<Filters>(EMPTY_FILTERS);
  const [viewMode,     setViewMode]     = useState<"swipe" | "list" | "map">("swipe");
  const [showFilter,   setShowFilter]   = useState(false);
  const [selectedUser, setSelectedUser] = useState<DiscoverUser | null>(null);
  const [showSearch,      setShowSearch]      = useState(false);
  const [searchQuery,     setSearchQuery]     = useState("");
  const [lastSwipe,       setLastSwipe]       = useState<SwipeAction>(null);  // persistent undo
  const [connectUndo,     setConnectUndo]     = useState<UndoState>(null);    // toast undo

  const swipeDeckRef   = useRef<SwipeDeckRef>(null);
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUserIdRef = useRef<string>("");

  // ── Data loading ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    currentUserIdRef.current = user.id;

    supabase.from("users").update({ last_active: new Date().toISOString() }).eq("id", user.id).then(() => {});

    const [
      { data: meData },
      { data: matchData },
      { data: passData },
    ] = await Promise.all([
      supabase.from("users")
        .select("id, sports, fitness_level, availability, city")
        .eq("id", user.id).single(),
      supabase.from("matches")
        .select("id, receiver_id, sender_id, status")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .in("status", ["pending", "accepted"]),
      supabase.from("passes")
        .select("passed_id")
        .eq("user_id", user.id),
    ]);

    const me: MyProfile = {
      id:            user.id,
      sports:        meData?.sports ?? null,
      fitness_level: meData?.fitness_level ?? null,
      availability:  meData?.availability ?? null,
      city:          meData?.city ?? null,
    };
    setMyProfile(me);

    const excluded = new Set([
      user.id,
      ...(matchData ?? []).map((m: any) => m.sender_id === user.id ? m.receiver_id : m.sender_id),
      ...(passData  ?? []).map((p: any) => p.passed_id),
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

    // ── Pending sent requests — shown in list view with cancel option ───────
    const pendingSentIds = (matchData ?? [])
      .filter((m: any) => m.status === "pending" && m.sender_id === user.id)
      .map((m: any) => m.receiver_id);

    const SELECT_FIELDS = "id, username, full_name, bio, city, fitness_level, age, sports, current_streak, last_active, avatar_url, is_at_gym, availability, created_at";

    const [{ data: candidates }, { data: pendingProfiles }] = await Promise.all([
      supabase.from("users").select(SELECT_FIELDS).neq("id", user.id).limit(80),
      pendingSentIds.length > 0
        ? supabase.from("users").select(SELECT_FIELDS).in("id", pendingSentIds)
        : Promise.resolve({ data: [] }),
    ]);

    function mapUser(u: any): DiscoverUser {
      return {
        id:             u.id,
        username:       u.username,
        full_name:      u.full_name ?? null,
        avatar_url:     u.avatar_url ?? null,
        bio:            u.bio ?? null,
        city:           u.city ?? null,
        fitness_level:  u.fitness_level ?? null,
        age:            u.age ?? null,
        sports:         u.sports ?? null,
        current_streak: u.current_streak ?? 0,
        last_active:    u.last_active ?? null,
        is_at_gym:      u.is_at_gym ?? false,
        availability:   u.availability ?? null,
        matchScore:     0,
        reasons:        [],
        isNew:          !!(u.created_at && Date.now() - new Date(u.created_at).getTime() < NEW_THRESHOLD),
      };
    }

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
    setLoading(false);
  }, []);

  // Only load once on mount — useFocusEffect caused deck to restart on every tab switch.
  // Pull-to-refresh handles manual reload.
  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
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
    setStatuses((prev) => ({ ...prev, [userId]: "pending" }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { data } = await supabase.from("matches")
      .insert({ sender_id: uid, receiver_id: userId, status: "pending" })
      .select("id").single();
    if (data) setLastSwipe({ userId, dbId: data.id, action: "like" });
  }

  // ── Pass (swipe left) ──────────────────────────────────────────────────────
  async function onPass(userId: string) {
    const uid = currentUserIdRef.current;
    if (!uid) return;
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

  const displayed = users.filter((u) => {
    if (viewMode === "list" && atGymUsers.length > 0 && atGymUserIds.has(u.id)) return false; // deduped into strip
    if (filters.atGym   && !u.is_at_gym)                                                  return false;
    if (filters.sport   && !(u.sports ?? []).includes(filters.sport))                     return false;
    if (filters.level   && u.fitness_level !== filters.level)                             return false;
    if (filters.schedule) {
      const slots = Object.entries((u.availability ?? {}) as Record<string, boolean>)
        .filter(([, v]) => v).map(([k]) => k);
      if (!slots.includes(filters.schedule))                                              return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!(u.full_name ?? u.username ?? "").toLowerCase().includes(q))                  return false;
    }
    return true;
  });

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
                  name={mode === "swipe" ? "heartActive" : mode === "list" ? "list" : "map"}
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

      {/* ── List view ────────────────────────────────────────────────────── */}
      {viewMode === "list" && (
        <FlatList
          data={[...pendingUsers, ...displayed]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} />}
          ListHeaderComponent={
            <>
              {/* At Gym Now strip — deduped from main list */}
              {atGymUsers.length > 0 && (
                <View style={{ gap: SPACE[10] }}>
                  <View style={s.atGymHeader}>
                    <View style={s.liveDot} />
                    <Text style={[s.atGymTitle, { color: c.text }]}>At the gym now</Text>
                    <Text style={[s.atGymCount, { color: c.textMuted }]}>{atGymUsers.length}</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: SPACE[12], paddingRight: SPACE[4] }}
                  >
                    {atGymUsers.slice(0, 8).map((u) => (
                      <AtGymBubble key={u.id} user={u} onPress={() => setSelectedUser(u)} />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Sport filter chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chips}
              >
                <FilterChip
                  label="All"
                  active={filters.sport === null && !filters.atGym}
                  onPress={() => setFilters((f) => ({ ...f, sport: null, atGym: false }))}
                />
                {sportOptions.map((sp) => (
                  <FilterChip
                    key={sp}
                    label={sp}
                    active={filters.sport === sp}
                    onPress={() => setFilters((f) => ({ ...f, sport: f.sport === sp ? null : sp }))}
                  />
                ))}
                <FilterChip
                  label="At Gym"
                  active={filters.atGym}
                  onPress={() => setFilters((f) => ({ ...f, atGym: !f.atGym }))}
                  dot={atGymUsers.length > 0}
                />
              </ScrollView>
            </>
          }
          ItemSeparatorComponent={() => <View style={{ height: SPACE[10] }} />}
          renderItem={({ item }) => (
            <PersonCard
              user={item}
              status={statuses[item.id] ?? "none"}
              matchId={matchIds[item.id]}
              onConnect={() => connect(item.id)}
              onCancelRequest={() => cancelRequest(item.id)}
              onPress={() => setSelectedUser(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="discover"
              title={filters.atGym ? "Nobody at the gym right now" : filters.sport ? `No ${filters.sport} partners yet` : "No new partners — pull to refresh"}
              subtitle={pendingUsers.length > 0 ? undefined : "Try adjusting your filters or refreshing."}
              action={{ label: "Clear filters", onPress: () => setFilters(EMPTY_FILTERS) }}
            />
          }
        />
      )}

      {/* ── Profile sheet ────────────────────────────────────────────────── */}
      <ProfileSheet
        user={selectedUser}
        status={selectedUser ? (statuses[selectedUser.id] ?? "none") : "none"}
        onConnect={() => { if (selectedUser) connect(selectedUser.id); }}
        onClose={() => setSelectedUser(null)}
      />

      {/* ── Filter modal ─────────────────────────────────────────────────── */}
      <FilterModal
        visible={showFilter}
        filters={filters}
        sportOptions={sportOptions}
        atGymCount={atGymUsers.length}
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

// ─── Filter Modal ─────────────────────────────────────────────────────────────
function FilterModal({
  visible, filters, sportOptions, atGymCount, onApply, onClose,
}: {
  visible:      boolean;
  filters:      Filters;
  sportOptions: string[];
  atGymCount:   number;
  onApply:      (f: Filters) => void;
  onClose:      () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [draft, setDraft] = useState<Filters>(filters);
  useEffect(() => { if (visible) setDraft(filters); }, [visible]);

  const count = activeFilterCount(draft);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={fm.backdrop} />
      </TouchableWithoutFeedback>

      <View style={fm.centeredWrap} pointerEvents="box-none">
        <View style={[fm.card, { backgroundColor: c.bgCard }]}>

          <View style={fm.headerRow}>
            <Text style={[fm.title, { color: c.text }]}>Filters</Text>
            <View style={fm.headerRight}>
              <TouchableOpacity onPress={() => setDraft(EMPTY_FILTERS)}>
                <Text style={[fm.reset, { color: c.brand }]}>Reset</Text>
              </TouchableOpacity>
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

            <View style={fm.section}>
              <Text style={[fm.sectionTitle, { color: c.textMuted }]}>FITNESS LEVEL</Text>
              <View style={fm.options}>
                {["beginner", "intermediate", "advanced"].map((lv) => (
                  <OptionChip
                    key={lv}
                    label={lv.charAt(0).toUpperCase() + lv.slice(1)}
                    active={draft.level === lv}
                    onPress={() => setDraft((d) => ({ ...d, level: d.level === lv ? null : lv }))}
                  />
                ))}
              </View>
            </View>

            <View style={fm.section}>
              <Text style={[fm.sectionTitle, { color: c.textMuted }]}>TRAINS</Text>
              <View style={fm.options}>
                {Object.entries(SCHEDULE_LABELS).map(([key, label]) => (
                  <OptionChip
                    key={key}
                    label={label}
                    active={draft.schedule === key}
                    onPress={() => setDraft((d) => ({ ...d, schedule: d.schedule === key ? null : key }))}
                  />
                ))}
              </View>
            </View>

            <View style={fm.section}>
              <Text style={[fm.sectionTitle, { color: c.textMuted }]}>SPORT</Text>
              <View style={fm.options}>
                {sportOptions.map((sp) => (
                  <OptionChip
                    key={sp}
                    label={sp}
                    active={draft.sport === sp}
                    onPress={() => setDraft((d) => ({ ...d, sport: d.sport === sp ? null : sp }))}
                  />
                ))}
              </View>
            </View>

            {atGymCount > 0 && (
              <TouchableOpacity
                style={[fm.toggleRow, { backgroundColor: c.bgCardAlt, borderColor: draft.atGym ? PALETTE.success : c.border }]}
                onPress={() => setDraft((d) => ({ ...d, atGym: !d.atGym }))}
                activeOpacity={0.8}
              >
                <View style={fm.toggleLeft}>
                  <View style={[fm.liveDot, { backgroundColor: PALETTE.success }]} />
                  <View>
                    <Text style={[fm.toggleLabel, { color: c.text }]}>At gym now only</Text>
                    <Text style={[fm.toggleSub, { color: c.textMuted }]}>{atGymCount} currently training</Text>
                  </View>
                </View>
                <View style={[fm.checkbox, { borderColor: draft.atGym ? PALETTE.success : c.border, backgroundColor: draft.atGym ? PALETTE.success : "transparent" }]}>
                  {draft.atGym && <Text style={fm.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[fm.applyBtn, { backgroundColor: c.brand }]}
            onPress={() => onApply(draft)}
            activeOpacity={0.85}
          >
            <Text style={fm.applyText}>
              {count > 0 ? `Show results · ${count} active` : "Show all results"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function OptionChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <TouchableOpacity
      style={[fm.optionChip, { backgroundColor: active ? c.brand : c.bgCardAlt, borderColor: active ? c.brand : c.border }]}
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
      style={[s.chip, active ? { backgroundColor: c.brand, borderColor: c.brand } : { backgroundColor: c.bgCardAlt, borderColor: c.border }]}
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
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  centeredWrap:{ ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  card:        { width: "88%", maxWidth: 420, borderRadius: RADIUS.xxl, overflow: "hidden" },

  headerRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACE[20], paddingBottom: SPACE[4] },
  headerRight: { flexDirection: "row", alignItems: "center", gap: SPACE[12] },
  title:       { fontSize: FONT.size.xl, fontWeight: FONT.weight.black },
  reset:       { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  closeBtn:    { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },

  content:     { padding: SPACE[20], paddingTop: SPACE[14], gap: SPACE[20] },
  section:     { gap: SPACE[10] },
  sectionTitle:{ fontSize: FONT.size.xs, fontWeight: FONT.weight.extrabold, letterSpacing: 1 },
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

  applyBtn:    { margin: SPACE[20], marginTop: SPACE[4], borderRadius: RADIUS.lg, paddingVertical: SPACE[16], alignItems: "center" },
  applyText:   { color: "#fff", fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },
});
