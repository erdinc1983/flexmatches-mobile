import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, TextInput, Modal, Alert, RefreshControl,
  KeyboardAvoidingView, Platform, ScrollView, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { ErrorState } from "../../components/ui/ErrorState";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../../lib/theme";
import { useAppData } from "../../lib/appDataContext";
import { Icon } from "../../components/Icon";

type Workout = {
  id: string;
  exercise_type: string | null;
  notes: string | null;
  duration_min: number | null;
  logged_at: string;
};

const SPORTS = ["Running", "Cycling", "Swimming", "Weightlifting", "CrossFit", "Yoga", "Boxing", "Tennis", "Basketball", "Hiking", "Climbing", "Other"];

const APP_LOGO = require("../../assets/images/icon.png");

export default function ActivityScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { appUser, appUserLoading, updateAppUser } = useAppData();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [sport, setSport] = useState("Weightlifting");
  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState("");
  const [saving, setSaving] = useState(false);

  const [streak, setStreak] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [isAtGym, setIsAtGym] = useState(false);
  const [gymToggling, setGymToggling] = useState(false);

  const lastLoadRef = useRef(0);
  const loadingRef  = useRef(false);
  const mountedRef  = useRef(true);
  const STALE_MS = 5 * 60_000; // 5 min cache per tab

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
    if (mountedRef.current) setError(false);
    if (!isRefresh && mountedRef.current) setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // Use AppDataContext for own profile fields — no users table query needed
    setStreak(appUser?.current_streak ?? 0);

    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: wData }, { count: mCount }] = await Promise.all([
      supabase.from("workouts").select("id, exercise_type, notes, duration_min, logged_at").eq("user_id", user.id).order("logged_at", { ascending: false }).limit(50),
      supabase.from("workouts").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("logged_at", monthAgo),
    ]);

    setWorkouts(wData ?? []);
    setMonthCount(mCount ?? 0);

    let atGym = appUser?.is_at_gym ?? false;
    if (atGym && appUser?.gym_checkin_at) {
      const age = Date.now() - new Date(appUser.gym_checkin_at).getTime();
      if (age > 4 * 60 * 60 * 1000) {
        atGym = false;
        supabase.from("users").update({ is_at_gym: false, gym_checkin_at: null }).eq("id", user.id).then(() => {});
        updateAppUser({ is_at_gym: false, gym_checkin_at: null });
      }
    }
    setIsAtGym(atGym);
    if (mountedRef.current) lastLoadRef.current = Date.now();
    } catch (err) {
      console.error("[Activity] load failed:", err);
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
  }, [appUser, updateAppUser]);

  useFocusEffect(useCallback(() => {
    const elapsed = Date.now() - lastLoadRef.current;
    if (elapsed > STALE_MS || workouts.length === 0) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, workouts.length]));

  useEffect(() => {
    if (!loading || appUserLoading) return;
    const t = setTimeout(() => { setLoading(false); setError(true); }, 30_000);
    return () => clearTimeout(t);
  }, [loading, appUserLoading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  async function logWorkout() {
    if (!userId) return;
    setSaving(true);
    try {
      const { error: insertError } = await supabase.from("workouts").insert({
        user_id:       userId,
        exercise_type: sport || "Gym",
        notes:         notes.trim() || null,
        duration_min:  duration ? Math.max(1, parseInt(duration) || 1) : null,
        logged_at:     new Date().toISOString(),
      });
      if (insertError) throw insertError;

      // Local calendar date (not UTC) — satisfies AC4
      const localDate = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

      // Atomic streak update via RPC — no read-modify-write race condition
      const { data: streakResult } = await supabase.rpc("update_streak_for_workout", {
        p_user_id:    userId,
        p_local_date: localDate,
      });
      const newStreak = streakResult?.streak ?? streak;

      setStreak(newStreak);
      // Keep AppDataContext in sync so Home and Profile reflect the new
      // streak immediately without waiting for the next focus refresh.
      updateAppUser({ current_streak: newStreak, last_checkin_date: localDate });

      const feedContent = notes.trim()
        ? `${sport} · ${notes.trim()}${duration ? ` · ${duration}min` : ""}`
        : `${sport} workout${duration ? ` · ${duration}min` : ""}${newStreak > 1 ? ` · 🔥 ${newStreak} day streak` : ""}`;
      await supabase.from("feed_posts").insert({
        user_id:   userId,
        post_type: "workout",
        content:   feedContent,
        meta:      { sport, duration: duration || null, streak: newStreak },
      });

      setModalVisible(false);
      setNotes("");
      setDuration("");
      await load();
    } catch (err) {
      console.error("[logWorkout] failed:", err);
      Alert.alert("Error", "Could not save workout. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  async function toggleGym() {
    if (!userId || gymToggling) return;
    setGymToggling(true);
    const next = !isAtGym;
    await supabase.from("users").update({
      is_at_gym: next,
      gym_checkin_at: next ? new Date().toISOString() : null,
    }).eq("id", userId);
    setIsAtGym(next);
    setGymToggling(false);
  }

  if (loading) return (
    <SafeAreaView style={[s.flex, { backgroundColor: c.bg }]}>
      <ActivityIndicator color={c.brand} size="large" style={{ flex: 1 }} />
    </SafeAreaView>
  );

  if (error) return (
    <SafeAreaView style={[s.flex, { backgroundColor: c.bg }]}>
      <ErrorState onRetry={load} message="Could not load your activity." />
    </SafeAreaView>
  );

  const groups: { date: string; items: Workout[] }[] = [];
  for (const w of workouts) {
    const date = formatDate(w.logged_at);
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.items.push(w);
    else groups.push({ date, items: [w] });
  }

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.title, { color: c.text }]}>Activity</Text>
        <TouchableOpacity
          style={[s.logBtn, { backgroundColor: c.brand }]}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Icon name="add" size={16} color="#fff" />
          <Text style={s.logBtnText}>Log</Text>
        </TouchableOpacity>
      </View>

      {/* Gym Toggle */}
      <TouchableOpacity
        style={[
          s.gymToggle,
          { backgroundColor: c.bgCard, borderColor: c.border },
          isAtGym && { backgroundColor: PALETTE.successSubtle, borderColor: PALETTE.success + "55" },
        ]}
        onPress={toggleGym}
        activeOpacity={0.8}
        disabled={gymToggling}
      >
        <Icon name="gym" size={20} color={isAtGym ? PALETTE.success : c.textMuted} />
        <Text style={[s.gymToggleText, { color: isAtGym ? PALETTE.success : c.textMuted }]}>
          {gymToggling ? "Updating..." : isAtGym ? "I'm at the gym  ·  Tap to leave" : "Check in at the gym"}
        </Text>
        <View style={[s.gymDot, { backgroundColor: c.border }, isAtGym && { backgroundColor: PALETTE.success }]} />
      </TouchableOpacity>

      {/* Stats bar */}
      <View style={[s.statsBar, { backgroundColor: c.bgCard, borderColor: c.border }]}>
        <View style={s.stat}>
          <Text style={[s.statValue, { color: c.text }]}>{streak}</Text>
          <View style={s.statLabelRow}>
            <Icon name="streak" size={11} color={c.textMuted} />
            <Text style={[s.statLabel, { color: c.textMuted }]}>Streak</Text>
          </View>
        </View>
        <View style={[s.statDivider, { backgroundColor: c.border }]} />
        <View style={s.stat}>
          <Text style={[s.statValue, { color: c.text }]}>{monthCount}</Text>
          <View style={s.statLabelRow}>
            <Icon name="workout" size={11} color={c.textMuted} />
            <Text style={[s.statLabel, { color: c.textMuted }]}>This Month</Text>
          </View>
        </View>
        <View style={[s.statDivider, { backgroundColor: c.border }]} />
        <View style={s.stat}>
          <Text style={[s.statValue, { color: c.text }]}>{workouts.length}</Text>
          <View style={s.statLabelRow}>
            <Icon name="leaderboard" size={11} color={c.textMuted} />
            <Text style={[s.statLabel, { color: c.textMuted }]}>Total</Text>
          </View>
        </View>
      </View>

      {workouts.length === 0 ? (
        <View style={s.empty}>
          <Icon name="gym" size={60} color={c.textMuted} />
          <Text style={[s.emptyTitle, { color: c.text }]}>No workouts yet</Text>
          <Text style={[s.emptyText, { color: c.textMuted }]}>Log your first workout to start your streak!</Text>
          <TouchableOpacity
            style={[s.startBtn, { backgroundColor: c.brand }]}
            onPress={() => setModalVisible(true)}
          >
            <Text style={s.startBtnText}>Log First Workout</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.date}
          contentContainerStyle={{ paddingHorizontal: SPACE[16], paddingBottom: SPACE[40] }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} />}
          renderItem={({ item: group }) => (
            <View style={s.group}>
              <Text style={[s.groupDate, { color: c.textMuted }]}>{group.date}</Text>
              {group.items.map((w) => (
                <View key={w.id} style={[s.workoutCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
                  <View style={s.workoutLeft}>
                    <View style={s.workoutLogoWrap}>
                      <Image source={APP_LOGO} style={s.workoutLogo} resizeMode="cover" />
                    </View>
                    <View>
                      <Text style={[s.workoutSport, { color: c.text }]}>{w.exercise_type ?? "Workout"}</Text>
                      {w.notes && <Text style={[s.workoutNotes, { color: c.textMuted }]} numberOfLines={1}>{w.notes}</Text>}
                    </View>
                  </View>
                  <View style={s.workoutRight}>
                    {w.duration_min && (
                      <Text style={[s.workoutDuration, { color: c.brand }]}>{w.duration_min}m</Text>
                    )}
                    <Text style={[s.workoutTime, { color: c.textMuted }]}>{formatTime(w.logged_at)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        />
      )}

      {/* Log Workout Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: c.bg }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={s.modal}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: c.text }]}>Log Workout</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={s.closeBtn}>
                <Icon name="close" size={22} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[s.fieldLabel, { color: c.textMuted }]}>Sport</Text>
            <View style={s.sportsGrid}>
              {SPORTS.map((sp) => (
                <TouchableOpacity
                  key={sp}
                  style={[
                    s.sportChip,
                    { backgroundColor: c.bgCard, borderColor: c.border },
                    sport === sp && { backgroundColor: c.brandSubtle, borderColor: c.brand },
                  ]}
                  onPress={() => setSport(sp)}
                >
                  <Text style={[s.sportChipText, { color: sport === sp ? c.brand : c.textMuted }]}>{sp}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.fieldLabel, { color: c.textMuted }]}>Duration (minutes)</Text>
            <TextInput
              style={[s.input, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text }]}
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
              placeholder="e.g. 45"
              placeholderTextColor={c.textFaint}
              accessibilityLabel="Workout duration in minutes"
            />

            <Text style={[s.fieldLabel, { color: c.textMuted }]}>Notes (optional)</Text>
            <TextInput
              style={[s.input, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text, height: 90, textAlignVertical: "top", paddingTop: 12 }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="How did it go?"
              placeholderTextColor={c.textFaint}
              accessibilityLabel="Workout notes"
            />

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: c.brand }]}
              onPress={logWorkout}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={s.saveBtnInner}>
                  <Icon name="workout" size={18} color="#fff" />
                  <Text style={s.saveBtnText}>Log Workout</Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: SPACE[20], paddingTop: SPACE[12], paddingBottom: SPACE[8] },
  title: { fontSize: FONT.size.xxxl, fontWeight: FONT.weight.black, letterSpacing: -0.5 },
  logBtn: { flexDirection: "row", alignItems: "center", gap: SPACE[4], borderRadius: RADIUS.pill, paddingHorizontal: SPACE[16], paddingVertical: SPACE[8] },
  logBtnText: { color: "#fff", fontWeight: FONT.weight.extrabold, fontSize: FONT.size.sm },
  statsBar: { flexDirection: "row", marginHorizontal: SPACE[16], marginBottom: SPACE[16], borderRadius: RADIUS.lg, padding: SPACE[16], borderWidth: 1 },
  stat: { flex: 1, alignItems: "center", gap: SPACE[4] },
  statValue: { fontSize: 22, fontWeight: FONT.weight.black },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: SPACE[4] },
  statLabel: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
  statDivider: { width: 1 },
  group: { marginBottom: SPACE[24] },
  groupDate: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: SPACE[10] },
  workoutCard: { flexDirection: "row", alignItems: "center", borderRadius: RADIUS.md, padding: SPACE[14], marginBottom: SPACE[8], borderWidth: 1 },
  workoutLeft:     { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACE[12] },
  workoutLogoWrap: { width: 40, height: 40, borderRadius: 10, overflow: "hidden" },
  workoutLogo:     { width: 40, height: 40 },
  workoutSport: { fontSize: FONT.size.md, fontWeight: FONT.weight.bold },
  workoutNotes: { fontSize: FONT.size.xs, marginTop: 2 },
  workoutRight: { alignItems: "flex-end", gap: SPACE[4] },
  workoutDuration: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  workoutTime: { fontSize: FONT.size.xs },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE[12], paddingHorizontal: SPACE[32] },
  emptyTitle: { fontSize: 22, fontWeight: FONT.weight.extrabold },
  emptyText: { fontSize: FONT.size.base, textAlign: "center" },
  startBtn: { borderRadius: RADIUS.md, paddingHorizontal: SPACE[32], paddingVertical: SPACE[14], marginTop: SPACE[8] },
  startBtnText: { color: "#fff", fontWeight: FONT.weight.bold, fontSize: FONT.size.lg },
  modal: { flex: 1, padding: SPACE[24], gap: SPACE[16] },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 22, fontWeight: FONT.weight.black },
  closeBtn: { padding: SPACE[4] },
  fieldLabel: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, letterSpacing: 0.8, textTransform: "uppercase" },
  sportsGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE[8] },
  sportChip: { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[14], paddingVertical: 7, borderWidth: 1 },
  sportChipText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  input: { borderRadius: RADIUS.md, paddingHorizontal: SPACE[16], paddingVertical: SPACE[14], fontSize: FONT.size.md, borderWidth: 1.5 },
  saveBtn: { borderRadius: RADIUS.lg, paddingVertical: 18, alignItems: "center", marginTop: SPACE[8] },
  saveBtnInner: { flexDirection: "row", alignItems: "center", gap: SPACE[8] },
  saveBtnText: { color: "#fff", fontWeight: FONT.weight.extrabold, fontSize: FONT.size.lg },
  gymToggle: { flexDirection: "row", alignItems: "center", marginHorizontal: SPACE[16], marginBottom: SPACE[12], borderRadius: RADIUS.md, paddingHorizontal: SPACE[14], paddingVertical: SPACE[12], gap: SPACE[10], borderWidth: 1 },
  gymToggleText: { flex: 1, fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  gymDot: { width: 10, height: 10, borderRadius: 5 },
});
