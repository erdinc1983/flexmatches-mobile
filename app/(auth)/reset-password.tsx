import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

// Mirrors the signup strength rules in app/(auth)/register.tsx so a
// reset can never weaken account security below the bar new accounts
// must clear. Two definitions intentionally — keep them in sync.
function getStrength(pw: string): { label: string; color: string; bars: number } {
  if (pw.length < 6) return { label: "Too short", color: "#E53E3E", bars: 1 };
  const has8     = pw.length >= 8;
  const hasUpper = /[A-Z]/.test(pw);
  const hasNum   = /[0-9]/.test(pw);
  const score = [has8, hasUpper, hasNum].filter(Boolean).length;
  if (score <= 1) return { label: "Weak",   color: "#E53E3E", bars: 1 };
  if (score === 2) return { label: "Medium", color: "#F59E0B", bars: 2 };
  return              { label: "Strong", color: "#22C55E", bars: 3 };
}

export default function ResetPasswordScreen() {
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const strength = password.length > 0 ? getStrength(password) : null;

  async function handleReset() {
    if (!password) { setError("Please enter a new password."); return; }
    const s = getStrength(password);
    if (s.label !== "Strong") {
      setError("Use at least 8 characters with one uppercase letter and one number.");
      return;
    }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
    } catch {
      setError("Could not update your password. The reset link may have expired. Please request a new one.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <View style={s.header}>
            <View style={s.iconWrap}>
              <Text style={s.icon}>🔒</Text>
            </View>
            <Text style={s.title}>New password</Text>
            <Text style={s.subtitle}>Choose a strong password for your account</Text>
          </View>

          {done ? (
            <View style={s.successCard}>
              <Text style={s.successIcon}>✅</Text>
              <Text style={s.successTitle}>Password updated!</Text>
              <Text style={s.successSub}>Your password has been changed. Sign in with your new password.</Text>
              <TouchableOpacity style={s.signInBtn} onPress={() => router.replace("/(auth)/login")} activeOpacity={0.8}>
                <Text style={s.signInBtnText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.form}>
              <View style={s.field}>
                <Text style={s.label}>New Password</Text>
                <TextInput
                  style={s.input}
                  placeholder="8+ chars, upper, number"
                  placeholderTextColor="#333"
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(null); }}
                  secureTextEntry
                  autoFocus
                />
                {strength && (
                  <View style={s.strengthRow}>
                    {[1, 2, 3].map((i) => (
                      <View
                        key={i}
                        style={[s.strengthBar, { backgroundColor: i <= strength.bars ? strength.color : "#222" }]}
                      />
                    ))}
                    <Text style={[s.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                  </View>
                )}
              </View>

              <View style={s.field}>
                <Text style={s.label}>Confirm Password</Text>
                <TextInput
                  style={s.input}
                  placeholder="Repeat new password"
                  placeholderTextColor="#333"
                  value={confirm}
                  onChangeText={(t) => { setConfirm(t); setError(null); }}
                  secureTextEntry
                />
              </View>

              {error && <Text style={s.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[s.button, loading && s.buttonDisabled]}
                onPress={handleReset}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.buttonText}>Update Password</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#0A0A0A" },
  scroll:         { flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  header:         { alignItems: "center", marginBottom: 40, gap: 10 },
  iconWrap:       { width: 72, height: 72, borderRadius: 22, backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center", marginBottom: 8, borderWidth: 1, borderColor: "#222" },
  icon:           { fontSize: 36 },
  title:          { fontSize: 32, fontWeight: "900", color: "#fff", letterSpacing: -1 },
  subtitle:       { fontSize: 15, color: "#555", textAlign: "center" },
  form:           { gap: 20 },
  field:          { gap: 8 },
  label:          { fontSize: 13, color: "#666", fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase" },
  input:          { backgroundColor: "#111", borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, color: "#FFF", fontSize: 16, borderWidth: 1.5, borderColor: "#222" },
  errorText:      { fontSize: 13, color: "#FF4500", textAlign: "center" },
  button:         { backgroundColor: "#FF4500", borderRadius: 18, paddingVertical: 18, alignItems: "center", marginTop: 8, shadowColor: "#FF4500", shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  buttonDisabled: { opacity: 0.5, shadowOpacity: 0 },
  buttonText:     { color: "#FFF", fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  successCard:    { backgroundColor: "#141414", borderRadius: 20, padding: 28, alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#2a2a2a" },
  successIcon:    { fontSize: 40 },
  successTitle:   { fontSize: 20, fontWeight: "800", color: "#fff" },
  successSub:     { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 21 },
  signInBtn:      { marginTop: 8, backgroundColor: "#FF4500", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, alignItems: "center" },
  signInBtnText:  { color: "#fff", fontSize: 15, fontWeight: "700" },
  strengthRow:    { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  strengthBar:    { flex: 1, height: 3, borderRadius: 2 },
  strengthLabel:  { fontSize: 12, fontWeight: "700", minWidth: 50 },
});
