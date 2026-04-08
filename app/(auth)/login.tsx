import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar,
} from "react-native";
import { Image } from "expo-image";
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
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
            <Image
              source={require("../../assets/images/icon.png")}
              style={styles.logoImg}
              contentFit="contain"
            />
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
                placeholderTextColor="#BBBBBB"
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
                  placeholderTextColor="#BBBBBB"
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
                    <ActivityIndicator color="#555" size="small" />
                    <Text style={styles.appleLoadingText}>Signing in with Apple...</Text>
                  </View>
                ) : (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={14}
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
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#EFEFEF" },
  dividerText: { color: "#BBB", fontSize: 13, fontWeight: "600" },
  forgotBtn:        { alignSelf: "flex-end", paddingVertical: 4 },
  forgotText:       { color: "#FF6B00", fontSize: 13, fontWeight: "600" },
  registerBtn:      { alignItems: "center", paddingVertical: 4 },
  registerText:     { color: "#888", fontSize: 14 },
  registerLink:     { color: "#FF6B00", fontWeight: "700" },
  appleBtn:         { width: "100%", height: 52 },
  appleLoading:     { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#F5F5F5", borderRadius: 14, borderWidth: 1, borderColor: "#E8E8E8" },
  appleLoadingText: { color: "#888", fontSize: 15, fontWeight: "600" },
  inputWrap:  { flexDirection: "row", alignItems: "center", backgroundColor: "#F5F5F5", borderRadius: 14, borderWidth: 1.5, borderColor: "#E8E8E8" },
  inputInner: { flex: 1, paddingHorizontal: 18, paddingVertical: 15, color: "#111", fontSize: 16 },
  eyeBtn:     { paddingHorizontal: 14, paddingVertical: 14 },
  eyeIcon:    { fontSize: 18 },
  errorHint:  { fontSize: 12, color: "#E53E3E", marginTop: 2 },
});
