import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert, StatusBar, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { CityAutocomplete } from "../../components/CityAutocomplete";

const { width } = Dimensions.get("window");
const TOTAL_STEPS = 5;

const INTENT_OPTIONS = [
  { value: "guidance", label: "I want guidance",        emoji: "📚", desc: "Learning from someone more experienced" },
  { value: "teaching", label: "I enjoy helping others", emoji: "🎓", desc: "Mentoring and motivating a partner" },
  { value: "equal",    label: "Equal training partner", emoji: "🤝", desc: "Push each other at the same level" },
];

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
  const [step,        setStep]        = useState(1);
  const [saving,      setSaving]      = useState(false);
  const [nameBlurred, setNameBlurred] = useState(false);

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

  // Step 5
  const [trainingIntent, setTrainingIntent] = useState("");

  function toggleSport(s: string) {
    setSports((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  function toggleTime(t: string) {
    setPreferredTimes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  async function finish() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("users").update({
        full_name:       fullName.trim() || null,
        bio:             bio.trim() || null,
        sports:          sports.length > 0 ? sports : null,
        fitness_level:   fitnessLevel || null,
        availability:    preferredTimes.length > 0 ? preferredTimes : null,
        city:            city.trim() || null,
        training_intent: trainingIntent || null,
      }).eq("id", user.id);

      if (error) throw error;
      router.replace("/(tabs)/home");
    } catch {
      Alert.alert("Couldn't save your profile. Please check your connection and try again.");
      // stays on current step — all state is preserved
    } finally {
      setSaving(false);
    }
  }

  async function savePartial() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("users").update({
      full_name:       fullName.trim() || null,
      bio:             bio.trim() || null,
      sports:          sports.length > 0 ? sports : null,
      fitness_level:   fitnessLevel || null,
      availability:    preferredTimes.length > 0 ? preferredTimes : null,
      city:            city.trim() || null,
      training_intent: trainingIntent || null,
    }).eq("id", user.id);
  }

  function next() {
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
    else finish();
  }

  async function skip() {
    await savePartial();
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
    else router.replace("/(tabs)/home");
  }

  function back() {
    if (step > 1) setStep((s) => s - 1);
    else router.back();
  }

  const canNext = () => {
    if (step === 1) return fullName.trim().length >= 2;
    if (step === 2) return sports.length > 0;
    if (step === 3) return fitnessLevel.length > 0;
    return true; // steps 4 & 5 are optional
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Progress bar */}
      <View style={s.progressBar}>
        <View style={[s.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={back} style={s.backBtn} hitSlop={8}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.stepLabel}>{step} of {TOTAL_STEPS}</Text>
        {step === 1 ? (
          <View style={{ width: 36 }} />
        ) : (
          <TouchableOpacity onPress={skip} hitSlop={8}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Step 1: Name + Bio */}
        {step === 1 && (
          <View style={s.stepContent}>
            <View style={s.stepHead}>
              <Text style={s.stepTitle}>What's your name?</Text>
              <Text style={s.stepSub}>Let your future partners know who you are</Text>
            </View>
            <View style={s.field}>
              <Text style={s.fieldLabel}>Full Name</Text>
              <TextInput
                style={s.input}
                value={fullName}
                onChangeText={setFullName}
                onBlur={() => setNameBlurred(true)}
                placeholder="e.g. Alex Johnson"
                placeholderTextColor="#444"
                autoFocus
                maxLength={50}
              />
              {nameBlurred && fullName.trim().length < 2 && (
                <Text style={s.fieldError}>Name is required</Text>
              )}
            </View>
            <View style={s.field}>
              <Text style={s.fieldLabel}>Short Bio <Text style={s.optional}>(optional)</Text></Text>
              <TextInput
                style={[s.input, { height: 88, textAlignVertical: "top", paddingTop: 14 }]}
                value={bio}
                onChangeText={setBio}
                placeholder="I love morning runs and heavy lifts..."
                placeholderTextColor="#444"
                multiline
                maxLength={120}
              />
              <Text style={s.charCount}>{bio.length}/120</Text>
            </View>
          </View>
        )}

        {/* Step 2: Sports */}
        {step === 2 && (
          <View style={s.stepContent}>
            <View style={s.stepHead}>
              <Text style={s.stepTitle}>What do you train?</Text>
              <Text style={s.stepSub}>Pick all that apply</Text>
            </View>
            <View style={s.chipGrid}>
              {SPORTS.map((sport) => {
                const active = sports.includes(sport.label);
                return (
                  <TouchableOpacity
                    key={sport.label}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => toggleSport(sport.label)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>
                      {sport.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Step 3: Fitness Level + Times */}
        {step === 3 && (
          <View style={s.stepContent}>
            <View style={s.stepHead}>
              <Text style={s.stepTitle}>Your fitness level</Text>
              <Text style={s.stepSub}>We'll match you with people at your level</Text>
            </View>
            <View style={s.optionList}>
              {FITNESS_LEVELS.map((l) => {
                const active = fitnessLevel === l.value;
                return (
                  <TouchableOpacity
                    key={l.value}
                    style={[s.optionRow, active && s.optionRowActive]}
                    onPress={() => setFitnessLevel(l.value)}
                    activeOpacity={0.8}
                  >
                    <View style={s.optionText}>
                      <Text style={[s.optionTitle, active && { color: "#FF4500" }]}>{l.label}</Text>
                      <Text style={s.optionDesc}>{l.desc}</Text>
                    </View>
                    <View style={[s.radioOuter, active && s.radioOuterActive]}>
                      {active && <View style={s.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[s.fieldLabel, { marginTop: 28 }]}>
              Preferred times <Text style={s.optional}>(optional)</Text>
            </Text>
            <View style={s.chipGrid}>
              {TIME_OPTIONS.map((t) => {
                const active = preferredTimes.includes(t.value);
                return (
                  <TouchableOpacity
                    key={t.value}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => toggleTime(t.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>{t.label}</Text>
                    <Text style={[s.chipSub, active && { color: "#FF450099" }]}>{t.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Step 4: City */}
        {step === 4 && (
          <View style={s.stepContent}>
            <View style={s.stepHead}>
              <Text style={s.stepTitle}>Where do you train?</Text>
              <Text style={s.stepSub}>Connect with partners in your city</Text>
            </View>
            <View style={[s.field, { zIndex: 20 }]}>
              <Text style={s.fieldLabel}>City <Text style={s.optional}>(optional)</Text></Text>
              <CityAutocomplete
                value={city}
                onChangeText={setCity}
                inputStyle={s.input}
                autoFocus
              />
            </View>
          </View>
        )}

        {/* Step 5: Training Intent */}
        {step === 5 && (
          <View style={s.stepContent}>
            <View style={s.stepHead}>
              <Text style={s.stepTitle}>Your training style</Text>
              <Text style={s.stepSub}>Help us find partners who complement your goals</Text>
            </View>
            <View style={s.optionList}>
              {INTENT_OPTIONS.map((opt) => {
                const active = trainingIntent === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.optionRow, active && s.optionRowActive]}
                    onPress={() => setTrainingIntent(opt.value)}
                    activeOpacity={0.8}
                  >
                    <View style={s.optionText}>
                      <Text style={[s.optionTitle, active && { color: "#FF4500" }]}>{opt.label}</Text>
                      <Text style={s.optionDesc}>{opt.desc}</Text>
                    </View>
                    <View style={[s.radioOuter, active && s.radioOuterActive]}>
                      {active && <View style={s.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={s.allSetCard}>
              <Text style={s.allSetTitle}>You're all set 🎉</Text>
              <Text style={s.allSetSub}>
                Start discovering workout partners who match your schedule and sport.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* CTA */}
      <View style={s.cta}>
        <TouchableOpacity
          style={[s.nextBtn, !canNext() && { opacity: 0.35 }]}
          onPress={next}
          disabled={!canNext() || saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.nextBtnText}>
                {step === TOTAL_STEPS ? "Let's go" : "Continue"}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  // Layout
  container:       { flex: 1, backgroundColor: "#0A0A0A" },
  progressBar:     { height: 2, backgroundColor: "#1c1c1c" },
  progressFill:    { height: 2, backgroundColor: "#FF4500" },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 },
  backBtn:         { padding: 4 },
  backText:        { fontSize: 22, color: "#666" },
  stepLabel:       { fontSize: 13, color: "#444", fontWeight: "500" },
  skipText:        { fontSize: 13, color: "#555", fontWeight: "500" },
  scroll:          { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  stepContent:     { gap: 24 },

  // Step header
  stepHead:        { gap: 8, paddingTop: 8 },
  stepTitle:       { fontSize: 26, fontWeight: "800", color: "#fff", letterSpacing: -0.5, lineHeight: 32 },
  stepSub:         { fontSize: 14, color: "#666", lineHeight: 20 },

  // Form
  field:           { gap: 8 },
  fieldLabel:      { fontSize: 11, color: "#555", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  optional:        { color: "#3a3a3a", fontWeight: "400", textTransform: "none" as any },
  input:           { backgroundColor: "#111", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 15, borderWidth: 1, borderColor: "#222" },
  charCount:       { fontSize: 11, color: "#3a3a3a", textAlign: "right" },
  fieldError:      { fontSize: 12, color: "#FF4500", marginTop: 4 },

  // Chips — Nextdoor style: border-only unselected, filled active
  chipGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:            { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: "#2a2a2a", gap: 2 },
  chipActive:      { backgroundColor: "#FF4500", borderColor: "#FF4500" },
  chipText:        { fontSize: 14, color: "#888", fontWeight: "500" },
  chipTextActive:  { color: "#fff", fontWeight: "600" },
  chipSub:         { fontSize: 10, color: "#555", textAlign: "center" },

  // Option rows (fitness level / intent) — radio style
  optionList:      { gap: 10 },
  optionRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#141414", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#1e1e1e" },
  optionRowActive: { borderColor: "#FF4500", backgroundColor: "#FF450008" },
  optionText:      { flex: 1, gap: 3 },
  optionTitle:     { fontSize: 15, fontWeight: "600", color: "#fff" },
  optionDesc:      { fontSize: 12, color: "#555", lineHeight: 17 },
  radioOuter:      { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: "#333", alignItems: "center", justifyContent: "center", marginLeft: 12 },
  radioOuterActive:{ borderColor: "#FF4500" },
  radioInner:      { width: 10, height: 10, borderRadius: 5, backgroundColor: "#FF4500" },

  // All set card (step 5)
  allSetCard:      { backgroundColor: "#141414", borderRadius: 16, padding: 20, gap: 6, borderWidth: 1, borderColor: "#2a2a2a" },
  allSetTitle:     { fontSize: 16, fontWeight: "700", color: "#fff" },
  allSetSub:       { fontSize: 13, color: "#666", lineHeight: 19 },

  // CTA
  cta:             { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 },
  nextBtn:         { backgroundColor: "#FF4500", borderRadius: 999, paddingVertical: 17, alignItems: "center" },
  nextBtnText:     { color: "#fff", fontWeight: "700", fontSize: 16 },
});
