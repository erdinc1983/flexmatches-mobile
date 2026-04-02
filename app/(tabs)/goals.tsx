import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, TextInput, Modal, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { ErrorState } from "../../components/ui/ErrorState";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../../lib/theme";
import { Icon } from "../../components/Icon";
import { CalendarPicker } from "../../components/CalendarPicker";

type Goal = {
  id: string;
  title: string;
  goal_type: string;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  deadline: string | null;
  completed: boolean;
  created_at: string;
};

const GOAL_TYPES = [
  { key: "workout_frequency", label: "Workout Frequency", emoji: "💪", unit: "days/week" },
  { key: "weight_loss",       label: "Weight Loss",       emoji: "⚖️", unit: "kg" },
  { key: "distance",          label: "Distance",          emoji: "🏃", unit: "km" },
  { key: "streak",            label: "Streak",            emoji: "🔥", unit: "days" },
  { key: "strength",          label: "Strength",          emoji: "🏋️", unit: "kg" },
  { key: "custom",            label: "Custom",            emoji: "🎯", unit: "" },
];

export default function GoalsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    goal_type: "workout_frequency",
    target_value: "",
    unit: "days/week",
    deadline: "",
  });

  const load = useCallback(async (isRefresh = false) => {
    try {
      setError(false);
      if (!isRefresh) setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data } = await supabase
        .from("goals")
        .select("id, title, goal_type, target_value, current_value, unit, deadline, completed, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setGoals(data ?? []);
    } catch (err) {
      console.error("[Goals] load failed:", err);
      if (isRefresh) {
        Alert.alert("Error", "Could not refresh. Please try again.");
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => { setLoading(false); setError(true); }, 15_000);
    return () => clearTimeout(t);
  }, [loading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  async function createGoal() {
    if (!form.title.trim() || !userId) return;
    setSaving(true);

    const typeInfo = GOAL_TYPES.find(t => t.key === form.goal_type);
    const { error } = await supabase.from("goals").insert({
      user_id: userId,
      title: form.title.trim(),
      goal_type: form.goal_type,
      target_value: form.target_value ? parseFloat(form.target_value) : null,
      current_value: 0,
      unit: form.unit || typeInfo?.unit || null,
      deadline: form.deadline || null,
      completed: false,
    });

    setSaving(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setModalVisible(false);
    setForm({ title: "", goal_type: "workout_frequency", target_value: "", unit: "days/week", deadline: "" });
    await load();
  }

  async function updateProgress(goal: Goal, newValue: number) {
    const completed = goal.target_value != null && newValue >= goal.target_value;
    await supabase.from("goals").update({ current_value: newValue, completed }).eq("id", goal.id);
    setGoals(gs => gs.map(g => g.id === goal.id ? { ...g, current_value: newValue, completed } : g));

    if (completed && !goal.completed && userId) {
      await supabase.from("feed_posts").insert({
        user_id: userId,
        post_type: "goal",
        content: `Just hit my goal: ${goal.title} 🎯`,
        meta: { goal_id: goal.id, goal_type: goal.goal_type },
      });
    }
  }

  async function deleteGoal(id: string) {
    Alert.alert("Delete Goal", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await supabase.from("goals").delete().eq("id", id);
        setGoals(gs => gs.filter(g => g.id !== id));
      }},
    ]);
  }

  function getProgress(goal: Goal): number {
    if (!goal.target_value) return 0;
    return Math.min(goal.current_value / goal.target_value, 1);
  }

  function getDaysLeft(deadline: string): string {
    const ms = new Date(deadline).getTime();
    if (isNaN(ms)) return "";
    const days = Math.ceil((ms - Date.now()) / 86400000);
    if (days < 0) return "overdue";
    if (days === 0) return "today";
    return `${days}d left`;
  }

  if (loading) return (
    <SafeAreaView style={[s.flex, { backgroundColor: c.bg }]}>
      <ActivityIndicator color={c.brand} size="large" style={{ flex: 1 }} />
    </SafeAreaView>
  );

  if (error) return (
    <SafeAreaView style={[s.flex, { backgroundColor: c.bg }]}>
      <ErrorState onRetry={load} message="Could not load your goals." />
    </SafeAreaView>
  );

  const active = goals.filter(g => !g.completed);
  const completed = goals.filter(g => g.completed);

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: c.bg }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: c.text }]}>Goals</Text>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: c.brand }]}
          onPress={() => setModalVisible(true)}
        >
          <Icon name="add" size={16} color="#fff" />
          <Text style={s.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {goals.length === 0 ? (
        <View style={s.empty}>
          <Icon name="goal" size={60} color={c.textMuted} />
          <Text style={[s.emptyTitle, { color: c.text }]}>No goals yet</Text>
          <Text style={[s.emptyText, { color: c.textMuted }]}>Set a fitness goal and track your progress</Text>
          <TouchableOpacity
            style={[s.startBtn, { backgroundColor: c.brand }]}
            onPress={() => setModalVisible(true)}
          >
            <Text style={s.startBtnText}>Set First Goal</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={[...active, ...completed]}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: SPACE[16], paddingBottom: SPACE[40] }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} />}
          ListHeaderComponent={active.length > 0 && completed.length > 0 ? (
            <Text style={[s.sectionLabel, { color: c.textMuted }]}>Active · {active.length}</Text>
          ) : null}
          renderItem={({ item, index }) => {
            const showCompletedHeader = item.completed && (index === 0 || !goals[index - 1]?.completed);
            const progress = getProgress(item);
            const typeInfo = GOAL_TYPES.find(t => t.key === item.goal_type);
            const progressColor = item.completed ? PALETTE.success : c.brand;
            const daysLeft = item.deadline ? getDaysLeft(item.deadline) : null;

            return (
              <>
                {showCompletedHeader && (
                  <Text style={[s.sectionLabel, { color: c.textMuted, marginTop: SPACE[24] }]}>
                    Completed · {completed.length}
                  </Text>
                )}
                <View style={[
                  s.goalCard,
                  { backgroundColor: c.bgCard, borderColor: c.border },
                  item.completed && { opacity: 0.6 },
                ]}>
                  <View style={s.goalTop}>
                    <Text style={s.goalEmoji}>{typeInfo?.emoji ?? "🎯"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.goalTitle, { color: item.completed ? c.textMuted : c.text }]}>
                        {item.completed ? "✅ " : ""}{item.title}
                      </Text>
                      {item.deadline && (
                        <View style={s.deadlineRow}>
                          <Icon name="calendar" size={11} color={daysLeft === "overdue" ? PALETTE.error : c.textMuted} />
                          <Text style={[s.goalDeadline, { color: daysLeft === "overdue" ? PALETTE.error : c.textMuted }]}>
                            {daysLeft}
                          </Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => deleteGoal(item.id)} style={s.deleteBtn}>
                      <Icon name="trash" size={16} color={c.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {item.target_value != null && (
                    <>
                      <View style={s.progressRow}>
                        <Text style={[s.progressText, { color: c.textMuted }]}>
                          {item.current_value} / {item.target_value} {item.unit}
                        </Text>
                        <Text style={[s.progressPct, { color: progressColor }]}>
                          {Math.round(progress * 100)}%
                        </Text>
                      </View>
                      <View style={[s.progressBar, { backgroundColor: c.border }]}>
                        <View style={[s.progressFill, {
                          width: `${progress * 100}%` as any,
                          backgroundColor: progressColor,
                        }]} />
                      </View>

                      {!item.completed && (
                        <View style={s.updateRow}>
                          <TouchableOpacity
                            style={[s.stepBtn, { backgroundColor: c.bgCardAlt }]}
                            onPress={() => updateProgress(item, Math.max(0, item.current_value - 1))}
                          >
                            <Text style={[s.stepBtnText, { color: c.textMuted }]}>−</Text>
                          </TouchableOpacity>
                          <Text style={[s.currentVal, { color: c.text }]}>{item.current_value}</Text>
                          <TouchableOpacity
                            style={[s.stepBtn, { backgroundColor: c.brandSubtle, borderWidth: 1, borderColor: c.brandBorder }]}
                            onPress={() => updateProgress(item, item.current_value + 1)}
                          >
                            <Text style={[s.stepBtnText, { color: c.brand }]}>+</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}
                </View>
              </>
            );
          }}
        />
      )}

      {/* New Goal Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[s.flex, { backgroundColor: c.bg }]}>
          <View style={[s.modalHeader, { borderBottomColor: c.border }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>New Goal</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={s.closeBtn}>
              <Icon name="close" size={22} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={[]}
            renderItem={null}
            ListHeaderComponent={
              <View style={{ gap: SPACE[16], padding: SPACE[4] }}>
                <View>
                  <Text style={[s.fieldLabel, { color: c.textMuted }]}>Goal Type</Text>
                  <View style={s.typesGrid}>
                    {GOAL_TYPES.map(t => (
                      <TouchableOpacity
                        key={t.key}
                        style={[
                          s.typeChip,
                          { backgroundColor: c.bgCard, borderColor: c.border },
                          form.goal_type === t.key && { backgroundColor: c.brandSubtle, borderColor: c.brand },
                        ]}
                        onPress={() => setForm({ ...form, goal_type: t.key, unit: t.unit })}
                      >
                        <Text style={s.typeEmoji}>{t.emoji}</Text>
                        <Text style={[s.typeLabel, { color: form.goal_type === t.key ? c.brand : c.textMuted }]}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View>
                  <Text style={[s.fieldLabel, { color: c.textMuted }]}>Title</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text }]}
                    value={form.title}
                    onChangeText={v => setForm({ ...form, title: v })}
                    placeholder="e.g. Work out 4x per week"
                    placeholderTextColor={c.textFaint}
                  />
                </View>

                <View style={{ flexDirection: "row", gap: SPACE[12] }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.fieldLabel, { color: c.textMuted }]}>Target</Text>
                    <TextInput
                      style={[s.input, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text }]}
                      value={form.target_value}
                      onChangeText={v => setForm({ ...form, target_value: v })}
                      keyboardType="numeric"
                      placeholder="e.g. 4"
                      placeholderTextColor={c.textFaint}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.fieldLabel, { color: c.textMuted }]}>Unit</Text>
                    <TextInput
                      style={[s.input, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text }]}
                      value={form.unit}
                      onChangeText={v => setForm({ ...form, unit: v })}
                      placeholder="days/week"
                      placeholderTextColor={c.textFaint}
                    />
                  </View>
                </View>

                <View>
                  <Text style={[s.fieldLabel, { color: c.textMuted }]}>Deadline (optional)</Text>
                  <CalendarPicker
                    value={form.deadline}
                    onChange={v => setForm({ ...form, deadline: v })}
                    colors={c}
                  />
                </View>

                <TouchableOpacity
                  style={[s.saveBtn, { backgroundColor: c.brand }, (saving || !form.title.trim()) && { opacity: 0.5 }]}
                  onPress={createGoal}
                  disabled={saving || !form.title.trim()}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <View style={s.saveBtnInner}>
                      <Icon name="goalActive" size={18} color="#fff" />
                      <Text style={s.saveBtnText}>Create Goal</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            }
            contentContainerStyle={{ padding: SPACE[20] }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: SPACE[20], paddingTop: SPACE[12], paddingBottom: SPACE[8] },
  title: { fontSize: FONT.size.xxxl, fontWeight: FONT.weight.black, letterSpacing: -0.5 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: SPACE[4], borderRadius: RADIUS.pill, paddingHorizontal: SPACE[16], paddingVertical: SPACE[8] },
  addBtnText: { color: "#fff", fontWeight: FONT.weight.extrabold, fontSize: FONT.size.sm },
  sectionLabel: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: SPACE[10] },
  goalCard: { borderRadius: 18, padding: SPACE[16], marginBottom: SPACE[12], borderWidth: 1, gap: SPACE[10] },
  goalTop: { flexDirection: "row", alignItems: "flex-start", gap: SPACE[12] },
  goalEmoji: { fontSize: 26, marginTop: 2 },
  goalTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold, lineHeight: 22 },
  deadlineRow: { flexDirection: "row", alignItems: "center", gap: SPACE[4], marginTop: SPACE[4] },
  goalDeadline: { fontSize: FONT.size.xs },
  deleteBtn: { padding: SPACE[4] },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressText: { fontSize: FONT.size.sm },
  progressPct: { fontSize: FONT.size.sm, fontWeight: FONT.weight.extrabold },
  progressBar: { height: 6, borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3 },
  updateRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE[20], marginTop: SPACE[4] },
  stepBtn: { width: 36, height: 36, borderRadius: SPACE[10], alignItems: "center", justifyContent: "center" },
  stepBtnText: { fontSize: 20, fontWeight: FONT.weight.bold },
  currentVal: { fontSize: 22, fontWeight: FONT.weight.black, minWidth: 40, textAlign: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE[12], paddingHorizontal: SPACE[32] },
  emptyTitle: { fontSize: 22, fontWeight: FONT.weight.extrabold },
  emptyText: { fontSize: FONT.size.base, textAlign: "center" },
  startBtn: { borderRadius: RADIUS.md, paddingHorizontal: SPACE[32], paddingVertical: SPACE[14], marginTop: SPACE[8] },
  startBtnText: { color: "#fff", fontWeight: FONT.weight.bold, fontSize: FONT.size.lg },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: SPACE[20], paddingVertical: SPACE[16], borderBottomWidth: 1 },
  modalTitle: { fontSize: FONT.size.xl, fontWeight: FONT.weight.black },
  closeBtn: { padding: SPACE[4] },
  fieldLabel: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: SPACE[8] },
  typesGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE[8] },
  typeChip: { flexDirection: "row", alignItems: "center", gap: SPACE[6], borderRadius: RADIUS.md, paddingHorizontal: SPACE[12], paddingVertical: SPACE[8], borderWidth: 1 },
  typeEmoji: { fontSize: 16 },
  typeLabel: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
  input: { borderRadius: RADIUS.md, paddingHorizontal: SPACE[16], paddingVertical: SPACE[14], fontSize: FONT.size.md, borderWidth: 1.5 },
  saveBtn: { borderRadius: RADIUS.lg, paddingVertical: 18, alignItems: "center" },
  saveBtnInner: { flexDirection: "row", alignItems: "center", gap: SPACE[8] },
  saveBtnText: { color: "#fff", fontWeight: FONT.weight.extrabold, fontSize: FONT.size.lg },
});
