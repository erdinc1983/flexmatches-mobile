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

export default function LoginScreen() {
  const [email,          setEmail]          = useState("");
  const [password,       setPassword]       = useState("");
  const [loading,        setLoading]        = useState(false);
  const [appleLoading,   setAppleLoading]   = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [focusedField,   setFocusedField]   = useState<string | null>(null);
  const [showPassword,   setShowPassword]   = useState(false);
  const [emailError,     setEmailError]     = useState<string | null>(null);

  function validateEmail(v: string) {
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    setEmailError(valid || v.length === 0 ? null : "Please enter a valid email address");
  }

  useEffect(() => {
    isAppleAuthAvailable().then(setAppleAvailable);
  }, []);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Error", "Email and password are required");
      return;
    }
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!validEmail) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert("Login Failed", error.message);
  }

  async function handleAppleSignIn() {
    setAppleLoading(true);
    const result = await signInWithApple();
    setAppleLoading(false);
    if (result.status === "error") {
      Alert.alert("Apple Sign In Failed", result.message);
    }
    // Routing handled centrally by _layout.tsx
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>👋</Text>
            </View>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue your fitness journey</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
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
            </View>
            {emailError && <Text style={styles.errorHint}>{emailError}</Text>}

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrap, focusedField === "password" && styles.inputFocused]}>
                <TextInput
                  style={styles.inputInner}
                  placeholder="••••••••"
                  placeholderTextColor="#333"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                  <Text style={styles.eyeIcon}>{showPassword ? "🙈" : "👁️"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => router.push("/(auth)/forgot-password")}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Sign In</Text>
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
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={18}
                    style={styles.appleBtn}
                    onPress={handleAppleSignIn}
                  />
                )}
              </>
            )}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => router.replace("/(auth)/register")}
              activeOpacity={0.7}
            >
              <Text style={styles.registerText}>
                Don't have an account?{" "}
                <Text style={styles.registerLink}>Create one</Text>
              </Text>
            </TouchableOpacity>
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
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#1a1a1a" },
  dividerText: { color: "#333", fontSize: 13, fontWeight: "600" },
  forgotBtn:        { alignSelf: "flex-end", paddingVertical: 4 },
  forgotText:       { color: "#FF4500", fontSize: 13, fontWeight: "600" },
  registerBtn:      { alignItems: "center", paddingVertical: 4 },
  registerText:     { color: "#555", fontSize: 14 },
  registerLink:     { color: "#FF4500", fontWeight: "700" },
  appleBtn:         { width: "100%", height: 56 },
  appleLoading:     { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#111", borderRadius: 18, borderWidth: 1, borderColor: "#222" },
  appleLoadingText: { color: "#888", fontSize: 15, fontWeight: "600" },
  inputWrap:  { flexDirection: "row", alignItems: "center", backgroundColor: "#111", borderRadius: 16, borderWidth: 1.5, borderColor: "#222" },
  inputInner: { flex: 1, paddingHorizontal: 18, paddingVertical: 16, color: "#FFF", fontSize: 16 },
  eyeBtn:     { paddingHorizontal: 14, paddingVertical: 14 },
  eyeIcon:    { fontSize: 18 },
  errorHint:  { fontSize: 12, color: "#FF4500", marginTop: 2 },
});
