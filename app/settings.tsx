/**
 * Settings Screen
 *
 * Sections:
 *  - Account (email, change email, change password, sign out)
 *  - App Preferences (theme, units)
 *  - Privacy (hide_profile, hide_activity, hide_age, hide_city, hide_weight)
 *  - Notifications (push on/off + per-type prefs)
 *  - Help & Support (FAQ accordion, report bug, contact)
 *  - About (version)
 *  - Danger Zone (delete account)
 */

import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput, Alert, Modal, Switch, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { unregisterPushToken } from "../lib/push";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../lib/theme";
import { BlurOverlay } from "../components/ui/BlurOverlay";

// ─── Types ────────────────────────────────────────────────────────────────────
type Privacy = {
  hide_profile:  boolean;
  hide_activity: boolean;
  hide_age:      boolean;
  hide_city:     boolean;
  hide_weight:   boolean;
};

type NotifPrefs = {
  match_requests:    boolean;
  new_messages:      boolean;
  event_reminders:   boolean;
  community_posts:   boolean;
  challenge_updates: boolean;
  streak_reminders:  boolean;
};

const DEFAULT_PRIVACY: Privacy = {
  hide_profile: false, hide_activity: false, hide_age: false,
  hide_city: false, hide_weight: false,
};

const DEFAULT_NOTIF: NotifPrefs = {
  match_requests: true, new_messages: true, event_reminders: true,
  community_posts: false, challenge_updates: true, streak_reminders: true,
};

const FAQ_ITEMS = [
  { q: "How does matching work?",      a: "We match you with nearby fitness enthusiasts based on your sport preferences, schedule, fitness level, and goals." },
  { q: "Is my personal data safe?",    a: "Yes. We use Supabase with row-level security. Only you can access your private data. Use Privacy settings to control visibility." },
  { q: "How do I change my location?", a: "Go to your Profile and update your City field. We use your city to show nearby matches." },
  { q: "Can I pause my account?",      a: "Yes — toggle 'Hide my profile from Discover' in Privacy settings. Your data stays, but others won't see you." },
  { q: "How do I delete my account?",  a: "Scroll to Danger Zone below and tap Delete Account. This permanently removes all your data." },
];

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const { theme, isDark, setTheme } = useTheme();
  const c = theme.colors;

  const [loading,      setLoading]      = useState(true);
  const [userId,       setUserId]       = useState<string | null>(null);
  const [userEmail,    setUserEmail]    = useState("");
  const [units,        setUnits]        = useState<"imperial" | "metric">("imperial");
  const [privacy,      setPrivacyState] = useState<Privacy>(DEFAULT_PRIVACY);
  const [notifPrefs,   setNotifPrefs]   = useState<NotifPrefs>(DEFAULT_NOTIF);
  const [openFaq,      setOpenFaq]      = useState<number | null>(null);

  // Change email modal
  const [emailModal,   setEmailModal]   = useState(false);
  const [newEmail,     setNewEmail]     = useState("");
  const [emailSaving,  setEmailSaving]  = useState(false);
  const [emailMsg,     setEmailMsg]     = useState("");

  // Report bug modal
  const [reportModal,  setReportModal]  = useState(false);
  const [reportText,   setReportText]   = useState("");
  const [reportSaving, setReportSaving] = useState(false);
  const [reportSent,   setReportSent]   = useState(false);

  // Delete account modal
  const [deleteModal,  setDeleteModal]  = useState(false);
  const [deleteInput,  setDeleteInput]  = useState("");
  const [deleting,     setDeleting]     = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    setUserEmail(user.email ?? "");

    const { data } = await supabase
      .from("users")
      .select("units, notification_prefs, privacy_settings")
      .eq("id", user.id)
      .single();

    if (data) {
      setUnits((data.units as "imperial" | "metric") ?? "imperial");
      setNotifPrefs({ ...DEFAULT_NOTIF, ...(data.notification_prefs ?? {}) });
      setPrivacyState({ ...DEFAULT_PRIVACY, ...(data.privacy_settings ?? {}) });
    }
    setLoading(false);
  }

  // ── Savers ────────────────────────────────────────────────────────────────
  async function saveUnits(u: "imperial" | "metric") {
    setUnits(u);
    if (userId) await supabase.from("users").update({ units: u }).eq("id", userId);
  }

  async function updatePrivacy(key: keyof Privacy, val: boolean) {
    const next = { ...privacy, [key]: val };
    setPrivacyState(next);
    if (userId) await supabase.from("users").update({ privacy_settings: next }).eq("id", userId);
  }

  async function updateNotif(key: keyof NotifPrefs, val: boolean) {
    const next = { ...notifPrefs, [key]: val };
    setNotifPrefs(next);
    if (userId) await supabase.from("users").update({ notification_prefs: next }).eq("id", userId);
  }

  async function changeEmail() {
    if (!newEmail.trim() || emailSaving) return;
    setEmailSaving(true);
    setEmailMsg("");
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setEmailMsg(error ? `Error: ${error.message}` : "Verification email sent! Check your inbox.");
    setEmailSaving(false);
  }

  async function submitReport() {
    if (!reportText.trim() || reportSaving || !userId) return;
    setReportSaving(true);
    await supabase.from("bug_reports").insert({
      user_id: userId,
      message: reportText.trim(),
      created_at: new Date().toISOString(),
    });
    setReportSent(true);
    setReportSaving(false);
    setTimeout(() => { setReportModal(false); setReportText(""); setReportSent(false); }, 2000);
  }

  async function deleteAccount() {
    if (deleteInput !== "DELETE" || !userId || deleting) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Deletion failed");

      // Auth user is gone — sign out locally and redirect
      await supabase.auth.signOut();
      router.replace("/(auth)/welcome");
    } catch (err: any) {
      console.error("[deleteAccount]", err);
      Alert.alert("Error", err.message ?? "Could not delete account. Please try again.");
      setDeleting(false); // re-enable button so user can retry (AC5)
    }
  }

  async function resetPassword() {
    if (!userEmail) return;
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail);
    if (error) Alert.alert("Error", error.message);
    else Alert.alert("Check your email", "A password reset link has been sent.");
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.brand} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[s.back, { color: c.brand }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[s.title, { color: c.text }]}>Settings</Text>
        </View>

        {/* ── Account ── */}
        <SettingCard title="Account" description={userEmail} c={c}>
          <ActionRow label="✏️  Edit Profile"     onPress={() => router.push("/(tabs)/profile")} c={c} />
          <ActionRow label="📧  Change Email"      onPress={() => setEmailModal(true)} c={c} />
          <ActionRow label="🔑  Change Password"   onPress={resetPassword} c={c} />
          <ActionRow label="🚪  Sign Out"          onPress={() => {
            Alert.alert("Sign Out", "Are you sure?", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign Out", style: "destructive", onPress: async () => {
                await unregisterPushToken();
                await supabase.auth.signOut();
                router.replace("/(auth)/welcome");
              }},
            ]);
          }} c={c} />
        </SettingCard>

        {/* ── App Preferences ── */}
        <SettingCard title="App Preferences" description="Theme and units" c={c}>
          <View style={s.prefGroup}>
            <Text style={[s.prefLabel, { color: c.textMuted }]}>Theme</Text>
            <View style={[s.segRow, { backgroundColor: c.bgCardAlt }]}>
              {([["dark", "🌙 Dark"], ["light", "☀️ Light"]] as const).map(([val, label]) => (
                <TouchableOpacity
                  key={val}
                  style={[s.segBtn, (!isDark && val === "light") || (isDark && val === "dark")
                    ? { backgroundColor: c.brand } : {}]}
                  onPress={() => setTheme(val)}
                >
                  <Text style={[s.segText, { color: ((!isDark && val === "light") || (isDark && val === "dark")) ? "#fff" : c.textMuted }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.prefGroup}>
            <Text style={[s.prefLabel, { color: c.textMuted }]}>Units of measurement</Text>
            <View style={[s.segRow, { backgroundColor: c.bgCardAlt }]}>
              {([["imperial", "🇺🇸 lbs / mi"], ["metric", "🌍 kg / km"]] as const).map(([val, label]) => (
                <TouchableOpacity
                  key={val}
                  style={[s.segBtn, units === val ? { backgroundColor: c.brand } : {}]}
                  onPress={() => saveUnits(val)}
                >
                  <Text style={[s.segText, { color: units === val ? "#fff" : c.textMuted }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </SettingCard>

        {/* ── Privacy ── */}
        <SettingCard title="Privacy" description="Control what others see" c={c}>
          {([
            { key: "hide_profile",  label: "Hide my profile from Discover", desc: "Others won't find you in search" },
            { key: "hide_activity", label: "Hide my activity from partners", desc: "Workout stats hidden in chat" },
            { key: "hide_age",      label: "Hide my age",                   desc: "Age hidden on public profile" },
            { key: "hide_city",     label: "Hide my city",                  desc: "City hidden on public profile" },
            { key: "hide_weight",   label: "Hide my weight",                desc: "Weight hidden on public profile" },
          ] as { key: keyof Privacy; label: string; desc: string }[]).map(({ key, label, desc }, i, arr) => (
            <View key={key} style={[s.toggleRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: SPACE[12] }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.toggleLabel, { color: c.textSecondary }]}>{label}</Text>
                <Text style={[s.toggleDesc, { color: c.textMuted }]}>{desc}</Text>
              </View>
              <Switch
                value={privacy[key]}
                onValueChange={v => updatePrivacy(key, v)}
                trackColor={{ false: c.border, true: c.brand + "88" }}
                thumbColor={privacy[key] ? c.brand : c.textMuted}
              />
            </View>
          ))}
        </SettingCard>

        {/* ── Notifications ── */}
        <SettingCard title="Notifications" description="Manage what you get notified about" c={c}>
          {([
            { key: "match_requests",    label: "🤝  Match requests" },
            { key: "new_messages",      label: "💬  New messages" },
            { key: "event_reminders",   label: "📅  Event reminders" },
            { key: "community_posts",   label: "🌍  Community posts" },
            { key: "challenge_updates", label: "🏆  Challenge updates" },
            { key: "streak_reminders",  label: "🔥  Streak reminders" },
          ] as { key: keyof NotifPrefs; label: string }[]).map(({ key, label }, i, arr) => (
            <View key={key} style={[s.toggleRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: SPACE[12] }]}>
              <Text style={[s.toggleLabel, { color: c.textSecondary, flex: 1 }]}>{label}</Text>
              <Switch
                value={notifPrefs[key]}
                onValueChange={v => updateNotif(key, v)}
                trackColor={{ false: c.border, true: c.brand + "88" }}
                thumbColor={notifPrefs[key] ? c.brand : c.textMuted}
              />
            </View>
          ))}
        </SettingCard>

        {/* ── Help & Support ── */}
        <SettingCard title="Help & Support" c={c}>
          <Text style={[s.faqHeader, { color: c.textMuted }]}>FREQUENTLY ASKED QUESTIONS</Text>
          {FAQ_ITEMS.map((item, i) => (
            <View key={i} style={[s.faqItem, { borderBottomColor: c.border }]}>
              <TouchableOpacity style={s.faqQ} onPress={() => setOpenFaq(openFaq === i ? null : i)}>
                <Text style={[s.faqQText, { color: c.textSecondary }]}>{item.q}</Text>
                <Text style={[s.faqChevron, { color: c.textMuted }]}>{openFaq === i ? "▲" : "▼"}</Text>
              </TouchableOpacity>
              {openFaq === i && (
                <Text style={[s.faqA, { color: c.textMuted }]}>{item.a}</Text>
              )}
            </View>
          ))}
          <ActionRow label="🐛  Report a Bug or Issue"  onPress={() => setReportModal(true)} c={c} />
          <ActionRow label="📩  Contact Support"        onPress={() => Linking.openURL("mailto:support@flexmatches.com")} c={c} />
        </SettingCard>

        {/* ── About ── */}
        <SettingCard title="About" c={c}>
          <InfoRow label="Version"  value="1.0.0 (MVP 9)" c={c} />
          <InfoRow label="Platform" value="FlexMatches iOS" c={c} />
          <InfoRow label="Build"    value="2026 · Beta" c={c} />
        </SettingCard>

        {/* ── Danger Zone ── */}
        <SettingCard title="Danger Zone" c={c}>
          <ActionRow
            label="🗑️  Delete Account"
            onPress={() => setDeleteModal(true)}
            c={c}
            danger
          />
        </SettingCard>

      </ScrollView>

      {/* ── Change Email Modal ── */}
      <Modal visible={emailModal} transparent animationType="slide" onRequestClose={() => { setEmailModal(false); setEmailMsg(""); setNewEmail(""); }}>
        <BlurOverlay onPress={() => { setEmailModal(false); setEmailMsg(""); setNewEmail(""); }}>
          <View style={s.overlayInner}>
          <View style={[s.modalBox, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>Change Email</Text>
            <Text style={[s.modalSub, { color: c.textMuted }]}>Current: {userEmail}</Text>
            <TextInput
              style={[s.modalInput, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text }]}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="new@email.com"
              placeholderTextColor={c.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {!!emailMsg && (
              <Text style={[s.modalMsg, { color: emailMsg.startsWith("Error") ? PALETTE.error : PALETTE.success }]}>
                {emailMsg}
              </Text>
            )}
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.modalCancel, { borderColor: c.border }]} onPress={() => { setEmailModal(false); setEmailMsg(""); setNewEmail(""); }}>
                <Text style={[s.modalCancelText, { color: c.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalOk, { backgroundColor: newEmail.trim() ? c.brand : c.bgCardAlt }, emailSaving && { opacity: 0.6 }]}
                onPress={changeEmail}
                disabled={!newEmail.trim() || emailSaving}
              >
                {emailSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalOkText}>Send Verification</Text>}
              </TouchableOpacity>
            </View>
          </View>
          </View>
        </BlurOverlay>
      </Modal>

      {/* ── Report Bug Modal ── */}
      <Modal visible={reportModal} transparent animationType="slide" onRequestClose={() => setReportModal(false)}>
        <BlurOverlay onPress={() => setReportModal(false)}>
          <View style={s.overlayInner}>
          <View style={[s.modalBox, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>Report a Bug or Issue</Text>
            {reportSent ? (
              <View style={s.reportSent}>
                <Text style={s.reportSentEmoji}>✅</Text>
                <Text style={[s.reportSentText, { color: PALETTE.success }]}>Report sent! Thank you.</Text>
              </View>
            ) : (
              <>
                <TextInput
                  style={[s.modalInput, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text, height: 100, textAlignVertical: "top" }]}
                  value={reportText}
                  onChangeText={setReportText}
                  placeholder="Describe the issue you encountered..."
                  placeholderTextColor={c.textMuted}
                  multiline
                />
                <View style={s.modalBtns}>
                  <TouchableOpacity style={[s.modalCancel, { borderColor: c.border }]} onPress={() => setReportModal(false)}>
                    <Text style={[s.modalCancelText, { color: c.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.modalOk, { backgroundColor: reportText.trim() ? c.brand : c.bgCardAlt }, reportSaving && { opacity: 0.6 }]}
                    onPress={submitReport}
                    disabled={!reportText.trim() || reportSaving}
                  >
                    {reportSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalOkText}>Submit Report</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
          </View>
        </BlurOverlay>
      </Modal>

      {/* ── Delete Account Modal ── */}
      <Modal visible={deleteModal} transparent animationType="fade" onRequestClose={() => { setDeleteModal(false); setDeleteInput(""); }}>
        <BlurOverlay onPress={() => { setDeleteModal(false); setDeleteInput(""); }}>
          <View style={s.overlayInner}>
          <View style={[s.modalBox, { backgroundColor: c.bgCard, borderColor: PALETTE.error + "44" }]}>
            <Text style={[s.modalTitle, { color: c.text, textAlign: "center" }]}>⚠️ Delete Account</Text>
            <Text style={[s.modalSub, { color: c.textMuted, textAlign: "center", lineHeight: 20 }]}>
              This will permanently delete your profile, matches, goals, and all data. This cannot be undone.
            </Text>
            <Text style={[s.deleteHint, { color: c.textMuted }]}>
              Type <Text style={{ color: PALETTE.error, fontWeight: "700" }}>DELETE</Text> to confirm:
            </Text>
            <TextInput
              style={[s.modalInput, { backgroundColor: c.bgInput, borderColor: PALETTE.error + "44", color: c.text }]}
              value={deleteInput}
              onChangeText={setDeleteInput}
              placeholder="DELETE"
              placeholderTextColor={c.textMuted}
              autoCapitalize="characters"
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.modalCancel, { borderColor: c.border }]} onPress={() => { setDeleteModal(false); setDeleteInput(""); }}>
                <Text style={[s.modalCancelText, { color: c.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalOk, { backgroundColor: deleteInput === "DELETE" ? PALETTE.error : c.bgCardAlt }, deleting && { opacity: 0.6 }]}
                onPress={deleteAccount}
                disabled={deleteInput !== "DELETE" || deleting}
              >
                {deleting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalOkText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
          </View>
        </BlurOverlay>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SettingCard({ title, description, children, c }: {
  title: string; description?: string; children: React.ReactNode; c: any;
}) {
  return (
    <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
      <View style={s.cardHeader}>
        <Text style={[s.cardTitle, { color: c.brand }]}>{title.toUpperCase()}</Text>
        {description && <Text style={[s.cardDesc, { color: c.textMuted }]}>{description}</Text>}
      </View>
      <View style={s.cardBody}>{children}</View>
    </View>
  );
}

function ActionRow({ label, onPress, c, danger }: { label: string; onPress: () => void; c: any; danger?: boolean }) {
  return (
    <TouchableOpacity style={[s.actionRow, { borderColor: danger ? PALETTE.error + "33" : c.border }]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[s.actionLabel, { color: danger ? PALETTE.error : c.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function InfoRow({ label, value, c }: { label: string; value: string; c: any }) {
  return (
    <View style={s.infoRow}>
      <Text style={[s.infoLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[s.infoValue, { color: c.textFaint }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { paddingHorizontal: SPACE[16], paddingBottom: SPACE[60], gap: SPACE[14] },

  header: { paddingTop: SPACE[16], paddingBottom: SPACE[8], gap: SPACE[4] },
  back:   { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, marginBottom: SPACE[4] },
  title:  { fontSize: FONT.size.xxxl, fontWeight: FONT.weight.black, letterSpacing: -0.5 },

  card:       { borderRadius: RADIUS.xl, borderWidth: 1, overflow: "hidden" },
  cardHeader: { paddingHorizontal: SPACE[16], paddingTop: SPACE[14], paddingBottom: SPACE[6] },
  cardTitle:  { fontSize: 11, fontWeight: FONT.weight.extrabold, letterSpacing: 0.5 },
  cardDesc:   { fontSize: FONT.size.sm, marginTop: 2 },
  cardBody:   { paddingHorizontal: SPACE[16], paddingBottom: SPACE[14], gap: SPACE[10] },

  actionRow:   { paddingVertical: SPACE[12], paddingHorizontal: SPACE[4], borderRadius: RADIUS.md, borderWidth: 1 },
  actionLabel: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold },

  toggleRow:   { flexDirection: "row", alignItems: "center", gap: SPACE[12] },
  toggleLabel: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold },
  toggleDesc:  { fontSize: FONT.size.xs },

  prefGroup: { gap: SPACE[8] },
  prefLabel: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 0.6 },
  segRow:    { flexDirection: "row", borderRadius: RADIUS.lg, padding: 4, gap: 4 },
  segBtn:    { flex: 1, paddingVertical: SPACE[10], borderRadius: RADIUS.md, alignItems: "center" },
  segText:   { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },

  faqHeader:  { fontSize: 10, fontWeight: FONT.weight.bold, letterSpacing: 0.5, marginBottom: SPACE[4] },
  faqItem:    { borderBottomWidth: 1, paddingBottom: SPACE[8] },
  faqQ:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: SPACE[10] },
  faqQText:   { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, flex: 1, paddingRight: SPACE[8] },
  faqChevron: { fontSize: 12 },
  faqA:       { fontSize: FONT.size.sm, lineHeight: 20, paddingBottom: SPACE[4] },

  infoRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  infoLabel: { fontSize: FONT.size.base },
  infoValue: { fontSize: FONT.size.base },

  // Modals
  overlay:       { flex: 1, backgroundColor: "#00000099", justifyContent: "flex-end" },
  overlayInner:  { flex: 1, justifyContent: "flex-end" },
  modalBox:      { borderRadius: RADIUS.xl, borderWidth: 1, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: SPACE[24], gap: SPACE[12] },
  modalTitle:    { fontSize: FONT.size.lg, fontWeight: FONT.weight.black },
  modalSub:      { fontSize: FONT.size.sm, lineHeight: 18 },
  modalInput:    { borderRadius: RADIUS.lg, borderWidth: 1.5, paddingHorizontal: SPACE[14], paddingVertical: SPACE[12], fontSize: FONT.size.md },
  modalMsg:      { fontSize: FONT.size.sm, lineHeight: 18 },
  modalBtns:     { flexDirection: "row", gap: SPACE[10], marginTop: SPACE[4] },
  modalCancel:   { flex: 1, paddingVertical: SPACE[14], borderRadius: RADIUS.lg, borderWidth: 1, alignItems: "center" },
  modalCancelText: { fontWeight: FONT.weight.bold },
  modalOk:       { flex: 1, paddingVertical: SPACE[14], borderRadius: RADIUS.lg, alignItems: "center" },
  modalOkText:   { color: "#fff", fontWeight: FONT.weight.extrabold },

  deleteHint: { fontSize: FONT.size.sm },
  reportSent: { alignItems: "center", paddingVertical: SPACE[20], gap: SPACE[8] },
  reportSentEmoji: { fontSize: 40 },
  reportSentText:  { fontSize: FONT.size.md, fontWeight: FONT.weight.bold },
});
