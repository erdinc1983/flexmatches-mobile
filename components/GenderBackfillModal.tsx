/**
 * GenderBackfillModal
 *
 * One-time prompt for users created before gender was a required
 * onboarding field. Shown over any tab when the user's gender is
 * NULL after `resolveAppState` resolves to "ready". Cannot be
 * dismissed without picking a value.
 *
 * Without this, the migration-19 server-side restrictive default
 * (NULL caller treated as male for hide_from_male) would penalize
 * legitimate non-male existing accounts.
 */

import { useState } from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { useAppData } from "../lib/appDataContext";
import { useTheme, SPACE, FONT, RADIUS } from "../lib/theme";

const GENDER_OPTIONS = [
  { value: "male",              label: "Male" },
  { value: "female",            label: "Female" },
  { value: "non_binary",        label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export function GenderBackfillModal({ visible }: { visible: boolean }) {
  const { theme } = useTheme();
  const { appUser, refreshAppUser } = useAppData();
  const c = theme.colors;
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function save() {
    if (!selected || !appUser) return;
    setSaving(true);
    setError(null);
    const { error: dbError } = await supabase
      .from("users")
      .update({ gender: selected })
      .eq("id", appUser.id);
    if (dbError) {
      setError("Couldn't save. Please try again.");
      setSaving(false);
      return;
    }
    await refreshAppUser();
    // refreshAppUser updates appUser.gender; parent unmounts the modal
    // because `visible` becomes false. No setState here to avoid leaks.
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: c.bg }]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          <View style={styles.head}>
            <Text style={[styles.title, { color: c.textSecondary }]}>One quick thing</Text>
            <Text style={[styles.sub, { color: c.textMuted }]}>
              We added gender as a privacy + matching field. Pick one to keep your filters working
              correctly. You can change it any time in Profile → Edit.
            </Text>
          </View>

          <View style={styles.list}>
            {GENDER_OPTIONS.map((g) => {
              const active = selected === g.value;
              return (
                <TouchableOpacity
                  key={g.value}
                  style={[
                    styles.row,
                    { backgroundColor: c.bgCard, borderColor: active ? c.brand : c.border },
                    active && { borderWidth: 2 },
                  ]}
                  onPress={() => setSelected(g.value)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.rowLabel, { color: active ? c.brand : c.textSecondary }]}>
                    {g.label}
                  </Text>
                  <View style={[styles.radio, { borderColor: active ? c.brand : c.border }]}>
                    {active && <View style={[styles.radioInner, { backgroundColor: c.brand }]} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {error && <Text style={[styles.error, { color: "#FF4500" }]}>{error}</Text>}

          <TouchableOpacity
            style={[
              styles.cta,
              { backgroundColor: selected ? c.brand : c.bgCard, opacity: saving ? 0.7 : 1 },
            ]}
            onPress={save}
            disabled={!selected || saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={[styles.ctaText, { color: selected ? "#fff" : c.textMuted }]}>Save</Text>
            }
          </TouchableOpacity>

          <Text style={[styles.privacyNote, { color: c.textFaint }]}>
            Your gender is used by Discover and Home matching, and by the Privacy controls
            (hide-from-male / hide-from-female) so they apply correctly. We do not share it
            beyond the app.
          </Text>

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { padding: SPACE[20], gap: SPACE[20] },
  head:         { gap: SPACE[8], marginTop: SPACE[20] },
  title:        { fontSize: FONT.size.xl, fontWeight: FONT.weight.bold, letterSpacing: -0.8 },
  sub:          { fontSize: FONT.size.base, lineHeight: 22 },
  list:         { gap: SPACE[10] },
  row:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACE[16], borderRadius: RADIUS.lg, borderWidth: 1 },
  rowLabel:     { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold },
  radio:        { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner:   { width: 12, height: 12, borderRadius: 6 },
  cta:          { padding: SPACE[16], borderRadius: RADIUS.lg, alignItems: "center", marginTop: SPACE[8] },
  ctaText:      { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold },
  error:        { fontSize: FONT.size.sm, textAlign: "center" },
  privacyNote:  { fontSize: FONT.size.sm, lineHeight: 18, textAlign: "center", marginTop: SPACE[12] },
});
