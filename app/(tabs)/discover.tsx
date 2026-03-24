/**
 * Discover Screen
 *
 * A ranked list of potential training partners, not a swipe deck.
 *
 * Screen structure:
 *   1. Header                   — title + result count
 *   2. At Gym Now strip         — time-sensitive bubble row (if anyone is live)
 *   3. Sport filter chips       — contextual to user's own sports
 *   4. FlatList of PersonCards  — ranked by matchScore
 *   5. Empty state              — when filters return nothing
 *
 * Intentional decisions:
 *   - No swipe gesture: reduces dating-app feel, enables scanning multiple people
 *   - No heart/emoji buttons: "Connect" label only
 *   - Trust signals (streak, level, active time) lead the card
 *   - Reason tags explain each suggestion before the user decides
 *   - Filters are contextual (user's own sports), not a generic modal
 */

import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../../lib/theme";
import { Icon } from "../../components/Icon";
import { EmptyState } from "../../components/ui/EmptyState";
import { PersonCard, DiscoverUser, RequestStatus } from "../../components/discover/PersonCard";
import { ProfileSheet } from "../../components/discover/ProfileSheet";

// ─── Types ────────────────────────────────────────────────────────────────────
type MyProfile = {
  id:            string;
  sports:        string[] | null;
  fitness_level: string | null;
  availability:  Record<string, boolean> | null;
  city:          string | null;
};

const LEVEL_ORDER: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };

// ─── Scoring ──────────────────────────────────────────────────────────────────
function calcMatchScore(me: MyProfile, other: DiscoverUser): number {
  let score = 0;
  const mySports    = me.sports ?? [];
  const theirSports = other.sports ?? [];

  // Sports overlap: up to 30pts
  if (mySports.length > 0 && theirSports.length > 0) {
    const overlap = mySports.filter((s) => theirSports.includes(s)).length;
    score += Math.round((overlap / Math.min(mySports.length, theirSports.length)) * 30);
  }

  // Level: 20pts same, 10pts adjacent
  if (me.fitness_level && other.fitness_level) {
    const diff = Math.abs(
      (LEVEL_ORDER[me.fitness_level] ?? 1) - (LEVEL_ORDER[other.fitness_level] ?? 1)
    );
    if (diff === 0) score += 20;
    else if (diff === 1) score += 10;
  }

  // Schedule: up to 15pts
  const mySlots    = Object.entries(me.availability ?? {}).filter(([, v]) => v).map(([k]) => k);
  const theirSlots = Object.entries(other.availability ?? {} as Record<string, boolean>).filter(([, v]) => v).map(([k]) => k);
  if (mySlots.length > 0 && theirSlots.length > 0) {
    const overlap = mySlots.filter((s) => theirSlots.includes(s)).length;
    score += Math.round((overlap / Math.max(mySlots.length, theirSlots.length)) * 15);
  }

  // Activity recency: up to 20pts
  if (other.last_active) {
    const hrs = (Date.now() - new Date(other.last_active).getTime()) / 3600000;
    if (hrs <= 24)  score += 20;
    else if (hrs <= 72)  score += 12;
    else if (hrs <= 168) score += 5;
  }

  // At gym bonus (they're available right now)
  if (other.is_at_gym) score += 10;

  return Math.min(score, 100);
}

function buildReasons(me: MyProfile, other: DiscoverUser): string[] {
  const reasons: string[] = [];
  const mySports    = me.sports ?? [];
  const shared      = mySports.filter((s) => (other.sports ?? []).includes(s));

  if (shared.length === 1)      reasons.push(shared[0]);
  else if (shared.length > 1)   reasons.push(`${shared.length} shared sports`);

  if (me.fitness_level && other.fitness_level === me.fitness_level) {
    reasons.push("Same level");
  }

  const mySlots = Object.entries(me.availability ?? {}).filter(([, v]) => v).map(([k]) => k);
  const SLOT: Record<string, string> = {
    morning: "Trains mornings", afternoon: "Trains afternoons",
    evening: "Trains evenings", weekend:   "Trains weekends",
  };
  const theirSlots = Object.entries(other.availability ?? {} as Record<string, boolean>).filter(([, v]) => v).map(([k]) => k);
  const sharedSlots = mySlots.filter((s) => theirSlots.includes(s));
  if (sharedSlots.length > 0) reasons.push(SLOT[sharedSlots[0]] ?? sharedSlots[0]);

  if (me.city && other.city?.toLowerCase() === me.city.toLowerCase()) reasons.push("Nearby");

  return reasons.slice(0, 3);
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [myProfile,   setMyProfile]   = useState<MyProfile | null>(null);
  const [users,       setUsers]       = useState<DiscoverUser[]>([]);
  const [statuses,    setStatuses]    = useState<Record<string, RequestStatus>>({});
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [activeSport,   setActiveSport]   = useState<string | null>(null);
  const [onlyAtGym,     setOnlyAtGym]     = useState(false);
  const [selectedUser,  setSelectedUser]  = useState<DiscoverUser | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update my last_active
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
        .select("receiver_id, status")
        .eq("sender_id", user.id)
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

    // Build exclusion set
    const excluded = new Set([
      user.id,
      ...(matchData  ?? []).map((m: any) => m.receiver_id),
      ...(passData   ?? []).map((p: any) => p.passed_id),
    ]);

    // Initialise request status map from existing matches
    const initialStatuses: Record<string, RequestStatus> = {};
    for (const m of matchData ?? []) {
      initialStatuses[m.receiver_id] = m.status === "accepted" ? "accepted" : "pending";
    }

    // Fetch candidates
    const { data: candidates } = await supabase
      .from("users")
      .select("id, username, full_name, bio, city, fitness_level, age, sports, current_streak, last_active, avatar_url, is_at_gym, availability")
      .neq("id", user.id)
      .limit(80);

    const scored: DiscoverUser[] = (candidates ?? [])
      .filter((u: any) => !excluded.has(u.id))
      .map((u: any): DiscoverUser => {
        const partial: DiscoverUser = {
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
        };
        partial.matchScore = calcMatchScore(me, partial);
        partial.reasons    = buildReasons(me, partial);
        return partial;
      })
      // Float at-gym users first, then sort by matchScore
      .sort((a, b) => {
        if (a.is_at_gym !== b.is_at_gym) return a.is_at_gym ? -1 : 1;
        return b.matchScore - a.matchScore;
      });

    setUsers(scored);
    setStatuses(initialStatuses);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Connect ─────────────────────────────────────────────────────────────────
  async function connect(userId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setStatuses((prev) => ({ ...prev, [userId]: "pending" }));
    await supabase.from("matches").insert({ sender_id: user.id, receiver_id: userId, status: "pending" });
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const atGymUsers = users.filter((u) => u.is_at_gym);

  // Sport chips: user's own sports + fallback basics if empty
  const sportOptions: string[] = myProfile?.sports?.length
    ? myProfile.sports
    : ["Gym", "Running", "Cycling"];

  const displayed = users.filter((u) => {
    if (onlyAtGym && !u.is_at_gym) return false;
    if (activeSport && !(u.sports ?? []).includes(activeSport)) return false;
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
      <FlatList
        data={displayed}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} />}
        ListHeaderComponent={
          <>
            {/* ── Header ──────────────────────────────────────── */}
            <View style={s.header}>
              <View>
                <Text style={[s.title, { color: c.text }]}>Discover</Text>
                {displayed.length > 0 && (
                  <Text style={[s.subtitle, { color: c.textMuted }]}>
                    {displayed.length} potential partner{displayed.length !== 1 ? "s" : ""}
                  </Text>
                )}
              </View>
              <Icon name="filter" size={22} color={c.textSecondary} />
            </View>

            {/* ── At Gym Now strip ─────────────────────────────── */}
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
                    <AtGymBubble key={u.id} user={u} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ── Filter chips ─────────────────────────────────── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chips}
            >
              {/* All */}
              <FilterChip
                label="All"
                active={activeSport === null && !onlyAtGym}
                onPress={() => { setActiveSport(null); setOnlyAtGym(false); }}
              />
              {/* Sport filters */}
              {sportOptions.map((sp) => (
                <FilterChip
                  key={sp}
                  label={sp}
                  active={activeSport === sp}
                  onPress={() => setActiveSport(activeSport === sp ? null : sp)}
                />
              ))}
              {/* At Gym toggle */}
              <FilterChip
                label="At Gym"
                active={onlyAtGym}
                onPress={() => setOnlyAtGym((v) => !v)}
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
            onConnect={() => connect(item.id)}
            onPress={() => setSelectedUser(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="discover"
            title={onlyAtGym ? "Nobody at the gym right now" : activeSport ? `No ${activeSport} partners yet` : "No partners found"}
            subtitle={onlyAtGym ? "Check back later or browse all partners." : "Try adjusting your filters or refreshing."}
            action={{ label: "Show all", onPress: () => { setActiveSport(null); setOnlyAtGym(false); } }}
          />
        }
      />

      <ProfileSheet
        user={selectedUser}
        status={selectedUser ? (statuses[selectedUser.id] ?? "none") : "none"}
        onConnect={() => { if (selectedUser) connect(selectedUser.id); }}
        onClose={() => setSelectedUser(null)}
      />
    </SafeAreaView>
  );
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function AtGymBubble({ user }: { user: DiscoverUser }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const initial = (user.full_name ?? user.username)[0]?.toUpperCase() ?? "?";
  const name    = (user.full_name ?? user.username).split(" ")[0];

  return (
    <View style={s.bubble}>
      <View style={[s.bubbleAvatar, { backgroundColor: c.brandSubtle, borderColor: PALETTE.success }]}>
        <Text style={[s.bubbleInitial, { color: c.brand }]}>{initial}</Text>
        <View style={[s.bubbleDot, { borderColor: c.bg }]} />
      </View>
      <Text style={[s.bubbleName, { color: c.textSecondary }]} numberOfLines={1}>{name}</Text>
    </View>
  );
}

function FilterChip({
  label, active, onPress, dot,
}: { label: string; active: boolean; onPress: () => void; dot?: boolean }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <TouchableOpacity
      style={[
        s.chip,
        active
          ? { backgroundColor: c.brand, borderColor: c.brand }
          : { backgroundColor: c.bgCardAlt, borderColor: c.border },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {dot && !active && <View style={s.chipDot} />}
      <Text style={[s.chipText, { color: active ? "#fff" : c.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: SPACE[16], paddingBottom: SPACE[48], gap: SPACE[16] },

  // Header
  header:    { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: SPACE[4] },
  title:     { fontSize: FONT.size.xxxl, fontWeight: FONT.weight.black, letterSpacing: -0.5 },
  subtitle:  { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium, marginTop: 2 },

  // At Gym strip
  atGymHeader: { flexDirection: "row", alignItems: "center", gap: SPACE[6] },
  liveDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: PALETTE.success },
  atGymTitle:  { fontSize: FONT.size.base, fontWeight: FONT.weight.bold, flex: 1 },
  atGymCount:  { fontSize: FONT.size.sm },

  bubble:       { alignItems: "center", gap: SPACE[4], width: 52 },
  bubbleAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  bubbleInitial:{ fontSize: FONT.size.lg, fontWeight: FONT.weight.black },
  bubbleDot:    { position: "absolute", bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: PALETTE.success, borderWidth: 2 },
  bubbleName:   { fontSize: FONT.size.xs, fontWeight: FONT.weight.medium },

  // Filter chips
  chips:    { gap: SPACE[8], paddingRight: SPACE[4] },
  chip:     { flexDirection: "row", alignItems: "center", gap: SPACE[4], paddingHorizontal: SPACE[14], paddingVertical: SPACE[8], borderRadius: RADIUS.pill, borderWidth: 1 },
  chipDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: PALETTE.success },
  chipText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
});
