/**
 * Challenges Screen
 *
 * Browse and join community fitness challenges.
 * - Card list with progress bars + days left
 * - Detail modal: mini leaderboard + progress updater
 * - Create challenge modal
 */

import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, TextInput,
  Alert, RefreshControl, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useTheme, SPACE, FONT, RADIUS } from "../../lib/theme";
import { Avatar } from "../../components/Avatar";
import { EmptyState } from "../../components/ui/EmptyState";

// ─── Types ────────────────────────────────────────────────────────────────────

type Challenge = {
  id:                string;
  title:             string;
  description:       string | null;
  goal_type:         string;
  target_value:      number | null;
  unit:              string | null;
  end_date:          string | null;
  created_by:        string;
  participant_count: number;
  my_value:          number | null;
  joined:            boolean;
};

type LeaderEntry = {
  user_id:       string;
  username:      string;
  avatar_url:    string | null;
  current_value: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const GOAL_TYPES = [
  { key: "running",        label: "Running",      emoji: "🏃", unit: "km"   },
  { key: "workout_streak", label: "Workout Days", emoji: "💪", unit: "days" },
  { key: "weight_loss",    label: "Weight Loss",  emoji: "⚖️",  unit: "kg"   },
  { key: "steps",          label: "Steps",        emoji: "👟", unit: "steps"},
  { key: "cycling",        label: "Cycling",      emoji: "🚴", unit: "km"   },
  { key: "custom",         label: "Custom",       emoji: "🎯", unit: ""     },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysLeft(endDate: string | null): number | null {
  if (!endDate) return null;
  const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000);
  return diff > 0 ? diff : 0;
}

function typeInfo(goalType: string) {
  return GOAL_TYPES.find((t) => t.key === goalType) ?? { emoji: "🎯", label: goalType, unit: "" };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ChallengesScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [challenges,  setChallenges]  = useState<Challenge[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [userId,      setUserId]      = useState<string | null>(null);

  // Detail modal
  const [selected,      setSelected]      = useState<Challenge | null>(null);
  const [leaderboard,   setLeaderboard]   = useState<LeaderEntry[]>([]);
  const [progressInput, setProgressInput] = useState("");
  const [savingProg,    setSavingProg]    = useState(false);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [formTitle,  setFormTitle]  = useState("");
  const [formType,   setFormType]   = useState("running");
  const [formTarget, setFormTarget] = useState("");
  const [formUnit,   setFormUnit]   = useState("km");
  const [formDesc,   setFormDesc]   = useState("");
  const [formEnd,    setFormEnd]    = useState("");
  const [saving,     setSaving]     = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [{ data: cData }, { data: myParts }] = await Promise.all([
      supabase.from("challenges")
        .select("id, title, description, goal_type, target_value, unit, end_date, created_by")
        .eq("is_public", true)
        .order("created_at", { ascending: false }),
      supabase.from("challenge_participants")
        .select("challenge_id, current_value")
        .eq("user_id", user.id),
    ]);

    const myMap: Record<string, number> = {};
    for (const p of myParts ?? []) myMap[p.challenge_id] = p.current_value;

    // Get participant counts in parallel
    const enriched = await Promise.all(
      (cData ?? []).map(async (ch: any) => {
        const { count } = await supabase
          .from("challenge_participants")
          .select("id", { count: "exact", head: true })
          .eq("challenge_id", ch.id);
        return {
          ...ch,
          participant_count: count ?? 0,
          my_value:          ch.id in myMap ? myMap[ch.id] : null,
          joined:            ch.id in myMap,
        } as Challenge;
      }),
    );

    setChallenges(enriched);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Detail ────────────────────────────────────────────────────────────────

  async function openDetail(ch: Challenge) {
    setSelected(ch);
    setProgressInput(ch.my_value?.toString() ?? "");
    const { data } = await supabase
      .from("challenge_participants")
      .select("current_value, user_id, users(username, avatar_url)")
      .eq("challenge_id", ch.id)
      .order("current_value", { ascending: false })
      .limit(10);
    setLeaderboard(
      (data ?? []).map((r: any) => ({
        user_id:       r.user_id,
        username:      r.users?.username ?? "?",
        avatar_url:    r.users?.avatar_url ?? null,
        current_value: r.current_value,
      })),
    );
  }

  async function joinChallenge(challengeId: string) {
    if (!userId) return;
    await supabase.from("challenge_participants")
      .insert({ challenge_id: challengeId, user_id: userId, current_value: 0 });
    await load();
    if (selected?.id === challengeId) {
      setSelected((prev) => prev ? { ...prev, joined: true, my_value: 0 } : null);
      setProgressInput("0");
      openDetail({ ...selected!, joined: true, my_value: 0 });
    }
  }

  async function updateProgress() {
    if (!userId || !selected) return;
    setSavingProg(true);
    const val = parseFloat(progressInput) || 0;
    await supabase.from("challenge_participants")
      .update({ current_value: val })
      .eq("challenge_id", selected.id)
      .eq("user_id", userId);
    setSavingProg(false);
    const updated = { ...selected, my_value: val };
    setSelected(updated);
    openDetail(updated);
    await load();
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async function createChallenge() {
    if (!userId || !formTitle.trim()) return;
    setSaving(true);
    const unit = formUnit || typeInfo(formType).unit;
    const { data, error } = await supabase.from("challenges").insert({
      title:        formTitle.trim(),
      description:  formDesc.trim() || null,
      goal_type:    formType,
      target_value: parseFloat(formTarget) || null,
      unit:         unit || null,
      end_date:     formEnd || null,
      created_by:   userId,
      is_public:    true,
    }).select().single();

    if (error) { Alert.alert("Error", error.message); setSaving(false); return; }
    if (data) {
      await supabase.from("challenge_participants")
        .insert({ challenge_id: data.id, user_id: userId, current_value: 0 });
    }
    setSaving(false);
    resetCreate();
    await load();
  }

  function resetCreate() {
    setShowCreate(false);
    setFormTitle(""); setFormType("running"); setFormTarget("");
    setFormUnit("km"); setFormDesc(""); setFormEnd("");
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const renderChallenge = ({ item: ch, index }: { item: Challenge; index: number }) => {
    const info = typeInfo(ch.goal_type);
    const days = daysLeft(ch.end_date);
    const pct = ch.target_value && ch.my_value != null
      ? Math.min((ch.my_value / ch.target_value) * 100, 100)
      : null;

    return (
      <TouchableOpacity
        style={[s.card, { backgroundColor: c.bgCard, borderColor: ch.joined ? "#FF450033" : c.border }]}
        onPress={() => openDetail(ch)}
        activeOpacity={0.8}
      >
        <View style={s.cardTop}>
          <Text style={s.cardEmoji}>{info.emoji}</Text>
          <View style={s.cardMeta}>
            <Text style={[s.cardTitle, { color: c.text }]} numberOfLines={1}>{ch.title}</Text>
            <Text style={[s.cardSub, { color: c.textMuted }]}>
              {info.label} · {ch.participant_count} joined
            </Text>
          </View>
          <View style={s.cardRight}>
            {ch.joined && (
              <View style={[s.joinedBadge, { backgroundColor: "#FF450020" }]}>
                <Text style={[s.joinedBadgeText, { color: "#FF4500" }]}>Joined</Text>
              </View>
            )}
            {days !== null && (
              <Text style={[s.daysLeft, { color: days === 0 ? "#ef4444" : c.textMuted }]}>
                {days === 0 ? "Ended" : `${days}d left`}
              </Text>
            )}
          </View>
        </View>

        {/* Progress bar (if joined) */}
        {ch.joined && ch.target_value != null && pct !== null && (
          <View style={s.progressWrap}>
            <View style={[s.progressTrack, { backgroundColor: c.border }]}>
              <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: "#FF4500" }]} />
            </View>
            <Text style={[s.progressLabel, { color: c.textMuted }]}>
              {ch.my_value ?? 0} / {ch.target_value} {ch.unit}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: c.bg }]}>
        <ActivityIndicator color="#FF4500" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <Text style={[s.headerTitle, { color: c.text }]}>Challenges 🏆</Text>
        <TouchableOpacity
          style={[s.createBtn, { backgroundColor: "#FF4500" }]}
          onPress={() => setShowCreate(true)}
          activeOpacity={0.85}
        >
          <Text style={s.createBtnText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={challenges}
        keyExtractor={(ch) => ch.id}
        renderItem={renderChallenge}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor="#FF4500"
          />
        }
        ListEmptyComponent={
          <EmptyState
            emoji="🏆"
            title="No challenges yet"
            subtitle="Create the first challenge and invite your training partners!"
          />
        }
      />

      {/* ── Detail Modal ──────────────────────────────────────────────── */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <SafeAreaView style={[s.modal, { backgroundColor: c.bg }]}>
            <View style={[s.modalHeader, { borderBottomColor: c.border }]}>
              <TouchableOpacity onPress={() => setSelected(null)} style={s.closeBtn}>
                <Text style={[s.closeBtnText, { color: c.textMuted }]}>✕</Text>
              </TouchableOpacity>
              <Text style={[s.modalTitle, { color: c.text }]} numberOfLines={1}>{selected.title}</Text>
              <View style={{ width: 32 }} />
            </View>

            <ScrollView contentContainerStyle={s.modalScroll}>
              {/* Info row */}
              <View style={s.detailRow}>
                <Text style={s.detailEmoji}>{typeInfo(selected.goal_type).emoji}</Text>
                <View>
                  <Text style={[s.detailType, { color: c.text }]}>{typeInfo(selected.goal_type).label}</Text>
                  {selected.target_value && (
                    <Text style={[s.detailTarget, { color: c.textMuted }]}>
                      Target: {selected.target_value} {selected.unit}
                    </Text>
                  )}
                  {selected.end_date && (
                    <Text style={[s.detailTarget, { color: c.textMuted }]}>
                      Ends: {selected.end_date}
                    </Text>
                  )}
                </View>
              </View>

              {selected.description ? (
                <Text style={[s.detailDesc, { color: c.textSecondary, borderColor: c.border }]}>
                  {selected.description}
                </Text>
              ) : null}

              {/* Join / Progress update */}
              {!selected.joined ? (
                <TouchableOpacity
                  style={[s.joinBtn, { backgroundColor: "#FF4500" }]}
                  onPress={() => joinChallenge(selected.id)}
                  activeOpacity={0.85}
                >
                  <Text style={s.joinBtnText}>Join Challenge</Text>
                </TouchableOpacity>
              ) : (
                <View style={[s.progressCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
                  <Text style={[s.progressCardTitle, { color: c.text }]}>Update My Progress</Text>
                  <View style={s.progressInputRow}>
                    <TextInput
                      style={[s.progressInput, { color: c.text, backgroundColor: c.bgInput, borderColor: c.border }]}
                      value={progressInput}
                      onChangeText={setProgressInput}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={c.textFaint}
                    />
                    <Text style={[s.progressUnit, { color: c.textMuted }]}>{selected.unit}</Text>
                    <TouchableOpacity
                      style={[s.saveBtn, { backgroundColor: "#FF4500" }]}
                      onPress={updateProgress}
                      disabled={savingProg}
                      activeOpacity={0.85}
                    >
                      {savingProg
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={s.saveBtnText}>Save</Text>
                      }
                    </TouchableOpacity>
                  </View>
                  {selected.target_value != null && (
                    <View style={[s.progressTrack, { backgroundColor: c.border, marginTop: SPACE[12] }]}>
                      <View style={[
                        s.progressFill,
                        { width: `${Math.min(((selected.my_value ?? 0) / selected.target_value) * 100, 100)}%` as any, backgroundColor: "#FF4500" },
                      ]} />
                    </View>
                  )}
                </View>
              )}

              {/* Leaderboard */}
              <Text style={[s.lbTitle, { color: c.text }]}>Leaderboard</Text>
              {leaderboard.map((entry, i) => (
                <View key={entry.user_id} style={[s.lbRow, { borderColor: c.border }]}>
                  <Text style={[s.lbRank, { color: i < 3 ? "#FF4500" : c.textMuted }]}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </Text>
                  <Avatar url={entry.avatar_url} name={entry.username} size={32} />
                  <Text style={[s.lbName, { color: c.text }]} numberOfLines={1}>{entry.username}</Text>
                  <Text style={[s.lbValue, { color: c.textSecondary }]}>
                    {entry.current_value} {selected.unit}
                  </Text>
                </View>
              ))}
              {leaderboard.length === 0 && (
                <Text style={[s.lbEmpty, { color: c.textFaint }]}>No participants yet</Text>
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {/* ── Create Modal ──────────────────────────────────────────────── */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetCreate}>
        <SafeAreaView style={[s.modal, { backgroundColor: c.bg }]}>
          <View style={[s.modalHeader, { borderBottomColor: c.border }]}>
            <TouchableOpacity onPress={resetCreate} style={s.closeBtn}>
              <Text style={[s.closeBtnText, { color: c.textMuted }]}>✕</Text>
            </TouchableOpacity>
            <Text style={[s.modalTitle, { color: c.text }]}>New Challenge</Text>
            <View style={{ width: 32 }} />
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">

              {/* Title */}
              <Text style={[s.formLabel, { color: c.textMuted }]}>Challenge Title *</Text>
              <TextInput
                style={[s.formInput, { color: c.text, backgroundColor: c.bgInput, borderColor: c.border }]}
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder="e.g. Run 50km in December"
                placeholderTextColor={c.textFaint}
              />

              {/* Type */}
              <Text style={[s.formLabel, { color: c.textMuted }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.typeRow}>
                {GOAL_TYPES.map((gt) => (
                  <TouchableOpacity
                    key={gt.key}
                    style={[s.typeChip, {
                      backgroundColor: formType === gt.key ? "#FF450020" : c.bgCard,
                      borderColor:     formType === gt.key ? "#FF4500"   : c.border,
                    }]}
                    onPress={() => { setFormType(gt.key); setFormUnit(gt.unit); }}
                    activeOpacity={0.8}
                  >
                    <Text style={s.typeEmoji}>{gt.emoji}</Text>
                    <Text style={[s.typeLabel, { color: formType === gt.key ? "#FF4500" : c.textSecondary }]}>
                      {gt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Target + Unit */}
              <Text style={[s.formLabel, { color: c.textMuted }]}>Target (optional)</Text>
              <View style={s.targetRow}>
                <TextInput
                  style={[s.formInput, { flex: 1, color: c.text, backgroundColor: c.bgInput, borderColor: c.border }]}
                  value={formTarget}
                  onChangeText={setFormTarget}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 50"
                  placeholderTextColor={c.textFaint}
                />
                <TextInput
                  style={[s.formInput, { width: 80, color: c.text, backgroundColor: c.bgInput, borderColor: c.border }]}
                  value={formUnit}
                  onChangeText={setFormUnit}
                  placeholder="unit"
                  placeholderTextColor={c.textFaint}
                />
              </View>

              {/* End date */}
              <Text style={[s.formLabel, { color: c.textMuted }]}>End Date (optional)</Text>
              <TextInput
                style={[s.formInput, { color: c.text, backgroundColor: c.bgInput, borderColor: c.border }]}
                value={formEnd}
                onChangeText={setFormEnd}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={c.textFaint}
              />

              {/* Description */}
              <Text style={[s.formLabel, { color: c.textMuted }]}>Description (optional)</Text>
              <TextInput
                style={[s.formInput, { color: c.text, backgroundColor: c.bgInput, borderColor: c.border, height: 80, textAlignVertical: "top", paddingTop: 12 }]}
                value={formDesc}
                onChangeText={setFormDesc}
                placeholder="What's this challenge about?"
                placeholderTextColor={c.textFaint}
                multiline
                maxLength={200}
              />

              <TouchableOpacity
                style={[s.createSubmitBtn, { backgroundColor: "#FF4500", opacity: formTitle.trim() ? 1 : 0.4 }]}
                onPress={createChallenge}
                disabled={!formTitle.trim() || saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.createSubmitText}>Create Challenge 🏆</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:        { flex: 1 },
  header:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: SPACE[20], paddingVertical: SPACE[14], borderBottomWidth: 1 },
  headerTitle:      { fontSize: FONT.size["2xl"], fontWeight: FONT.weight.black },
  createBtn:        { borderRadius: RADIUS.md, paddingHorizontal: SPACE[16], paddingVertical: SPACE[8] },
  createBtnText:    { color: "#fff", fontWeight: FONT.weight.bold, fontSize: FONT.size.sm },
  list:             { padding: SPACE[16], gap: SPACE[12], paddingBottom: 80 },

  card:             { borderRadius: RADIUS.xl, padding: SPACE[16], borderWidth: 1, gap: SPACE[10] },
  cardTop:          { flexDirection: "row", alignItems: "center", gap: SPACE[12] },
  cardEmoji:        { fontSize: 28, width: 36, textAlign: "center" },
  cardMeta:         { flex: 1, gap: 2 },
  cardTitle:        { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  cardSub:          { fontSize: FONT.size.xs },
  cardRight:        { alignItems: "flex-end", gap: 4 },
  joinedBadge:      { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[8], paddingVertical: 2 },
  joinedBadgeText:  { fontSize: 10, fontWeight: FONT.weight.bold },
  daysLeft:         { fontSize: 11, fontWeight: FONT.weight.semibold },

  progressWrap:     { gap: SPACE[6] },
  progressTrack:    { height: 6, borderRadius: 4, overflow: "hidden" },
  progressFill:     { height: 6, borderRadius: 4 },
  progressLabel:    { fontSize: FONT.size.xs },

  // Modal
  modal:            { flex: 1 },
  modalHeader:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACE[20], paddingVertical: SPACE[14], borderBottomWidth: 1 },
  modalTitle:       { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold, flex: 1, textAlign: "center" },
  closeBtn:         { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  closeBtnText:     { fontSize: 18 },
  modalScroll:      { padding: SPACE[20], gap: SPACE[16], paddingBottom: 60 },

  // Detail
  detailRow:        { flexDirection: "row", alignItems: "center", gap: SPACE[14] },
  detailEmoji:      { fontSize: 40 },
  detailType:       { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold },
  detailTarget:     { fontSize: FONT.size.sm, marginTop: 2 },
  detailDesc:       { fontSize: FONT.size.sm, lineHeight: 20, paddingVertical: SPACE[12], paddingHorizontal: SPACE[16], borderRadius: RADIUS.lg, borderWidth: 1 },

  joinBtn:          { borderRadius: RADIUS.xl, paddingVertical: SPACE[16], alignItems: "center" },
  joinBtnText:      { color: "#fff", fontWeight: FONT.weight.black, fontSize: FONT.size.base },

  progressCard:     { borderRadius: RADIUS.xl, padding: SPACE[16], borderWidth: 1, gap: SPACE[10] },
  progressCardTitle:{ fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  progressInputRow: { flexDirection: "row", alignItems: "center", gap: SPACE[10] },
  progressInput:    { borderRadius: RADIUS.md, paddingHorizontal: SPACE[14], paddingVertical: SPACE[10], borderWidth: 1, fontSize: FONT.size.base, flex: 1 },
  progressUnit:     { fontSize: FONT.size.sm, minWidth: 30 },
  saveBtn:          { borderRadius: RADIUS.md, paddingHorizontal: SPACE[16], paddingVertical: SPACE[10] },
  saveBtnText:      { color: "#fff", fontWeight: FONT.weight.bold, fontSize: FONT.size.sm },

  lbTitle:          { fontSize: FONT.size.base, fontWeight: FONT.weight.bold, marginTop: SPACE[8] },
  lbRow:            { flexDirection: "row", alignItems: "center", gap: SPACE[10], paddingVertical: SPACE[10], borderBottomWidth: 1 },
  lbRank:           { fontSize: 18, width: 32, textAlign: "center" },
  lbName:           { flex: 1, fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  lbValue:          { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  lbEmpty:          { textAlign: "center", paddingVertical: SPACE[20], fontSize: FONT.size.sm },

  // Create form
  formLabel:        { fontSize: 11, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 0.8 },
  formInput:        { borderRadius: RADIUS.md, paddingHorizontal: SPACE[14], paddingVertical: SPACE[12], borderWidth: 1, fontSize: FONT.size.base },
  typeRow:          { marginBottom: SPACE[4] },
  typeChip:         { flexDirection: "row", alignItems: "center", gap: SPACE[6], borderRadius: RADIUS.md, paddingHorizontal: SPACE[12], paddingVertical: SPACE[8], borderWidth: 1, marginRight: SPACE[8] },
  typeEmoji:        { fontSize: 18 },
  typeLabel:        { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  targetRow:        { flexDirection: "row", gap: SPACE[10] },
  createSubmitBtn:  { borderRadius: RADIUS.xl, paddingVertical: SPACE[16], alignItems: "center", marginTop: SPACE[8] },
  createSubmitText: { color: "#fff", fontWeight: FONT.weight.black, fontSize: FONT.size.base },
});
