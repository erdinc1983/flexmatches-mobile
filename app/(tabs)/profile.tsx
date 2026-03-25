/**
 * Profile Screen
 *
 * Full profile matching the web version:
 * - View: bio, chips, info grid, consistency score, sports, completeness bar,
 *   tier card, badges, availability days, share button.
 * - Edit: all fields including gender, weight, certifications, availability,
 *   career section (company, industry, education, career goals).
 */

import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput, Alert, RefreshControl, Share,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../lib/supabase";
import { useTheme, SPACE, FONT, RADIUS, PALETTE, BRAND } from "../../lib/theme";
import { Icon } from "../../components/Icon";
import { Avatar } from "../../components/Avatar";
import { TIERS, BADGES, BADGE_MAP, calcTier, calcUserPoints, type BadgeKey, type Tier } from "../../lib/badges";

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

const GENDERS = [
  { label: "Male",   value: "male"   },
  { label: "Female", value: "female" },
  { label: "Other",  value: "other"  },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TIME_OPTIONS = [
  { value: "morning",   label: "Morning",   sub: "06–12", emoji: "🌅" },
  { value: "afternoon", label: "Afternoon", sub: "12–17", emoji: "☀️" },
  { value: "evening",   label: "Evening",   sub: "17–23", emoji: "🌙" },
];

const CERT_SUGGESTIONS = [
  "Personal Trainer", "CrossFit L1", "CrossFit L2", "Yoga Instructor",
  "Pilates Instructor", "Nutritionist", "Sports Massage", "First Aid",
];

const EDUCATION_LEVELS = [
  "High School", "Associate's", "Bachelor's", "Master's", "PhD", "Other",
];

const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Education", "Marketing",
  "Engineering", "Law", "Design", "Sports & Fitness", "Other",
];

const COMPLETENESS_FIELDS: { key: keyof Profile; label: string }[] = [
  { key: "avatar_url",    label: "Add a profile photo" },
  { key: "full_name",     label: "Add your name" },
  { key: "bio",           label: "Write a bio" },
  { key: "city",          label: "Add your city" },
  { key: "fitness_level", label: "Set fitness level" },
  { key: "age",           label: "Add your age" },
  { key: "sports",        label: "Add at least one sport" },
  { key: "availability",  label: "Set your availability" },
];

// ─── Types ────────────────────────────────────────────────────────────────────
type Profile = {
  username:        string;
  full_name:       string | null;
  bio:             string | null;
  city:            string | null;
  gym_name:        string | null;
  fitness_level:   "beginner" | "intermediate" | "advanced" | null;
  age:             number | null;
  gender:          string | null;
  occupation:      string | null;
  company:         string | null;
  industry:        string | null;
  education_level: string | null;
  career_goals:    string | null;
  weight:          number | null;
  target_weight:   number | null;
  availability:    Record<string, boolean> | null;
  sports:          string[] | null;
  certifications:  string[] | null;
  avatar_url:      string | null;
  is_pro:          boolean | null;
  current_streak:  number;
  longest_streak:  number;
  total_workouts:  number;
  match_count:     number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcConsistencyScore(p: Profile, workoutsThisMonth: number): number {
  let score = 0;
  score += Math.min(workoutsThisMonth / 15, 1) * 40;
  score += Math.min((p.current_streak ?? 0) / 30, 1) * 30;
  const fields = [p.avatar_url, p.full_name, p.bio, p.city, p.fitness_level, p.age, (p.sports ?? []).length > 0];
  score += (fields.filter(Boolean).length / fields.length) * 30;
  return Math.round(score);
}

function getBestTime(av: Record<string, boolean> | null | undefined): string {
  if (!av) return "Not set";
  const labels = [av.morning && "Morning", av.afternoon && "Afternoon", av.evening && "Evening"].filter(Boolean) as string[];
  return labels.length > 0 ? labels.join(", ") : "Not set";
}

function calcCompleteness(p: Profile): { pct: number; missing: string[] } {
  const missing: string[] = [];
  for (const f of COMPLETENESS_FIELDS) {
    const v = p[f.key];
    const empty = !v || (Array.isArray(v) && v.length === 0) ||
      (typeof v === "object" && !Array.isArray(v) && Object.values(v as Record<string, boolean>).every(x => !x));
    if (empty) missing.push(f.label);
  }
  return { pct: Math.round(((COMPLETENESS_FIELDS.length - missing.length) / COMPLETENESS_FIELDS.length) * 100), missing };
}

function getAvailabilityDays(av: Record<string, boolean> | null | undefined): string[] {
  if (!av) return [];
  return DAYS.filter(d => av[d.toLowerCase()]);
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [profile,           setProfile]           = useState<Profile | null>(null);
  const [loading,           setLoading]           = useState(true);
  const [editing,           setEditing]           = useState(false);
  const [saving,            setSaving]            = useState(false);
  const [uploadingPhoto,    setUploadingPhoto]    = useState(false);
  const [form,              setForm]              = useState<Profile | null>(null);
  const [refreshing,        setRefreshing]        = useState(false);
  const [userId,            setUserId]            = useState<string | null>(null);
  const [isAdmin,           setIsAdmin]           = useState(false);
  const [workoutsThisMonth, setWorkoutsThisMonth] = useState(0);
  const [earnedBadges,      setEarnedBadges]      = useState<BadgeKey[]>([]);
  const [userTier,          setUserTier]          = useState<Tier>(TIERS[0]);
  const [userPoints,        setUserPoints]        = useState(0);

  // ── Data ────────────────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [
      { data },
      { count: totalWorkouts },
      { count: matchCount },
      { count: monthlyWorkouts },
      { data: adminData },
      { data: badges },
    ] = await Promise.all([
      supabase.from("users")
        .select("username, full_name, bio, city, gym_name, fitness_level, age, gender, occupation, company, industry, education_level, career_goals, weight, target_weight, availability, sports, certifications, avatar_url, is_pro, current_streak, longest_streak")
        .eq("id", user.id).single(),
      supabase.from("workouts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("matches").select("*", { count: "exact", head: true }).eq("status", "accepted")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
      supabase.from("workouts").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("logged_at", monthAgo),
      supabase.from("users").select("is_admin").eq("id", user.id).single(),
      supabase.from("user_badges").select("badge_key").eq("user_id", user.id),
    ]);

    if (data) {
      const full: Profile = {
        ...data,
        sports:         data.sports ?? [],
        certifications: data.certifications ?? [],
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
    setIsAdmin(adminData?.is_admin ?? false);
    setEarnedBadges((badges ?? []).map((b: { badge_key: string }) => b.badge_key as BadgeKey));

    const pts = await calcUserPoints(user.id);
    setUserPoints(pts);
    setUserTier(calcTier(pts));

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
      full_name:       form.full_name,
      bio:             form.bio,
      city:            form.city,
      gym_name:        form.gym_name,
      fitness_level:   form.fitness_level,
      age:             form.age,
      gender:          form.gender,
      occupation:      form.occupation,
      company:         form.company,
      industry:        form.industry,
      education_level: form.education_level,
      career_goals:    form.career_goals,
      weight:          form.weight,
      target_weight:   form.target_weight,
      sports:          form.sports,
      certifications:  form.certifications,
      availability:    form.availability,
    }).eq("id", userId);
    setSaving(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setProfile(form);
    setEditing(false);
  }

  function toggleSport(sport: string) {
    if (!form) return;
    const sports = form.sports ?? [];
    setForm({ ...form, sports: sports.includes(sport) ? sports.filter(s => s !== sport) : [...sports, sport] });
  }

  function toggleDay(day: string) {
    if (!form) return;
    const av = { ...(form.availability ?? {}) };
    av[day.toLowerCase()] = !av[day.toLowerCase()];
    setForm({ ...form, availability: av });
  }

  function toggleTime(time: string) {
    if (!form) return;
    const av = { ...(form.availability ?? {}) };
    av[time] = !av[time];
    setForm({ ...form, availability: av });
  }

  function addCert(cert: string) {
    if (!form || !cert.trim()) return;
    const certs = form.certifications ?? [];
    if (!certs.includes(cert.trim())) {
      setForm({ ...form, certifications: [...certs, cert.trim()] });
    }
  }

  function removeCert(cert: string) {
    if (!form) return;
    setForm({ ...form, certifications: (form.certifications ?? []).filter(c => c !== cert) });
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
      setProfile(p => p ? { ...p, avatar_url: publicUrl } : p);
      setForm(f => f ? { ...f, avatar_url: publicUrl } : f);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleShareProfile() {
    if (!profile) return;
    try {
      await Share.share({
        message: `Check out my FlexMatches profile! @${profile.username}`,
        title: "FlexMatches",
      });
    } catch (_) {}
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
          <TouchableOpacity
            style={s.bellBtn}
            onPress={() => router.push("/notifications")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="notification" size={22} color={c.textMuted} />
          </TouchableOpacity>

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

          <View style={s.nameRow}>
            <Text style={[s.name, { color: c.text }]}>{profile?.full_name ?? `@${profile?.username}`}</Text>
            {profile?.is_pro && (
              <View style={[s.proBadge, { backgroundColor: "#f59e0b22", borderColor: "#f59e0b55" }]}>
                <Text style={[s.proBadgeText, { color: "#f59e0b" }]}>PRO</Text>
              </View>
            )}
          </View>
          <Text style={[s.username, { color: c.textMuted }]}>@{profile?.username}</Text>

          {profile?.fitness_level && (
            <View style={[s.levelBadge, { borderColor: levelColor + "44", backgroundColor: levelColor + "14" }]}>
              <Text style={[s.levelBadgeText, { color: levelColor }]}>
                {profile.fitness_level.toUpperCase()}
              </Text>
            </View>
          )}

          {/* Share button */}
          <TouchableOpacity
            style={[s.shareBtn, { borderColor: c.border, backgroundColor: c.bgCard }]}
            onPress={handleShareProfile}
            activeOpacity={0.8}
          >
            <Icon name="info" size={14} color={c.textMuted} />
            <Text style={[s.shareBtnText, { color: c.textSecondary }]}>Share Profile</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats ───────────────────────────────────────────────────────── */}
        <View style={s.statsRow}>
          <StatPill icon="streakActive" value={profile?.current_streak ?? 0} label="streak"   color={c.brand} bg={c.bgCard} border={c.border} textColor={c.text} mutedColor={c.textMuted} />
          <StatPill icon="workout"      value={profile?.total_workouts ?? 0}  label="workouts" color={c.brand} bg={c.bgCard} border={c.border} textColor={c.text} mutedColor={c.textMuted} />
          <StatPill icon="matchActive"  value={profile?.match_count ?? 0}     label="matches"  color={c.brand} bg={c.bgCard} border={c.border} textColor={c.text} mutedColor={c.textMuted} />
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
            toggleDay={toggleDay}
            toggleTime={toggleTime}
            addCert={addCert}
            removeCert={removeCert}
          />
        ) : (
          <ViewMode
            profile={profile!}
            workoutsThisMonth={workoutsThisMonth}
            levelColor={levelColor}
            earnedBadges={earnedBadges}
            userTier={userTier}
            userPoints={userPoints}
            onEdit={() => setEditing(true)}
          />
        )}

        {/* ── Settings button ─────────────────────────────────────────────── */}
        {!editing && (
          <TouchableOpacity
            style={[s.settingsBtn, { borderColor: c.border, backgroundColor: c.bgCard }]}
            onPress={() => router.push("/settings")}
            activeOpacity={0.8}
          >
            <Text style={[s.settingsBtnText, { color: c.textSecondary }]}>⚙️  Settings</Text>
          </TouchableOpacity>
        )}

        {/* ── Admin button ────────────────────────────────────────────────── */}
        {isAdmin && !editing && (
          <TouchableOpacity
            style={[s.adminBtn, { borderColor: "#f59e0b55", backgroundColor: "#f59e0b11" }]}
            onPress={() => router.push("/admin")}
            activeOpacity={0.8}
          >
            <Text style={[s.adminBtnText, { color: "#f59e0b" }]}>🛡️  Admin Panel</Text>
          </TouchableOpacity>
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
function ViewMode({ profile, workoutsThisMonth, levelColor, earnedBadges, userTier, userPoints, onEdit }: {
  profile: Profile;
  workoutsThisMonth: number;
  levelColor: string;
  earnedBadges: BadgeKey[];
  userTier: Tier;
  userPoints: number;
  onEdit: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const score = calcConsistencyScore(profile, workoutsThisMonth);
  const scoreColor = score >= 70 ? PALETTE.success : score >= 40 ? PALETTE.warning : c.brand;
  const scoreLabel = score >= 70 ? "Great — keep it up!" : score >= 40 ? "Good start — keep logging workouts." : "Log more workouts to improve.";
  const { pct: completePct, missing } = calcCompleteness(profile);
  const completeColor = completePct >= 80 ? PALETTE.success : completePct >= 50 ? PALETTE.warning : c.brand;
  const activeDays = getAvailabilityDays(profile.availability);

  const nextTier = TIERS.find(t => t.minPoints > userPoints);

  return (
    <>
      {/* Profile completeness */}
      {completePct < 100 && (
        <View style={[s.completeCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <View style={s.completeHeader}>
            <Text style={[s.completeTitle, { color: c.text }]}>Profile {completePct}% complete</Text>
            <Text style={[s.completePct, { color: completeColor }]}>{completePct}%</Text>
          </View>
          <View style={[s.completeTrack, { backgroundColor: c.bgCardAlt }]}>
            <View style={[s.completeFill, { width: `${completePct}%` as any, backgroundColor: completeColor }]} />
          </View>
          {missing.length > 0 && (
            <Text style={[s.completeMissing, { color: c.textMuted }]}>
              Next: {missing[0]}
            </Text>
          )}
        </View>
      )}

      {/* Bio */}
      {profile.bio && (
        <Text style={[s.bio, { color: c.textSecondary }]}>{profile.bio}</Text>
      )}

      {/* Info chips */}
      <View style={s.chipsRow}>
        {profile.city       && <InfoChip icon="location" label={profile.city} />}
        {profile.gym_name   && <InfoChip icon="gym"      label={profile.gym_name} />}
        {profile.age        && <InfoChip icon="calendar" label={`${profile.age} yo`} />}
        {profile.gender     && <InfoChip icon="info"     label={profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)} />}
        {profile.occupation && <InfoChip icon="info"     label={profile.occupation} />}
        {profile.weight     && <InfoChip icon="info"     label={`${profile.weight} kg`} />}
      </View>

      {/* 2×2 info grid */}
      <View style={s.infoGrid}>
        <InfoCard label="ACTIVITIES"  value={(profile.sports ?? []).length > 0 ? (profile.sports ?? []).slice(0, 3).join(", ") : "Not set"} />
        <InfoCard label="BEST TIME"   value={getBestTime(profile.availability)} />
        <InfoCard label="LEVEL"       value={profile.fitness_level ? profile.fitness_level.charAt(0).toUpperCase() + profile.fitness_level.slice(1) : "Not set"} valueColor={profile.fitness_level ? levelColor : undefined} />
        <InfoCard label="BEST STREAK" value={`${profile.longest_streak ?? profile.current_streak ?? 0} days`} />
      </View>

      {/* Availability days */}
      {activeDays.length > 0 && (
        <View style={[s.availCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Text style={[s.availTitle, { color: c.text }]}>Availability</Text>
          <View style={s.daysRow}>
            {DAYS.map(d => {
              const active = activeDays.includes(d);
              return (
                <View key={d} style={[s.dayDot, { backgroundColor: active ? c.brand : c.bgCardAlt, borderColor: active ? c.brand : c.border }]}>
                  <Text style={[s.dayDotText, { color: active ? "#fff" : c.textMuted }]}>{d[0]}</Text>
                </View>
              );
            })}
          </View>
          {getBestTime(profile.availability) !== "Not set" && (
            <Text style={[s.availTime, { color: c.textMuted }]}>⏰ {getBestTime(profile.availability)}</Text>
          )}
        </View>
      )}

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

      {/* Tier card */}
      <View style={[s.tierCard, { backgroundColor: userTier.color + "18", borderColor: userTier.color + "55" }]}>
        <View style={s.tierLeft}>
          <Text style={s.tierEmoji}>{userTier.emoji}</Text>
          <View>
            <Text style={[s.tierLabel, { color: userTier.color }]}>{userTier.label} Tier</Text>
            <Text style={[s.tierPoints, { color: userTier.color + "aa" }]}>{userPoints} pts</Text>
          </View>
        </View>
        {nextTier && (
          <View style={s.tierRight}>
            <Text style={[s.tierNextLabel, { color: userTier.color + "99" }]}>
              {nextTier.minPoints - userPoints} pts to {nextTier.label}
            </Text>
            <View style={[s.tierTrack, { backgroundColor: userTier.color + "33" }]}>
              <View style={[s.tierFill, {
                width: `${Math.min(((userPoints - userTier.minPoints) / (nextTier.minPoints - userTier.minPoints)) * 100, 100)}%` as any,
                backgroundColor: userTier.color,
              }]} />
            </View>
          </View>
        )}
      </View>

      {/* Badges */}
      {earnedBadges.length > 0 && (
        <View style={[s.badgesCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Text style={[s.badgesTitle, { color: c.text }]}>Badges</Text>
          <View style={s.badgesGrid}>
            {earnedBadges.map(key => {
              const b = BADGE_MAP[key];
              if (!b) return null;
              return (
                <View key={key} style={[s.badge, { backgroundColor: b.color + "18", borderColor: b.color + "55" }]}>
                  <Text style={s.badgeEmoji}>{b.emoji}</Text>
                  <Text style={[s.badgeTitle, { color: b.color }]} numberOfLines={1}>{b.title}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Sports */}
      {(profile.sports ?? []).length > 0 && (
        <View style={s.sportsWrap}>
          {(profile.sports ?? []).map(sport => (
            <View key={sport} style={[s.sportChip, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              <Text style={[s.sportChipText, { color: c.textSecondary }]}>{sport}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Certifications */}
      {(profile.certifications ?? []).length > 0 && (
        <View style={[s.certCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Text style={[s.certTitle, { color: c.text }]}>Certifications</Text>
          <View style={s.sportsWrap}>
            {(profile.certifications ?? []).map(cert => (
              <View key={cert} style={[s.sportChip, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                <Text style={[s.sportChipText, { color: c.textSecondary }]}>✓ {cert}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Career info */}
      {(profile.company || profile.industry || profile.education_level || profile.career_goals) && (
        <View style={[s.careerCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Text style={[s.careerTitle, { color: c.text }]}>Career</Text>
          {profile.company         && <Text style={[s.careerRow, { color: c.textSecondary }]}>🏢 {profile.company}</Text>}
          {profile.industry        && <Text style={[s.careerRow, { color: c.textSecondary }]}>📊 {profile.industry}</Text>}
          {profile.education_level && <Text style={[s.careerRow, { color: c.textSecondary }]}>🎓 {profile.education_level}</Text>}
          {profile.career_goals    && <Text style={[s.careerRow, { color: c.textMuted }]}>{profile.career_goals}</Text>}
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
function EditForm({ form, setForm, saving, onSave, onCancel, toggleSport, toggleDay, toggleTime, addCert, removeCert }: {
  form: Profile;
  setForm: (p: Profile) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  toggleSport: (s: string) => void;
  toggleDay: (d: string) => void;
  toggleTime: (t: string) => void;
  addCert: (c: string) => void;
  removeCert: (c: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [certInput, setCertInput] = useState("");

  const basicFields: { label: string; key: keyof Profile; multiline?: boolean; numeric?: boolean }[] = [
    { label: "Full Name",      key: "full_name" },
    { label: "City",           key: "city" },
    { label: "Gym / Facility", key: "gym_name" },
    { label: "Occupation",     key: "occupation" },
    { label: "Bio",            key: "bio", multiline: true },
    { label: "Age",            key: "age", numeric: true },
    { label: "Weight (kg)",    key: "weight", numeric: true },
    { label: "Target Weight (kg)", key: "target_weight", numeric: true },
  ];

  const careerFields: { label: string; key: keyof Profile; multiline?: boolean }[] = [
    { label: "Company",       key: "company" },
    { label: "Career Goals",  key: "career_goals", multiline: true },
  ];

  return (
    <>
      <Text style={[s.sectionTitle, { color: c.text }]}>Edit Profile</Text>

      {/* Basic fields */}
      {basicFields.map(({ label, key, multiline, numeric }) => (
        <View key={key} style={s.field}>
          <Text style={[s.fieldLabel, { color: c.textMuted }]}>{label}</Text>
          <TextInput
            style={[s.fieldInput, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text },
              multiline && { height: 80, textAlignVertical: "top", paddingTop: SPACE[12] }]}
            value={numeric ? (form[key]?.toString() ?? "") : ((form[key] as string) ?? "")}
            onChangeText={v => setForm({ ...form, [key]: numeric ? (parseInt(v) || null) : v })}
            placeholder={label}
            placeholderTextColor={c.textMuted}
            multiline={multiline}
            keyboardType={numeric ? "numeric" : "default"}
          />
        </View>
      ))}

      {/* Gender */}
      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: c.textMuted }]}>Gender</Text>
        <View style={s.levelRow}>
          {GENDERS.map(({ label, value }) => {
            const active = form.gender === value;
            return (
              <TouchableOpacity
                key={value}
                style={[s.levelBtn, { borderColor: active ? c.brand : c.border, backgroundColor: active ? c.brandSubtle : c.bgInput }]}
                onPress={() => setForm({ ...form, gender: value })}
              >
                <Text style={[s.levelBtnText, { color: active ? c.brand : c.textMuted }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Fitness Level */}
      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: c.textMuted }]}>Fitness Level</Text>
        <View style={s.levelRow}>
          {FITNESS_LEVELS.map(level => {
            const active = form.fitness_level === level;
            const lc = LEVEL_COLOR[level];
            return (
              <TouchableOpacity
                key={level}
                style={[s.levelBtn, { borderColor: active ? lc : c.border, backgroundColor: active ? lc + "18" : c.bgInput }]}
                onPress={() => setForm({ ...form, fitness_level: level })}
              >
                <Text style={[s.levelBtnText, { color: active ? lc : c.textMuted }]}>{level}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Availability — Days */}
      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: c.textMuted }]}>Available Days</Text>
        <View style={s.daysRow}>
          {DAYS.map(d => {
            const active = !!(form.availability ?? {})[d.toLowerCase()];
            return (
              <TouchableOpacity
                key={d}
                style={[s.dayDot, { backgroundColor: active ? c.brand : c.bgInput, borderColor: active ? c.brand : c.border }]}
                onPress={() => toggleDay(d)}
              >
                <Text style={[s.dayDotText, { color: active ? "#fff" : c.textMuted }]}>{d[0]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Availability — Times */}
      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: c.textMuted }]}>Training Times</Text>
        <View style={s.timeRow}>
          {TIME_OPTIONS.map(({ value, label, sub, emoji }) => {
            const active = !!(form.availability ?? {})[value];
            return (
              <TouchableOpacity
                key={value}
                style={[s.timeBtn, { borderColor: active ? c.brand : c.border, backgroundColor: active ? c.brandSubtle : c.bgInput }]}
                onPress={() => toggleTime(value)}
              >
                <Text style={s.timeEmoji}>{emoji}</Text>
                <Text style={[s.timeLabel, { color: active ? c.brand : c.text }]}>{label}</Text>
                <Text style={[s.timeSub, { color: c.textMuted }]}>{sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Sports */}
      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: c.textMuted }]}>Sports & Activities</Text>
        <View style={s.sportsWrap}>
          {SPORTS_OPTIONS.map(sport => {
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

      {/* Certifications */}
      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: c.textMuted }]}>Certifications</Text>
        <View style={s.certInputRow}>
          <TextInput
            style={[s.certInput, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text }]}
            value={certInput}
            onChangeText={setCertInput}
            placeholder="Add certification..."
            placeholderTextColor={c.textMuted}
            onSubmitEditing={() => { addCert(certInput); setCertInput(""); }}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[s.certAddBtn, { backgroundColor: c.brand }]}
            onPress={() => { addCert(certInput); setCertInput(""); }}
          >
            <Text style={s.certAddText}>Add</Text>
          </TouchableOpacity>
        </View>
        {/* Suggestions */}
        <View style={s.sportsWrap}>
          {CERT_SUGGESTIONS.filter(cs => !(form.certifications ?? []).includes(cs)).map(cs => (
            <TouchableOpacity
              key={cs}
              style={[s.sportChip, { backgroundColor: c.bgCard, borderColor: c.border }]}
              onPress={() => addCert(cs)}
            >
              <Text style={[s.sportChipText, { color: c.textMuted }]}>+ {cs}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Added */}
        {(form.certifications ?? []).length > 0 && (
          <View style={s.sportsWrap}>
            {(form.certifications ?? []).map(cert => (
              <TouchableOpacity
                key={cert}
                style={[s.sportChip, { backgroundColor: c.brandSubtle, borderColor: c.brand }]}
                onPress={() => removeCert(cert)}
              >
                <Text style={[s.sportChipText, { color: c.brand }]}>✓ {cert} ×</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Career section */}
      <Text style={[s.sectionTitle, { color: c.text, marginTop: SPACE[4] }]}>Career</Text>

      {careerFields.map(({ label, key, multiline }) => (
        <View key={key} style={s.field}>
          <Text style={[s.fieldLabel, { color: c.textMuted }]}>{label}</Text>
          <TextInput
            style={[s.fieldInput, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text },
              multiline && { height: 80, textAlignVertical: "top", paddingTop: SPACE[12] }]}
            value={(form[key] as string) ?? ""}
            onChangeText={v => setForm({ ...form, [key]: v })}
            placeholder={label}
            placeholderTextColor={c.textMuted}
            multiline={multiline}
          />
        </View>
      ))}

      {/* Industry */}
      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: c.textMuted }]}>Industry</Text>
        <View style={s.sportsWrap}>
          {INDUSTRIES.map(ind => {
            const active = form.industry === ind;
            return (
              <TouchableOpacity
                key={ind}
                style={[s.sportChip, { backgroundColor: active ? c.brandSubtle : c.bgCard, borderColor: active ? c.brand : c.border }]}
                onPress={() => setForm({ ...form, industry: ind })}
              >
                <Text style={[s.sportChipText, { color: active ? c.brand : c.textMuted }]}>{ind}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Education */}
      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: c.textMuted }]}>Education Level</Text>
        <View style={s.sportsWrap}>
          {EDUCATION_LEVELS.map(edu => {
            const active = form.education_level === edu;
            return (
              <TouchableOpacity
                key={edu}
                style={[s.sportChip, { backgroundColor: active ? c.brandSubtle : c.bgCard, borderColor: active ? c.brand : c.border }]}
                onPress={() => setForm({ ...form, education_level: edu })}
              >
                <Text style={[s.sportChipText, { color: active ? c.brand : c.textMuted }]}>{edu}</Text>
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
  root:   { flex: 1 },
  scroll: { paddingHorizontal: SPACE[24], paddingBottom: SPACE[60], gap: SPACE[20] },

  // Hero
  hero:          { alignItems: "center", paddingTop: SPACE[16], gap: SPACE[8] },
  bellBtn:       { position: "absolute", top: SPACE[16], right: 0, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  avatarWrap:    { position: "relative", marginBottom: SPACE[4] },
  cameraBtn:     { position: "absolute", bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  levelDot:      { position: "absolute", bottom: 0, left: 0, width: 18, height: 18, borderRadius: 9, borderWidth: 2.5 },
  nameRow:       { flexDirection: "row", alignItems: "center", gap: SPACE[8] },
  name:          { fontSize: FONT.size.xxl, fontWeight: FONT.weight.black, letterSpacing: -0.5 },
  proBadge:      { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[8], paddingVertical: 2, borderWidth: 1 },
  proBadgeText:  { fontSize: 10, fontWeight: FONT.weight.extrabold, letterSpacing: 0.8 },
  username:      { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  levelBadge:    { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[14], paddingVertical: 5, borderWidth: 1 },
  levelBadgeText:{ fontSize: FONT.size.xs, fontWeight: FONT.weight.extrabold, letterSpacing: 0.8 },
  shareBtn:      { flexDirection: "row", alignItems: "center", gap: SPACE[6], borderRadius: RADIUS.pill, paddingHorizontal: SPACE[16], paddingVertical: SPACE[8], borderWidth: 1 },
  shareBtnText:  { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },

  // Stats
  statsRow:  { flexDirection: "row", gap: SPACE[10] },
  statPill:  { flex: 1, borderRadius: RADIUS.lg, padding: SPACE[14], alignItems: "center", gap: SPACE[2], borderWidth: 1 },
  statValue: { fontSize: FONT.size.xxl, fontWeight: FONT.weight.black },
  statLabel: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },

  // Completeness
  completeCard:   { borderRadius: RADIUS.xl, padding: SPACE[16], borderWidth: 1, gap: SPACE[10] },
  completeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  completeTitle:  { fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },
  completePct:    { fontSize: FONT.size.lg, fontWeight: FONT.weight.black },
  completeTrack:  { height: 8, borderRadius: 4, overflow: "hidden" },
  completeFill:   { height: 8, borderRadius: 4 },
  completeMissing:{ fontSize: FONT.size.sm },

  // View mode
  bio:              { fontSize: FONT.size.md, textAlign: "center", lineHeight: 22 },
  chipsRow:         { flexDirection: "row", flexWrap: "wrap", gap: SPACE[8], justifyContent: "center" },
  infoChip:         { flexDirection: "row", alignItems: "center", gap: SPACE[6], borderRadius: RADIUS.pill, paddingHorizontal: SPACE[14], paddingVertical: SPACE[8], borderWidth: 1 },
  chipLabel:        { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  infoGrid:         { flexDirection: "row", flexWrap: "wrap", gap: SPACE[10] },
  infoCard:         { flex: 1, minWidth: "45%", borderRadius: RADIUS.lg, padding: SPACE[14], borderWidth: 1, gap: SPACE[4] },
  infoCardLabel:    { fontSize: 10, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 0.8 },
  infoCardValue:    { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },

  // Availability
  availCard:  { borderRadius: RADIUS.xl, padding: SPACE[16], borderWidth: 1, gap: SPACE[10] },
  availTitle: { fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },
  daysRow:    { flexDirection: "row", gap: SPACE[8], flexWrap: "wrap" },
  dayDot:     { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  dayDotText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  availTime:  { fontSize: FONT.size.sm },

  // Consistency
  consistencyCard:   { borderRadius: RADIUS.xl, padding: SPACE[16], borderWidth: 1, gap: SPACE[10] },
  consistencyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  consistencyTitle:  { fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },
  consistencySub:    { fontSize: FONT.size.xs, marginTop: 2 },
  consistencyScore:  { fontSize: FONT.size.xxl + 4, fontWeight: FONT.weight.black },
  consistencyTrack:  { height: 8, borderRadius: 4, overflow: "hidden" },
  consistencyFill:   { height: 8, borderRadius: 4 },
  consistencyLabel:  { fontSize: FONT.size.sm },

  // Tier
  tierCard:      { borderRadius: RADIUS.xl, padding: SPACE[16], borderWidth: 1, flexDirection: "row", alignItems: "center", gap: SPACE[12] },
  tierLeft:      { flexDirection: "row", alignItems: "center", gap: SPACE[10] },
  tierEmoji:     { fontSize: 28 },
  tierLabel:     { fontSize: FONT.size.md, fontWeight: FONT.weight.black },
  tierPoints:    { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  tierRight:     { flex: 1, gap: SPACE[4] },
  tierNextLabel: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
  tierTrack:     { height: 6, borderRadius: 3, overflow: "hidden" },
  tierFill:      { height: 6, borderRadius: 3 },

  // Badges
  badgesCard:  { borderRadius: RADIUS.xl, padding: SPACE[16], borderWidth: 1, gap: SPACE[12] },
  badgesTitle: { fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },
  badgesGrid:  { flexDirection: "row", flexWrap: "wrap", gap: SPACE[8] },
  badge:       { borderRadius: RADIUS.lg, padding: SPACE[10], alignItems: "center", borderWidth: 1, gap: SPACE[4], minWidth: 80 },
  badgeEmoji:  { fontSize: 22 },
  badgeTitle:  { fontSize: 10, fontWeight: FONT.weight.bold, textAlign: "center" },

  // Sports / chips
  sportsWrap:   { flexDirection: "row", flexWrap: "wrap", gap: SPACE[8] },
  sportChip:    { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[14], paddingVertical: SPACE[6], borderWidth: 1 },
  sportChipText:{ fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },

  // Certifications
  certCard:     { borderRadius: RADIUS.xl, padding: SPACE[16], borderWidth: 1, gap: SPACE[10] },
  certTitle:    { fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },
  certInputRow: { flexDirection: "row", gap: SPACE[8] },
  certInput:    { flex: 1, borderRadius: RADIUS.lg, paddingHorizontal: SPACE[14], paddingVertical: SPACE[12], fontSize: FONT.size.md, borderWidth: 1.5 },
  certAddBtn:   { paddingHorizontal: SPACE[16], paddingVertical: SPACE[12], borderRadius: RADIUS.lg, justifyContent: "center" },
  certAddText:  { color: "#fff", fontWeight: FONT.weight.bold },

  // Career
  careerCard:  { borderRadius: RADIUS.xl, padding: SPACE[16], borderWidth: 1, gap: SPACE[8] },
  careerTitle: { fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },
  careerRow:   { fontSize: FONT.size.sm, lineHeight: 20 },

  // Edit mode
  sectionTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.black, letterSpacing: -0.5 },
  field:        { gap: SPACE[8] },
  fieldLabel:   { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, letterSpacing: 0.8, textTransform: "uppercase" },
  fieldInput:   { borderRadius: RADIUS.lg, paddingHorizontal: SPACE[16], paddingVertical: SPACE[14], fontSize: FONT.size.md, borderWidth: 1.5 },
  levelRow:     { flexDirection: "row", gap: SPACE[10] },
  levelBtn:     { flex: 1, paddingVertical: SPACE[12], borderRadius: RADIUS.md, borderWidth: 1.5, alignItems: "center" },
  levelBtnText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold, textTransform: "capitalize" },
  timeRow:      { flexDirection: "row", gap: SPACE[8] },
  timeBtn:      { flex: 1, borderRadius: RADIUS.lg, borderWidth: 1.5, padding: SPACE[10], alignItems: "center", gap: SPACE[4] },
  timeEmoji:    { fontSize: 18 },
  timeLabel:    { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  timeSub:      { fontSize: 10 },
  editActions:  { flexDirection: "row", gap: SPACE[12] },
  cancelBtn:    { flex: 1, paddingVertical: SPACE[16], borderRadius: RADIUS.xl, borderWidth: 1, alignItems: "center" },
  cancelText:   { fontWeight: FONT.weight.bold },
  saveBtn:      { flex: 1, paddingVertical: SPACE[16], borderRadius: RADIUS.xl, alignItems: "center" },
  saveText:     { color: "#fff", fontWeight: FONT.weight.extrabold, fontSize: FONT.size.md },

  // Edit button
  editBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE[8], borderRadius: RADIUS.xl, paddingVertical: SPACE[16], borderWidth: 1.5 },
  editBtnText: { fontWeight: FONT.weight.extrabold, fontSize: FONT.size.md },

  // Settings
  settingsBtn:     { borderRadius: RADIUS.xl, paddingVertical: SPACE[16], borderWidth: 1, alignItems: "center" },
  settingsBtnText: { fontWeight: FONT.weight.semibold, fontSize: FONT.size.md },

  // Admin
  adminBtn:     { borderRadius: RADIUS.xl, paddingVertical: SPACE[16], borderWidth: 1, alignItems: "center" },
  adminBtnText: { fontWeight: FONT.weight.extrabold, fontSize: FONT.size.md },

  // Sign out
  logoutBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE[8], marginTop: SPACE[8], paddingVertical: SPACE[16], borderRadius: RADIUS.xl, borderWidth: 1 },
  logoutText: { fontWeight: FONT.weight.bold, fontSize: FONT.size.sm },
});
