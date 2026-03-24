/**
 * Profile Screen
 *
 * Displays the current user's fitness profile.
 * View mode: bio, info chips, 2×2 stats grid, consistency score, sports.
 * Edit mode: text fields, fitness level picker, sports picker.
 * Full light/dark theme support via design system.
 */

import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../lib/supabase";
import { useTheme, SPACE, FONT, RADIUS, PALETTE, BRAND } from "../../lib/theme";
import { Icon } from "../../components/Icon";
import { Avatar } from "../../components/Avatar";

// ─── Constants ────────────────────────────────────────────────────────────────
const FITNESS_LEVELS = ["beginner", "intermediate", "advanced"] as const;

const LEVEL_COLOR: Record<string, string> = {
  beginner:     PALETTE.success,
  intermediate: PALETTE.warning,
  advanced:     BRAND.primary,
};

const SPORTS_OPTIONS = [
  "Running", "Cycling", "Swimming", "Weightlifting", "CrossFit",
  "Yoga", "Boxing", "Tennis", "Basketball", "Football",
  "Hiking", "Climbing", "Martial Arts", "Gymnastics",
  "Soccer", "Volleyball", "Rowing", "Pilates",
];

// ─── Types ────────────────────────────────────────────────────────────────────
type Profile = {
  username:       string;
  full_name:      string | null;
  bio:            string | null;
  city:           string | null;
  gym_name:       string | null;
  fitness_level:  "beginner" | "intermediate" | "advanced" | null;
  age:            number | null;
  gender:         string | null;
  occupation:     string | null;
  availability:   Record<string, boolean> | null;
  sports:         string[] | null;
  avatar_url:     string | null;
  current_streak: number;
  longest_streak: number;
  total_workouts: number;
  match_count:    number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcConsistencyScore(p: Profile, workoutsThisMonth: number): number {
  let score = 0;
  score += Math.min(workoutsThisMonth / 15, 1) * 40;          // activity: 40pts
  score += Math.min((p.current_streak ?? 0) / 30, 1) * 30;    // streak: 30pts
  const fields = [p.avatar_url, p.full_name, p.bio, p.city, p.fitness_level, p.age, (p.sports ?? []).length > 0];
  score += (fields.filter(Boolean).length / fields.length) * 30; // completeness: 30pts
  return Math.round(score);
}

function getBestTime(av: Record<string, boolean> | null | undefined): string {
  if (!av) return "Not set";
  const labels = [av.morning && "Morning", av.afternoon && "Afternoon", av.evening && "Evening"].filter(Boolean) as string[];
  return labels.length > 0 ? labels.join(", ") : "Not set";
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [profile,         setProfile]         = useState<Profile | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [editing,         setEditing]         = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [uploadingPhoto,  setUploadingPhoto]  = useState(false);
  const [form,            setForm]            = useState<Profile | null>(null);
  const [refreshing,      setRefreshing]      = useState(false);
  const [userId,          setUserId]          = useState<string | null>(null);
  const [workoutsThisMonth, setWorkoutsThisMonth] = useState(0);

  // ── Data ────────────────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data }, { count: totalWorkouts }, { count: matchCount }, { count: monthlyWorkouts }] = await Promise.all([
      supabase.from("users")
        .select("username, full_name, bio, city, gym_name, fitness_level, age, gender, occupation, availability, sports, avatar_url, current_streak, longest_streak")
        .eq("id", user.id)
        .single(),
      supabase.from("workouts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("matches").select("*", { count: "exact", head: true }).eq("status", "accepted")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
      supabase.from("workouts").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("logged_at", monthAgo),
    ]);

    if (data) {
      const full: Profile = {
        ...data,
        sports:         data.sports ?? [],
        avatar_url:     data.avatar_url ?? null,
        current_streak: data.current_streak ?? 0,
        longest_streak: data.longest_streak ?? 0,
        total_workouts: totalWorkouts ?? 0,
        match_count:    matchCount ?? 0,
      };
      setProfile(full);
      setForm(full);
      setWorkoutsThisMonth(monthlyWorkouts ?? 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  }, [fetchProfile]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function saveProfile() {
    if (!form || !userId) return;
    setSaving(true);
    const { error } = await supabase.from("users").update({
      full_name:     form.full_name,
      bio:           form.bio,
      city:          form.city,
      gym_name:      form.gym_name,
      fitness_level: form.fitness_level,
      age:           form.age,
      sports:        form.sports,
      occupation:    form.occupation,
    }).eq("id", userId);
    setSaving(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setProfile(form);
    setEditing(false);
  }

  function toggleSport(sport: string) {
    if (!form) return;
    const sports = form.sports ?? [];
    setForm({ ...form, sports: sports.includes(sport) ? sports.filter((s) => s !== sport) : [...sports, sport] });
  }

  async function pickAndUploadPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Please allow photo access in Settings."); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const ext = asset.uri.split(".").pop() ?? "jpg";
      const fileName = `${userId}-${Date.now()}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: true });

      if (uploadError) { Alert.alert("Upload failed", uploadError.message); return; }

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(fileName);
      await supabase.from("users").update({ avatar_url: publicUrl }).eq("id", userId!);
      setProfile((p) => p ? { ...p, avatar_url: publicUrl } : p);
      setForm((f) => f ? { ...f, avatar_url: publicUrl } : f);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.brand} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const levelColor = profile?.fitness_level ? LEVEL_COLOR[profile.fitness_level] : c.textMuted;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} />}
      >
        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <View style={s.hero}>
          {/* Notification bell */}
          <TouchableOpacity
            style={s.bellBtn}
            onPress={() => router.push("/notifications")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="notification" size={22} color={c.textMuted} />
          </TouchableOpacity>

          {/* Avatar + camera */}
          <TouchableOpacity style={s.avatarWrap} onPress={pickAndUploadPhoto} activeOpacity={0.8}>
            <Avatar url={profile?.avatar_url} name={profile?.username ?? "?"} size={96} />
            <View style={[s.cameraBtn, { backgroundColor: c.brand, borderColor: c.bg }]}>
              {uploadingPhoto
                ? <ActivityIndicator color="#fff" size="small" />
                : <Icon name="camera" size={14} color="#fff" />
              }
            </View>
            {profile?.fitness_level && (
              <View style={[s.levelDot, { backgroundColor: levelColor, borderColor: c.bg }]} />
            )}
          </TouchableOpacity>

          <Text style={[s.name, { color: c.text }]}>{profile?.full_name ?? `@${profile?.username}`}</Text>
          <Text style={[s.username, { color: c.textMuted }]}>@{profile?.username}</Text>

          {profile?.fitness_level && (
            <View style={[s.levelBadge, { borderColor: levelColor + "44", backgroundColor: levelColor + "14" }]}>
              <Text style={[s.levelBadgeText, { color: levelColor }]}>
                {profile.fitness_level.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* ── Stats ───────────────────────────────────────────────────────── */}
        <View style={s.statsRow}>
          <StatPill icon="streakActive" value={profile?.current_streak ?? 0} label="streak" color={c.brand} bg={c.bgCard} border={c.border} textColor={c.text} mutedColor={c.textMuted} />
          <StatPill icon="workout"      value={profile?.total_workouts ?? 0}  label="workouts" color={c.brand} bg={c.bgCard} border={c.border} textColor={c.text} mutedColor={c.textMuted} />
          <StatPill icon="matchActive"  value={profile?.match_count ?? 0}     label="matches" color={c.brand} bg={c.bgCard} border={c.border} textColor={c.text} mutedColor={c.textMuted} />
        </View>

        {/* ── Edit or View ────────────────────────────────────────────────── */}
        {editing && form ? (
          <EditForm
            form={form}
            setForm={setForm}
            saving={saving}
            onSave={saveProfile}
            onCancel={() => { setForm(profile); setEditing(false); }}
            toggleSport={toggleSport}
          />
        ) : (
          <ViewMode
            profile={profile!}
            workoutsThisMonth={workoutsThisMonth}
            levelColor={levelColor}
            onEdit={() => setEditing(true)}
          />
        )}

        {/* ── Sign Out ────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[s.logoutBtn, { borderColor: c.border }]}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Icon name="logout" size={14} color={c.textMuted} />
          <Text style={[s.logoutText, { color: c.textMuted }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── View Mode ────────────────────────────────────────────────────────────────
function ViewMode({ profile, workoutsThisMonth, levelColor, onEdit }: {
  profile: Profile;
  workoutsThisMonth: number;
  levelColor: string;
  onEdit: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const score = calcConsistencyScore(profile, workoutsThisMonth);
  const scoreColor = score >= 70 ? PALETTE.success : score >= 40 ? PALETTE.warning : c.brand;
  const scoreLabel = score >= 70 ? "Great — keep it up!" : score >= 40 ? "Good start — keep logging workouts." : "Log more workouts to improve.";

  return (
    <>
      {/* Bio */}
      {profile.bio && (
        <Text style={[s.bio, { color: c.textSecondary }]}>{profile.bio}</Text>
      )}

      {/* Info chips */}
      <View style={s.chipsRow}>
        {profile.city       && <InfoChip icon="location" label={profile.city} />}
        {profile.gym_name   && <InfoChip icon="gym"      label={profile.gym_name} />}
        {profile.age        && <InfoChip icon="calendar" label={`${profile.age} yo`} />}
        {profile.occupation && <InfoChip icon="info"     label={profile.occupation} />}
      </View>

      {/* 2×2 info grid */}
      <View style={s.infoGrid}>
        <InfoCard label="ACTIVITIES" value={(profile.sports ?? []).length > 0 ? (profile.sports ?? []).slice(0, 3).join(", ") : "Not set"} />
        <InfoCard label="BEST TIME"  value={getBestTime(profile.availability)} />
        <InfoCard label="LEVEL"      value={profile.fitness_level ? profile.fitness_level.charAt(0).toUpperCase() + profile.fitness_level.slice(1) : "Not set"} valueColor={profile.fitness_level ? levelColor : undefined} />
        <InfoCard label="BEST STREAK" value={`${profile.longest_streak ?? profile.current_streak ?? 0} days`} />
      </View>

      {/* Consistency score */}
      <View style={[s.consistencyCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
        <View style={s.consistencyHeader}>
          <View>
            <Text style={[s.consistencyTitle, { color: c.text }]}>Consistency Score</Text>
            <Text style={[s.consistencySub, { color: c.textMuted }]}>Activity · Streak · Profile</Text>
          </View>
          <Text style={[s.consistencyScore, { color: scoreColor }]}>{score}</Text>
        </View>
        <View style={[s.consistencyTrack, { backgroundColor: c.bgCardAlt }]}>
          <View style={[s.consistencyFill, { width: `${score}%` as any, backgroundColor: scoreColor }]} />
        </View>
        <Text style={[s.consistencyLabel, { color: c.textMuted }]}>{scoreLabel}</Text>
      </View>

      {/* Sports */}
      {(profile.sports ?? []).length > 0 && (
        <View style={s.sportsWrap}>
          {(profile.sports ?? []).map((sport) => (
            <View key={sport} style={[s.sportChip, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              <Text style={[s.sportChipText, { color: c.textSecondary }]}>{sport}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Edit button */}
      <TouchableOpacity
        style={[s.editBtn, { borderColor: c.brand, backgroundColor: c.brandSubtle }]}
        onPress={onEdit}
        activeOpacity={0.8}
      >
        <Icon name="edit" size={15} color={c.brand} />
        <Text style={[s.editBtnText, { color: c.brand }]}>Edit Profile</Text>
      </TouchableOpacity>
    </>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────
function EditForm({ form, setForm, saving, onSave, onCancel, toggleSport }: {
  form: Profile;
  setForm: (p: Profile) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  toggleSport: (s: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const fields: { label: string; key: keyof Profile; multiline?: boolean; numeric?: boolean }[] = [
    { label: "Full Name",        key: "full_name" },
    { label: "City",             key: "city" },
    { label: "Gym / Facility",   key: "gym_name" },
    { label: "Occupation",       key: "occupation" },
    { label: "Bio",              key: "bio", multiline: true },
    { label: "Age",              key: "age", numeric: true },
  ];

  return (
    <>
      <Text style={[s.sectionTitle, { color: c.text }]}>Edit Profile</Text>

      {fields.map(({ label, key, multiline, numeric }) => (
        <View key={key} style={s.field}>
          <Text style={[s.fieldLabel, { color: c.textMuted }]}>{label}</Text>
          <TextInput
            style={[s.fieldInput, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text },
              multiline && { height: 90, textAlignVertical: "top", paddingTop: SPACE[12] }]}
            value={numeric ? (form[key]?.toString() ?? "") : ((form[key] as string) ?? "")}
            onChangeText={(v) => setForm({ ...form, [key]: numeric ? (parseInt(v) || null) : v })}
            placeholder={label}
            placeholderTextColor={c.textMuted}
            multiline={multiline}
            keyboardType={numeric ? "numeric" : "default"}
          />
        </View>
      ))}

      {/* Fitness Level */}
      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: c.textMuted }]}>Fitness Level</Text>
        <View style={s.levelRow}>
          {FITNESS_LEVELS.map((level) => {
            const active = form.fitness_level === level;
            const lc = LEVEL_COLOR[level];
            return (
              <TouchableOpacity
                key={level}
                style={[s.levelBtn, { borderColor: active ? lc : c.border, backgroundColor: active ? lc + "18" : c.bgInput }]}
                onPress={() => setForm({ ...form, fitness_level: level })}
              >
                <Text style={[s.levelBtnText, { color: active ? lc : c.textMuted }]}>
                  {level}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Sports */}
      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: c.textMuted }]}>Sports & Activities</Text>
        <View style={s.sportsWrap}>
          {SPORTS_OPTIONS.map((sport) => {
            const selected = (form.sports ?? []).includes(sport);
            return (
              <TouchableOpacity
                key={sport}
                style={[s.sportChip, { backgroundColor: selected ? c.brandSubtle : c.bgCard, borderColor: selected ? c.brand : c.border }]}
                onPress={() => toggleSport(sport)}
              >
                <Text style={[s.sportChipText, { color: selected ? c.brand : c.textMuted }]}>{sport}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Actions */}
      <View style={s.editActions}>
        <TouchableOpacity style={[s.cancelBtn, { borderColor: c.border }]} onPress={onCancel}>
          <Text style={[s.cancelText, { color: c.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: c.brand }, saving && { opacity: 0.7 }]}
          onPress={onSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.saveText}>Save</Text>
          }
        </TouchableOpacity>
      </View>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatPill({ icon, value, label, color, bg, border, textColor, mutedColor }: {
  icon: any; value: number; label: string;
  color: string; bg: string; border: string; textColor: string; mutedColor: string;
}) {
  return (
    <View style={[s.statPill, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[s.statValue, { color: textColor }]}>{value}</Text>
      <Icon name={icon} size={16} color={color} />
      <Text style={[s.statLabel, { color: mutedColor }]}>{label}</Text>
    </View>
  );
}

function InfoChip({ icon, label }: { icon: any; label: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[s.infoChip, { backgroundColor: c.bgCard, borderColor: c.border }]}>
      <Icon name={icon} size={12} color={c.textMuted} />
      <Text style={[s.chipLabel, { color: c.textSecondary }]}>{label}</Text>
    </View>
  );
}

function InfoCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[s.infoCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
      <Text style={[s.infoCardLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[s.infoCardValue, { color: valueColor ?? c.text }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:               { flex: 1 },
  scroll:             { paddingHorizontal: SPACE[24], paddingBottom: SPACE[60], gap: SPACE[20] },

  // Hero
  hero:               { alignItems: "center", paddingTop: SPACE[16], gap: SPACE[8] },
  bellBtn:            { position: "absolute", top: SPACE[16], right: 0, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  avatarWrap:         { position: "relative", marginBottom: SPACE[4] },
  cameraBtn:          { position: "absolute", bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  levelDot:           { position: "absolute", bottom: 0, left: 0, width: 18, height: 18, borderRadius: 9, borderWidth: 2.5 },
  name:               { fontSize: FONT.size.xxl, fontWeight: FONT.weight.black, letterSpacing: -0.5 },
  username:           { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  levelBadge:         { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[14], paddingVertical: 5, borderWidth: 1 },
  levelBadgeText:     { fontSize: FONT.size.xs, fontWeight: FONT.weight.extrabold, letterSpacing: 0.8 },

  // Stats
  statsRow:           { flexDirection: "row", gap: SPACE[10] },
  statPill:           { flex: 1, borderRadius: RADIUS.lg, padding: SPACE[14], alignItems: "center", gap: SPACE[2], borderWidth: 1 },
  statValue:          { fontSize: FONT.size.xxl, fontWeight: FONT.weight.black },
  statLabel:          { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },

  // View mode
  bio:                { fontSize: FONT.size.md, textAlign: "center", lineHeight: 22 },
  chipsRow:           { flexDirection: "row", flexWrap: "wrap", gap: SPACE[8], justifyContent: "center" },
  infoChip:           { flexDirection: "row", alignItems: "center", gap: SPACE[6], borderRadius: RADIUS.pill, paddingHorizontal: SPACE[14], paddingVertical: SPACE[8], borderWidth: 1 },
  chipLabel:          { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  infoGrid:           { flexDirection: "row", flexWrap: "wrap", gap: SPACE[10] },
  infoCard:           { flex: 1, minWidth: "45%", borderRadius: RADIUS.lg, padding: SPACE[14], borderWidth: 1, gap: SPACE[4] },
  infoCardLabel:      { fontSize: 10, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 0.8 },
  infoCardValue:      { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  consistencyCard:    { borderRadius: RADIUS.xl, padding: SPACE[16], borderWidth: 1, gap: SPACE[10] },
  consistencyHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  consistencyTitle:   { fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },
  consistencySub:     { fontSize: FONT.size.xs, marginTop: 2 },
  consistencyScore:   { fontSize: FONT.size.xxl + 4, fontWeight: FONT.weight.black },
  consistencyTrack:   { height: 8, borderRadius: 4, overflow: "hidden" },
  consistencyFill:    { height: 8, borderRadius: 4 },
  consistencyLabel:   { fontSize: FONT.size.sm },
  sportsWrap:         { flexDirection: "row", flexWrap: "wrap", gap: SPACE[8] },
  sportChip:          { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[14], paddingVertical: SPACE[6], borderWidth: 1 },
  sportChipText:      { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  editBtn:            { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE[8], borderRadius: RADIUS.xl, paddingVertical: SPACE[16], borderWidth: 1.5 },
  editBtnText:        { fontWeight: FONT.weight.extrabold, fontSize: FONT.size.md },

  // Edit mode
  sectionTitle:       { fontSize: FONT.size.lg, fontWeight: FONT.weight.black, letterSpacing: -0.5 },
  field:              { gap: SPACE[8] },
  fieldLabel:         { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, letterSpacing: 0.8, textTransform: "uppercase" },
  fieldInput:         { borderRadius: RADIUS.lg, paddingHorizontal: SPACE[16], paddingVertical: SPACE[14], fontSize: FONT.size.md, borderWidth: 1.5 },
  levelRow:           { flexDirection: "row", gap: SPACE[10] },
  levelBtn:           { flex: 1, paddingVertical: SPACE[12], borderRadius: RADIUS.md, borderWidth: 1.5, alignItems: "center" },
  levelBtnText:       { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold, textTransform: "capitalize" },
  editActions:        { flexDirection: "row", gap: SPACE[12] },
  cancelBtn:          { flex: 1, paddingVertical: SPACE[16], borderRadius: RADIUS.xl, borderWidth: 1, alignItems: "center" },
  cancelText:         { fontWeight: FONT.weight.bold },
  saveBtn:            { flex: 1, paddingVertical: SPACE[16], borderRadius: RADIUS.xl, alignItems: "center" },
  saveText:           { color: "#fff", fontWeight: FONT.weight.extrabold, fontSize: FONT.size.md },

  // Sign out
  logoutBtn:          { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE[8], marginTop: SPACE[8], paddingVertical: SPACE[16], borderRadius: RADIUS.xl, borderWidth: 1 },
  logoutText:         { fontWeight: FONT.weight.bold, fontSize: FONT.size.sm },
});
