import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, StatusBar, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";

const { width } = Dimensions.get("window");
const TOTAL_STEPS = 4;

const SPORTS = [
  { label: "Gym", emoji: "🏋️" }, { label: "Running", emoji: "🏃" },
  { label: "Cycling", emoji: "🚴" }, { label: "Swimming", emoji: "🏊" },
  { label: "Soccer", emoji: "⚽" }, { label: "Basketball", emoji: "🏀" },
  { label: "Tennis", emoji: "🎾" }, { label: "Boxing", emoji: "🥊" },
  { label: "Yoga", emoji: "🧘" }, { label: "CrossFit", emoji: "💪" },
  { label: "Hiking", emoji: "🏔️" }, { label: "Climbing", emoji: "🧗" },
  { label: "HIIT", emoji: "⚡" }, { label: "Other", emoji: "🏅" },
];

const FITNESS_LEVELS = [
  { value: "beginner",     label: "Beginner",     desc: "Just getting started",   emoji: "🌱" },
  { value: "intermediate", label: "Intermediate", desc: "Training regularly",      emoji: "🔥" },
  { value: "advanced",     label: "Advanced",     desc: "Competing or coaching",   emoji: "🏆" },
];

const TIME_OPTIONS = [
  { value: "morning",   label: "Morning",   sub: "06:00 – 12:00", emoji: "🌅" },
  { value: "afternoon", label: "Afternoon", sub: "12:00 – 17:00", emoji: "☀️" },
  { value: "evening",   label: "Evening",   sub: "17:00 – 23:00", emoji: "🌙" },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");

  // Step 2
  const [sports, setSports] = useState<string[]>([]);

  // Step 3
  const [fitnessLevel, setFitnessLevel] = useState("");
  const [preferredTimes, setPreferredTimes] = useState<string[]>([]);

  // Step 4
  const [city, setCity] = useState("");

  function toggleSport(s: string) {
    setSports((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  function toggleTime(t: string) {
    setPreferredTimes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  async function finish() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    await supabase.from("users").update({
      full_name: fullName.trim() || null,
      bio: bio.trim() || null,
      sports: sports.length > 0 ? sports : null,
      fitness_level: fitnessLevel || null,
      availability: preferredTimes.length > 0 ? preferredTimes : null,
      city: city.trim() || null,
    }).eq("id", user.id);

    setSaving(false);
    router.replace("/(tabs)/home");
  }

  function next() {
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
    else finish();
  }

  function back() {
    if (step > 1) setStep((s) => s - 1);
    else router.back();
  }

  const canNext = () => {
    if (step === 1) return fullName.trim().length > 0;
    if (step === 2) return sports.length > 0;
    if (step === 3) return fitnessLevel.length > 0;
    return true; // step 4 city is optional
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={back} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.stepLabel}>{step} / {TOTAL_STEPS}</Text>
        <TouchableOpacity onPress={() => router.replace("/(tabs)/home")}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Step 1: Name + Bio */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>👋</Text>
            <Text style={styles.stepTitle}>What's your name?</Text>
            <Text style={styles.stepSub}>Let your future partners know who you are</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g. Alex Johnson"
                placeholderTextColor="#333"
                autoFocus
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Short Bio (optional)</Text>
              <TextInput
                style={[styles.input, { height: 90, textAlignVertical: "top", paddingTop: 14 }]}
                value={bio}
                onChangeText={setBio}
                placeholder="I love morning runs and heavy lifts..."
                placeholderTextColor="#333"
                multiline
                maxLength={120}
              />
              <Text style={styles.charCount}>{bio.length}/120</Text>
            </View>
          </View>
        )}

        {/* Step 2: Sports */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>🏅</Text>
            <Text style={styles.stepTitle}>What do you train?</Text>
            <Text style={styles.stepSub}>Pick all that apply — we'll find your perfect match</Text>

            <View style={styles.sportsGrid}>
              {SPORTS.map((s) => (
                <TouchableOpacity
                  key={s.label}
                  style={[styles.sportChip, sports.includes(s.label) && styles.sportChipActive]}
                  onPress={() => toggleSport(s.label)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.sportEmoji}>{s.emoji}</Text>
                  <Text style={[styles.sportLabel, sports.includes(s.label) && styles.sportLabelActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 3: Fitness Level + Times */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>🔥</Text>
            <Text style={styles.stepTitle}>Your fitness level</Text>
            <Text style={styles.stepSub}>We'll match you with people at your level</Text>

            <View style={styles.levelGrid}>
              {FITNESS_LEVELS.map((l) => (
                <TouchableOpacity
                  key={l.value}
                  style={[styles.levelCard, fitnessLevel === l.value && styles.levelCardActive]}
                  onPress={() => setFitnessLevel(l.value)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.levelEmoji}>{l.emoji}</Text>
                  <Text style={[styles.levelLabel, fitnessLevel === l.value && styles.levelLabelActive]}>
                    {l.label}
                  </Text>
                  <Text style={styles.levelDesc}>{l.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 24, marginBottom: 10 }]}>
              Preferred times (optional)
            </Text>
            <View style={styles.timesRow}>
              {TIME_OPTIONS.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.timeChip, preferredTimes.includes(t.value) && styles.timeChipActive]}
                  onPress={() => toggleTime(t.value)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.timeEmoji}>{t.emoji}</Text>
                  <Text style={[styles.timeLabel, preferredTimes.includes(t.value) && { color: "#FF4500" }]}>
                    {t.label}
                  </Text>
                  <Text style={styles.timeSub}>{t.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 4: City */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>📍</Text>
            <Text style={styles.stepTitle}>Where do you train?</Text>
            <Text style={styles.stepSub}>Connect with partners in your city (optional)</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>City</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="e.g. New York, London, Istanbul"
                placeholderTextColor="#333"
                autoFocus
              />
            </View>

            <View style={styles.readyCard}>
              <Text style={styles.readyEmoji}>🚀</Text>
              <Text style={styles.readyTitle}>You're all set!</Text>
              <Text style={styles.readyText}>
                Start discovering workout partners who match your style and schedule.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* CTA */}
      <View style={styles.cta}>
        <TouchableOpacity
          style={[styles.nextBtn, !canNext() && { opacity: 0.4 }]}
          onPress={next}
          disabled={!canNext() || saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.nextBtnText}>
                {step === TOTAL_STEPS ? "Let's Go! 🚀" : "Continue →"}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  progressBar: { height: 3, backgroundColor: "#1a1a1a", marginHorizontal: 0 },
  progressFill: { height: 3, backgroundColor: "#FF4500" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { padding: 4 },
  backText: { fontSize: 22, color: "#888" },
  stepLabel: { fontSize: 13, color: "#444", fontWeight: "600" },
  skipText: { fontSize: 13, color: "#555", fontWeight: "600" },
  scroll: { paddingHorizontal: 24, paddingBottom: 20 },
  stepContent: { gap: 16 },
  stepEmoji: { fontSize: 48, marginTop: 8, textAlign: "center" },
  stepTitle: { fontSize: 28, fontWeight: "900", color: "#fff", textAlign: "center", letterSpacing: -0.5 },
  stepSub: { fontSize: 14, color: "#555", textAlign: "center", lineHeight: 21, marginBottom: 8 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 11, color: "#555", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  input: { backgroundColor: "#111", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 16, borderWidth: 1.5, borderColor: "#1e1e1e" },
  charCount: { fontSize: 11, color: "#333", textAlign: "right" },
  sportsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sportChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#141414", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#1e1e1e" },
  sportChipActive: { backgroundColor: "#FF450020", borderColor: "#FF4500" },
  sportEmoji: { fontSize: 18 },
  sportLabel: { fontSize: 13, color: "#555", fontWeight: "600" },
  sportLabelActive: { color: "#FF4500" },
  levelGrid: { gap: 10 },
  levelCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#141414", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#1e1e1e" },
  levelCardActive: { backgroundColor: "#FF450015", borderColor: "#FF4500" },
  levelEmoji: { fontSize: 28 },
  levelLabel: { fontSize: 16, fontWeight: "700", color: "#fff" },
  levelLabelActive: { color: "#FF4500" },
  levelDesc: { fontSize: 12, color: "#555", marginTop: 2, flex: 1 },
  timesRow: { flexDirection: "row", gap: 10 },
  timeChip: { flex: 1, alignItems: "center", backgroundColor: "#141414", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#1e1e1e", gap: 4 },
  timeChipActive: { backgroundColor: "#FF450015", borderColor: "#FF4500" },
  timeEmoji: { fontSize: 22 },
  timeLabel: { fontSize: 13, fontWeight: "700", color: "#fff" },
  timeSub: { fontSize: 10, color: "#444" },
  readyCard: { backgroundColor: "#141414", borderRadius: 20, padding: 24, alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#FF450033", marginTop: 8 },
  readyEmoji: { fontSize: 40 },
  readyTitle: { fontSize: 22, fontWeight: "900", color: "#fff" },
  readyText: { fontSize: 14, color: "#555", textAlign: "center", lineHeight: 21 },
  cta: { padding: 20, paddingBottom: 8 },
  nextBtn: { backgroundColor: "#FF4500", borderRadius: 16, paddingVertical: 18, alignItems: "center" },
  nextBtnText: { color: "#fff", fontWeight: "900", fontSize: 17 },
});
