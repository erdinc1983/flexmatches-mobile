import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

export default function ForgotPasswordScreen() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSend() {
    const trimmed = email.trim();
    if (!trimmed) { setError("Please enter your email address."); return; }
    setLoading(true);
    setError(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: "flexmatchesmobile://reset-password",
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch {
      // Safe message — no account enumeration
      setError("We couldn't send a reset link. Please check your email and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>

          <View style={s.header}>
            <View style={s.iconWrap}>
              <Text style={s.icon}>🔑</Text>
            </View>
            <Text style={s.title}>Reset password</Text>
            <Text style={s.subtitle}>Enter your email and we'll send you a reset link</Text>
          </View>

          {sent ? (
            <View style={s.successCard}>
              <Text style={s.successIcon}>📬</Text>
              <Text style={s.successTitle}>Check your email</Text>
              <Text style={s.successSub}>
                If an account exists for {email.trim()}, you'll receive a password reset link shortly.
              </Text>
              <TouchableOpacity style={s.backToLogin} onPress={() => router.replace("/(auth)/login")} activeOpacity={0.8}>
                <Text style={s.backToLoginText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.form}>
              <View style={s.field}>
                <Text style={s.label}>Email</Text>
                <TextInput
                  style={s.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#333"
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(null); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoFocus
                />
              </View>

              {error && <Text style={s.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[s.button, loading && s.buttonDisabled]}
                onPress={handleSend}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.buttonText}>Send Reset Link</Text>
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
  container:       { flex: 1, backgroundColor: "#0A0A0A" },
  scroll:          { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  backBtn:         { marginTop: 8, marginBottom: 32, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backText:        { fontSize: 26, color: "#555" },
  header:          { alignItems: "center", marginBottom: 40, gap: 10 },
  iconWrap:        { width: 72, height: 72, borderRadius: 22, backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center", marginBottom: 8, borderWidth: 1, borderColor: "#222" },
  icon:            { fontSize: 36 },
  title:           { fontSize: 32, fontWeight: "900", color: "#fff", letterSpacing: -1 },
  subtitle:        { fontSize: 15, color: "#555", textAlign: "center" },
  form:            { gap: 20 },
  field:           { gap: 8 },
  label:           { fontSize: 13, color: "#666", fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase" },
  input:           { backgroundColor: "#111", borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, color: "#FFF", fontSize: 16, borderWidth: 1.5, borderColor: "#222" },
  errorText:       { fontSize: 13, color: "#FF4500", textAlign: "center" },
  button:          { backgroundColor: "#FF4500", borderRadius: 18, paddingVertical: 18, alignItems: "center", marginTop: 8, shadowColor: "#FF4500", shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  buttonDisabled:  { opacity: 0.5, shadowOpacity: 0 },
  buttonText:      { color: "#FFF", fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  successCard:     { backgroundColor: "#141414", borderRadius: 20, padding: 28, alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#2a2a2a" },
  successIcon:     { fontSize: 40 },
  successTitle:    { fontSize: 20, fontWeight: "800", color: "#fff" },
  successSub:      { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 21 },
  backToLogin:     { marginTop: 8, backgroundColor: "#FF4500", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, alignItems: "center" },
  backToLoginText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
