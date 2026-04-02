import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "../../lib/supabase";
import { signInWithApple, isAppleAuthAvailable } from "../../lib/appleAuth";

function getStrength(pw: string): { label: string; color: string; bars: number } {
  if (pw.length < 6) return { label: "Too short", color: "#FF4500", bars: 1 };
  const has8    = pw.length >= 8;
  const hasUpper = /[A-Z]/.test(pw);
  const hasNum   = /[0-9]/.test(pw);
  const score = [has8, hasUpper, hasNum].filter(Boolean).length;
  if (score === 0) return { label: "Weak",   color: "#FF4500", bars: 1 };
  if (score === 1) return { label: "Weak",   color: "#FF4500", bars: 1 };
  if (score === 2) return { label: "Medium", color: "#F59E0B", bars: 2 };
  return              { label: "Strong", color: "#22C55E", bars: 3 };
}

export default function RegisterScreen() {
  const [email,          setEmail]          = useState("");
  const [password,       setPassword]       = useState("");
  const [confirm,        setConfirm]        = useState("");
  const [username,       setUsername]       = useState("");
  const [loading,        setLoading]        = useState(false);
  const [appleLoading,   setAppleLoading]   = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [focusedField,   setFocusedField]   = useState<string | null>(null);
  const [showPassword,   setShowPassword]   = useState(false);
  const [showConfirm,    setShowConfirm]    = useState(false);

  const strength     = password.length > 0 ? getStrength(password) : null;
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const canSubmit    = !!email && !!username && strength?.label === "Strong" && passwordsMatch;

  useEffect(() => {
    isAppleAuthAvailable().then(setAppleAvailable);
  }, []);

  async function handleRegister() {
    if (!email || !password || !username || !confirm) {
      Alert.alert("Error", "All fields are required");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Error", "Passwords don't match");
      return;
    }
    const s = getStrength(password);
    if (s.label !== "Strong") {
      Alert.alert("Weak Password", "Use 8+ characters with at least one uppercase letter and one number.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
    if (error) { setLoading(false); Alert.alert("Error", error.message); return; }
    if (data.user) {
      await supabase.from("users").upsert({ id: data.user.id, username });
      // Routing handled centrally by _layout.tsx (needsOnboarding check)
    } else {
      Alert.alert("Account created!", "Check your email to verify your account.");
    }
    setLoading(false);
  }

  async function handleAppleSignIn() {
    setAppleLoading(true);
    const result = await signInWithApple();
    setAppleLoading(false);
    if (result.status === "error") {
      Alert.alert("Apple Sign In Failed", result.message);
    }
    // Routing handled centrally by _layout.tsx (needsOnboarding check)
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>🚀</Text>
            </View>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Join thousands of fitness enthusiasts</Text>
          </View>

          <View style={styles.form}>
            {/* Username */}
            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={[styles.input, focusedField === "username" && styles.inputFocused]}
                placeholder="flexkral"
                placeholderTextColor="#333"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                onFocus={() => setFocusedField("username")}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, focusedField === "email" && styles.inputFocused]}
                placeholder="you@example.com"
                placeholderTextColor="#333"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Password + strength */}
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.inputInner, focusedField === "password" && styles.inputFocused]}
                  placeholder="8+ chars, uppercase, number"
                  placeholderTextColor="#333"
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                  <Text style={styles.eyeIcon}>{showPassword ? "🙈" : "👁️"}</Text>
                </TouchableOpacity>
              </View>
              {strength && (
                <View style={styles.strengthRow}>
                  {[1, 2, 3].map(i => (
                    <View
                      key={i}
                      style={[styles.strengthBar, { backgroundColor: i <= strength.bars ? strength.color : "#222" }]}
                    />
                  ))}
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                </View>
              )}
            </View>

            {/* Confirm Password */}
            <View style={styles.field}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.inputInner, focusedField === "confirm" && styles.inputFocused,
                    confirm.length > 0 && !passwordsMatch && { borderColor: "#FF4500" }]}
                  placeholder="Repeat your password"
                  placeholderTextColor="#333"
                  value={confirm}
                  onChangeText={setConfirm}
                  autoCapitalize="none"
                  secureTextEntry={!showConfirm}
                  onFocus={() => setFocusedField("confirm")}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(v => !v)}>
                  <Text style={styles.eyeIcon}>{showConfirm ? "🙈" : "👁️"}</Text>
                </TouchableOpacity>
              </View>
              {confirm.length > 0 && !passwordsMatch && (
                <Text style={styles.errorHint}>Passwords don't match</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.button, (!canSubmit || loading) && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={!canSubmit || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Create Account</Text>
              }
            </TouchableOpacity>

            {/* Apple Sign In */}
            {appleAvailable && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                {appleLoading ? (
                  <View style={styles.appleLoading}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.appleLoadingText}>Signing in with Apple...</Text>
                  </View>
                ) : (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={18}
                    style={styles.appleBtn}
                    onPress={handleAppleSignIn}
                  />
                )}
              </>
            )}

            <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/(auth)/login")} activeOpacity={0.7}>
              <Text style={styles.loginText}>
                Already have an account?{" "}
                <Text style={styles.loginLink}>Sign in</Text>
              </Text>
            </TouchableOpacity>

            <Text style={styles.legal}>By signing up, you agree to our Terms & Privacy Policy</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  backBtn: { marginTop: 8, marginBottom: 32, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 26, color: "#555" },
  header: { alignItems: "center", marginBottom: 40, gap: 10 },
  iconWrap: { width: 72, height: 72, borderRadius: 22, backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center", marginBottom: 8, borderWidth: 1, borderColor: "#222" },
  icon: { fontSize: 36 },
  title: { fontSize: 32, fontWeight: "900", color: "#fff", letterSpacing: -1 },
  subtitle: { fontSize: 15, color: "#555", textAlign: "center" },
  form: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 13, color: "#666", fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase" },
  input: {
    backgroundColor: "#111",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: "#FFF",
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: "#222",
  },
  inputFocused: { borderColor: "#FF4500", backgroundColor: "#130800" },
  button: {
    backgroundColor: "#FF4500",
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#FF4500",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  buttonDisabled: { opacity: 0.5, shadowOpacity: 0 },
  buttonText: { color: "#FFF", fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  loginBtn:         { alignItems: "center", paddingVertical: 4 },
  loginText:        { color: "#555", fontSize: 14 },
  loginLink:        { color: "#FF4500", fontWeight: "700" },
  legal:            { textAlign: "center", fontSize: 11, color: "#2a2a2a", marginTop: 4 },
  divider:          { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine:      { flex: 1, height: 1, backgroundColor: "#1a1a1a" },
  dividerText:      { color: "#333", fontSize: 13, fontWeight: "600" },
  appleBtn:         { width: "100%", height: 56 },
  appleLoading:     { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#111", borderRadius: 18, borderWidth: 1, borderColor: "#222" },
  appleLoadingText: { color: "#888", fontSize: 15, fontWeight: "600" },
  inputWrap:     { flexDirection: "row", alignItems: "center", backgroundColor: "#111", borderRadius: 16, borderWidth: 1.5, borderColor: "#222" },
  inputInner:    { flex: 1, paddingHorizontal: 18, paddingVertical: 16, color: "#FFF", fontSize: 16 },
  eyeBtn:        { paddingHorizontal: 14, paddingVertical: 14 },
  eyeIcon:       { fontSize: 18 },
  strengthRow:   { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  strengthBar:   { flex: 1, height: 3, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: "700", minWidth: 50 },
  errorHint:     { fontSize: 12, color: "#FF4500", marginTop: 2 },
});
