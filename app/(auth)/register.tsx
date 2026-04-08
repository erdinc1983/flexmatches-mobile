import { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar, Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PENDING_REF_KEY } from "../_layout";

const TERMS_URL   = "https://www.flexmatches.com/terms";
const PRIVACY_URL = "https://www.flexmatches.com/privacy-policy";
import { Image } from "expo-image";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "../../lib/supabase";
import { signInWithApple, isAppleAuthAvailable } from "../../lib/appleAuth";

function getStrength(pw: string): { label: string; color: string; bars: number } {
  if (pw.length < 6) return { label: "Too short", color: "#E53E3E", bars: 1 };
  const has8    = pw.length >= 8;
  const hasUpper = /[A-Z]/.test(pw);
  const hasNum   = /[0-9]/.test(pw);
  const score = [has8, hasUpper, hasNum].filter(Boolean).length;
  if (score === 0) return { label: "Weak",   color: "#E53E3E", bars: 1 };
  if (score === 1) return { label: "Weak",   color: "#E53E3E", bars: 1 };
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

  const [emailError,      setEmailError]      = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus]  = useState<"idle" | "checking" | "available" | "taken">("idle");
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function validateEmail(v: string) {
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    setEmailError(valid || v.length === 0 ? null : "Please enter a valid email address");
  }

  const strength       = password.length > 0 ? getStrength(password) : null;
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const canSubmit      = !!email && !!username && strength?.label === "Strong" && passwordsMatch
                         && usernameStatus === "available";

  function handleUsernameChange(v: string) {
    setUsername(v);
    setUsernameStatus("idle");
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    if (v.trim().length < 3) return;
    setUsernameStatus("checking");
    usernameTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("users")
        .select("id")
        .eq("username", v.trim().toLowerCase())
        .maybeSingle();
      setUsernameStatus(data ? "taken" : "available");
    }, 300);
  }

  useEffect(() => {
    isAppleAuthAvailable().then(setAppleAvailable);
  }, []);

  async function handleRegister() {
    if (!email || !password || !username || !confirm) {
      Alert.alert("Error", "All fields are required");
      return;
    }
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!validEmail) {
      setEmailError("Please enter a valid email address");
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
    const normalizedUsername = username.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username: normalizedUsername } } });
    if (error) { setLoading(false); Alert.alert("Error", error.message); return; }
    if (data.user) {
      await supabase.from("users").upsert({ id: data.user.id, username: normalizedUsername });
      // Apply pending referral code (fire-and-forget)
      const refCode = await AsyncStorage.getItem(PENDING_REF_KEY);
      if (refCode) {
        const { data: referrer } = await supabase
          .from("users")
          .select("id")
          .eq("referral_code", refCode)
          .neq("id", data.user.id)
          .maybeSingle();
        if (referrer) {
          await supabase.from("referrals").insert({
            referrer_id: referrer.id,
            referred_user_id: data.user.id,
          }).then(() => AsyncStorage.removeItem(PENDING_REF_KEY));
        } else {
          await AsyncStorage.removeItem(PENDING_REF_KEY);
        }
      }
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Image
              source={require("../../assets/images/icon.png")}
              style={styles.logoImg}
              contentFit="contain"
            />
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Join thousands of fitness enthusiasts</Text>
          </View>

          <View style={styles.form}>
            {/* Username */}
            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.inputInner, focusedField === "username" && styles.inputFocused,
                    usernameStatus === "taken" && { borderColor: "#E53E3E" }]}
                  placeholder="flexkral"
                  placeholderTextColor="#333"
                  value={username}
                  onChangeText={handleUsernameChange}
                  autoCapitalize="none"
                  onFocus={() => setFocusedField("username")}
                  onBlur={() => setFocusedField(null)}
                />
                {usernameStatus === "checking" && (
                  <ActivityIndicator size="small" color="#888" style={{ paddingRight: 14 }} />
                )}
                {usernameStatus === "available" && (
                  <Text style={{ paddingRight: 14, fontSize: 18 }}>✅</Text>
                )}
                {usernameStatus === "taken" && (
                  <Text style={{ paddingRight: 14, fontSize: 18 }}>❌</Text>
                )}
              </View>
              {usernameStatus === "taken" && (
                <Text style={styles.errorHint}>Username already taken</Text>
              )}
              {usernameStatus === "available" && (
                <Text style={[styles.errorHint, { color: "#22C55E" }]}>Username available</Text>
              )}
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, focusedField === "email" && styles.inputFocused]}
                placeholder="you@example.com"
                placeholderTextColor="#333"
                value={email}
                onChangeText={v => { setEmail(v); if (emailError) validateEmail(v); }}
                autoCapitalize="none"
                keyboardType="email-address"
                onFocus={() => setFocusedField("email")}
                onBlur={() => { setFocusedField(null); validateEmail(email); }}
              />
              {emailError && <Text style={styles.errorHint}>{emailError}</Text>}
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
                    confirm.length > 0 && !passwordsMatch && { borderColor: "#E53E3E" }]}
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

            <TouchableOpacity style={styles.loginBtn} onPress={() => router.replace("/(auth)/login")} activeOpacity={0.7}>
              <Text style={styles.loginText}>
                Already have an account?{" "}
                <Text style={styles.loginLink}>Sign in</Text>
              </Text>
            </TouchableOpacity>

            <Text style={styles.legal}>
              By signing up, you agree to our{" "}
              <Text style={styles.legalLink} onPress={() => Linking.openURL(TERMS_URL)}>Terms</Text>
              {" & "}
              <Text style={styles.legalLink} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  backBtn: { marginTop: 8, marginBottom: 24, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 26, color: "#999" },
  header: { alignItems: "center", marginBottom: 36, gap: 8 },
  logoImg: { width: 80, height: 80, borderRadius: 20, marginBottom: 8 },
  title: { fontSize: 30, fontWeight: "900", color: "#111", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: "#888", textAlign: "center" },
  form: { gap: 18 },
  field: { gap: 7 },
  label: { fontSize: 12, color: "#888", fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 15,
    color: "#111",
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
  },
  inputFocused: { borderColor: "#FF6B00", backgroundColor: "#FFF8F3" },
  button: {
    backgroundColor: "#FF6B00",
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#FF6B00",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  buttonDisabled: { opacity: 0.45, shadowOpacity: 0 },
  buttonText: { color: "#FFF", fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  loginBtn:         { alignItems: "center", paddingVertical: 4 },
  loginText:        { color: "#888", fontSize: 14 },
  loginLink:        { color: "#FF6B00", fontWeight: "700" },
  legal:            { textAlign: "center", fontSize: 11, color: "#BBB", marginTop: 4 },
  legalLink:        { color: "#FF6B00", textDecorationLine: "underline" },
  divider:          { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine:      { flex: 1, height: 1, backgroundColor: "#EFEFEF" },
  dividerText:      { color: "#BBB", fontSize: 13, fontWeight: "600" },
  appleBtn:         { width: "100%", height: 52 },
  appleLoading:     { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#F5F5F5", borderRadius: 14, borderWidth: 1, borderColor: "#E8E8E8" },
  appleLoadingText: { color: "#888", fontSize: 15, fontWeight: "600" },
  inputWrap:     { flexDirection: "row", alignItems: "center", backgroundColor: "#F5F5F5", borderRadius: 14, borderWidth: 1.5, borderColor: "#E8E8E8" },
  inputInner:    { flex: 1, paddingHorizontal: 18, paddingVertical: 15, color: "#111", fontSize: 16 },
  eyeBtn:        { paddingHorizontal: 14, paddingVertical: 14 },
  eyeIcon:       { fontSize: 18 },
  strengthRow:   { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  strengthBar:   { flex: 1, height: 3, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: "700", minWidth: 50 },
  errorHint:     { fontSize: 12, color: "#E53E3E", marginTop: 2 },
});
