import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { calcTier, TIERS } from "../../lib/badges";
import { ErrorState } from "../../components/ui/ErrorState";
import { Avatar } from "../../components/Avatar";
import { useTheme, SPACE, FONT, RADIUS } from "../../lib/theme";
import { Icon } from "../../components/Icon";

type Leader = {
  id: string;
  full_name: string | null;
  username: string;
  avatar_url: string | null;
  current_streak: number;
  total_kudos: number;
  city: string | null;
  points: number;
};

export default function LeaderboardScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [me, setMe] = useState<Leader | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [tab, setTab] = useState<"global" | "friends">("global");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, [tab]);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => { setLoading(false); setError(true); }, 30_000);
    return () => clearTimeout(t);
  }, [loading]);

  async function load(isRefresh = false) {
    try {
      setError(false);
      if (!isRefresh) setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let rawList: Omit<Leader, "points">[] = [];

      if (tab === "global") {
        const { data } = await supabase
          .from("users")
          .select("id,full_name,username,avatar_url,current_streak,total_kudos,city")
          .limit(50);
        rawList = (data ?? []) as Omit<Leader, "points">[];
      } else {
        const { data: matchData } = await supabase
          .from("matches")
          .select("sender_id,receiver_id")
          .eq("status", "accepted")
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
        const friendIds = (matchData ?? []).map((m: any) =>
          m.sender_id === user.id ? m.receiver_id : m.sender_id
        );
        friendIds.push(user.id);
        const { data } = await supabase
          .from("users")
          .select("id,full_name,username,avatar_url,current_streak,total_kudos,city")
          .in("id", friendIds);
        rawList = (data ?? []) as Omit<Leader, "points">[];
      }

      // Bulk-fetch badge + workout counts to compute points (2 queries, not N)
      const ids = rawList.map((u) => u.id);
      const [{ data: badgeRows }, { data: workoutRows }] = await Promise.all([
        supabase.from("user_badges").select("user_id").in("user_id", ids),
        supabase.from("workouts").select("user_id").in("user_id", ids),
      ]);

      const badgeCounts: Record<string, number> = {};
      for (const b of badgeRows ?? []) badgeCounts[b.user_id] = (badgeCounts[b.user_id] ?? 0) + 1;
      const workoutCounts: Record<string, number> = {};
      for (const w of workoutRows ?? []) workoutCounts[w.user_id] = (workoutCounts[w.user_id] ?? 0) + 1;

      const list: Leader[] = rawList
        .map((u) => ({
          ...u,
          points: (badgeCounts[u.id] ?? 0) * 100 + (workoutCounts[u.id] ?? 0) * 10 + (u.current_streak ?? 0) * 5,
        }))
        .sort((a, b) => b.points - a.points);

      setLeaders(list);
      const myData = list.find((u) => u.id === user.id) ?? null;
      setMe(myData);
      const rank = list.findIndex((u) => u.id === user.id);
      setMyRank(rank >= 0 ? rank + 1 : null);
    } catch (err) {
      console.error("[Leaderboard] load failed:", err);
      if (isRefresh) {
        Alert.alert("Error", "Could not refresh. Please try again.");
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }

  const myTier = me ? calcTier(me.points) : TIERS[0];
  const nextTierPoints = myTier.nextPoints;
  const progress = me && nextTierPoints !== null
    ? Math.min((me.points / nextTierPoints) * 100, 100)
    : 100;

  const rankDisplay = (i: number) => {
    if (i === 0) return "🥇";
    if (i === 1) return "🥈";
    if (i === 2) return "🥉";
    return `#${i + 1}`;
  };

  if (loading) return (
    <SafeAreaView style={[s.flex, { backgroundColor: c.bg }]}>
      <ActivityIndicator color={c.brand} size="large" style={{ flex: 1 }} />
    </SafeAreaView>
  );

  if (error) return (
    <SafeAreaView style={[s.flex, { backgroundColor: c.bg }]}>
      <ErrorState onRetry={load} message="Could not load leaderboard." />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Icon name="back" size={24} color={c.textSecondary} />
        </TouchableOpacity>
        <View>
          <Text style={[s.title, { color: c.text }]}>Leaderboard</Text>
          <Text style={[s.subtitle, { color: c.textMuted }]}>Top streaks in the community</Text>
        </View>
      </View>

      <FlatList
        data={leaders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} />}
        ListHeaderComponent={
          <>
            {/* My tier card */}
            {me && (
              <View style={[s.myTierCard, { backgroundColor: c.bgCard, borderColor: myTier.color + "44" }]}>
                <View style={s.myTierRow}>
                  <View style={[s.tierBadge, { borderColor: myTier.color, backgroundColor: myTier.color + "22" }]}>
                    <Text style={{ fontSize: 22 }}>{myTier.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.tierLabel, { color: myTier.color }]}>{myTier.label} Tier</Text>
                    <Text style={[s.tierStreak, { color: c.text }]}>{me.points} pts</Text>
                    {myRank && (
                      <Text style={[s.tierRank, { color: c.textMuted }]}>
                        #{myRank} {tab === "global" ? "globally" : "among friends"}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[s.kudosLabel, { color: c.textMuted }]}>Kudos</Text>
                    <Text style={[s.kudosValue, { color: myTier.color }]}>🔥 {(me as any).total_kudos ?? 0}</Text>
                  </View>
                </View>

                {nextTierPoints !== null && (
                  <View style={{ marginTop: SPACE[14] }}>
                    <View style={s.progressLabelRow}>
                      <Text style={[s.progressLabel, { color: c.textMuted }]}>{myTier.label}</Text>
                      <Text style={[s.progressLabel, { color: c.textMuted }]}>
                        {me.points} / {nextTierPoints} pts → next tier
                      </Text>
                    </View>
                    <View style={[s.progressBar, { backgroundColor: c.border }]}>
                      <View style={[s.progressFill, {
                        width: `${progress}%` as any,
                        backgroundColor: myTier.color,
                      }]} />
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Tier legend */}
            <View style={s.tierLegend}>
              {[...TIERS].reverse().map((t) => (
                <View key={t.key} style={[s.tierChip, { borderColor: t.color + "44", backgroundColor: c.bgCard }]}>
                  <Text style={[s.tierChipText, { color: t.color }]}>{t.emoji} {t.label}</Text>
                </View>
              ))}
            </View>

            {/* Tab switcher */}
            <View style={s.tabs}>
              {(["global", "friends"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[s.tabBtn, { backgroundColor: c.bgCard }, tab === t && { backgroundColor: c.brand }]}
                  onPress={() => setTab(t)}
                >
                  <Text style={[s.tabBtnText, { color: tab === t ? "#fff" : c.textMuted }]}>
                    {t === "global" ? "🌍 Global" : "🤝 Friends"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {loading && <ActivityIndicator color={c.brand} style={{ marginTop: SPACE[20] }} />}
          </>
        }
        ListEmptyComponent={!loading ? (
          <Text style={[s.emptyText, { color: c.textMuted }]}>
            {tab === "friends" ? "Connect with people to see their streaks!" : "No users yet."}
          </Text>
        ) : null}
        renderItem={({ item: user, index: i }) => {
          const tier = calcTier(user.points);
          const isMe = me?.id === user.id;
          const rankColor = i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : c.textMuted;

          return (
            <View style={[
              s.row,
              { backgroundColor: c.bgCard, borderColor: c.border },
              isMe && { backgroundColor: tier.color + "11", borderColor: tier.color + "44" },
            ]}>
              <Text style={[s.rank, { color: rankColor }]}>{rankDisplay(i)}</Text>
              <Avatar
                url={user.avatar_url}
                name={user.username || user.full_name || "?"}
                size={40}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.rowName, { color: c.text }]} numberOfLines={1}>
                  {user.full_name ?? user.username}
                  {isMe ? <Text style={[s.youTag, { color: tier.color }]}> (you)</Text> : null}
                </Text>
                <Text style={[s.rowSub, { color: c.textMuted }]}>
                  {tier.emoji} {tier.label}{user.city ? ` · ${user.city}` : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[s.streakVal, { color: tier.color }]}>{user.points}</Text>
                <Text style={[s.streakSub, { color: c.textMuted }]}>pts</Text>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE[16], paddingVertical: SPACE[12], gap: SPACE[12] },
  backBtn: { padding: SPACE[4] },
  title: { fontSize: 22, fontWeight: FONT.weight.extrabold },
  subtitle: { fontSize: FONT.size.xs, marginTop: 2 },
  list: { paddingHorizontal: SPACE[16], paddingBottom: SPACE[40], gap: 0 },
  myTierCard: { borderRadius: RADIUS.lg, padding: SPACE[16], marginBottom: SPACE[16], borderWidth: 1 },
  myTierRow: { flexDirection: "row", alignItems: "center", gap: SPACE[12] },
  tierBadge: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  tierLabel: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 1 },
  tierStreak: { fontSize: 18, fontWeight: FONT.weight.extrabold },
  tierRank: { fontSize: FONT.size.xs },
  kudosLabel: { fontSize: FONT.size.xs, marginBottom: 2 },
  kudosValue: { fontSize: 18, fontWeight: FONT.weight.extrabold },
  progressLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: SPACE[4] },
  progressLabel: { fontSize: FONT.size.xs },
  progressBar: { height: 6, borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3 },
  tierLegend: { flexDirection: "row", gap: SPACE[6], marginBottom: SPACE[16], flexWrap: "wrap" },
  tierChip: { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[10], paddingVertical: SPACE[4], borderWidth: 1 },
  tierChipText: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
  tabs: { flexDirection: "row", gap: SPACE[8], marginBottom: SPACE[16] },
  tabBtn: { flex: 1, paddingVertical: SPACE[10], borderRadius: RADIUS.md, alignItems: "center" },
  tabBtnText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE[12], borderWidth: 1, borderRadius: RADIUS.md, padding: SPACE[12], marginBottom: SPACE[8] },
  rank: { width: 28, textAlign: "center", fontWeight: FONT.weight.extrabold, fontSize: FONT.size.base },
  rowName: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  youTag: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
  rowSub: { fontSize: FONT.size.xs, marginTop: 2 },
  streakVal: { fontSize: FONT.size.lg, fontWeight: FONT.weight.extrabold },
  streakSub: { fontSize: FONT.size.xs },
  emptyText: { textAlign: "center", fontSize: FONT.size.base, marginTop: SPACE[20] },
});
