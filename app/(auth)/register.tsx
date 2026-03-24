import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  async function handleRegister() {
    if (!email || !password || !username) {
      Alert.alert("Error", "All fields are required");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
    if (error) { setLoading(false); Alert.alert("Error", error.message); return; }
    if (data.user) {
      await supabase.from("users").upsert({ id: data.user.id, username });
      setLoading(false);
      router.replace("/(auth)/onboarding");
      return;
    }
    setLoading(false);
    Alert.alert("Account created!", "Check your email to verify your account.");
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
            {[
              { key: "username", label: "Username", placeholder: "flexkral", value: username, onChange: setUsername, autoCapitalize: "none" as const, keyboard: "default" as const },
              { key: "email", label: "Email", placeholder: "you@example.com", value: email, onChange: setEmail, autoCapitalize: "none" as const, keyboard: "email-address" as const },
              { key: "password", label: "Password", placeholder: "Min. 6 characters", value: password, onChange: setPassword, autoCapitalize: "none" as const, keyboard: "default" as const, secure: true },
            ].map((field) => (
              <View key={field.key} style={styles.field}>
                <Text style={styles.label}>{field.label}</Text>
                <TextInput
                  style={[styles.input, focusedField === field.key && styles.inputFocused]}
                  placeholder={field.placeholder}
                  placeholderTextColor="#333"
                  value={field.value}
                  onChangeText={field.onChange}
                  autoCapitalize={field.autoCapitalize}
                  keyboardType={field.keyboard}
                  secureTextEntry={field.secure}
                  onFocus={() => setFocusedField(field.key)}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Create Account</Text>
              }
            </TouchableOpacity>

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
  loginBtn: { alignItems: "center", paddingVertical: 4 },
  loginText: { color: "#555", fontSize: 14 },
  loginLink: { color: "#FF4500", fontWeight: "700" },
  legal: { textAlign: "center", fontSize: 11, color: "#2a2a2a", marginTop: 4 },
});
