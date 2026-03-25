/**
 * ProfileSheet
 *
 * A centered modal card for reviewing a potential partner's profile.
 * Shown when tapping a PersonCard. Keeps the main list undisturbed.
 */

import React from "react";
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, TouchableWithoutFeedback,
} from "react-native";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../../lib/theme";
import { Icon } from "../Icon";
import { Avatar } from "../Avatar";
import { RequestStatus, DiscoverUser } from "./PersonCard";

const { height: H, width: W } = Dimensions.get("window");

const LEVEL_COLOR: Record<string, string> = {
  beginner: "#22C55E", intermediate: "#F59E0B", advanced: "#FF4500",
};
const TAG_PALETTE: Array<[string, string]> = [
  ["#FF450018", "#FF4500"], ["#22C55E18", "#22C55E"], ["#3B82F618", "#3B82F6"],
];
const SLOT_LABEL: Record<string, string> = {
  morning: "Mornings", afternoon: "Afternoons", evening: "Evenings", weekend: "Weekends",
};

type Props = {
  user:      DiscoverUser | null;
  status:    RequestStatus;
  onConnect: () => void;
  onClose:   () => void;
};

export function ProfileSheet({ user, status, onConnect, onClose }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (!user) return null;

  const levelColor = user.fitness_level ? LEVEL_COLOR[user.fitness_level] : c.textMuted;
  const scheduleSlots = Object.entries((user.availability as Record<string, boolean>) ?? {})
    .filter(([, v]) => v).map(([k]) => SLOT_LABEL[k] ?? k);

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      {/* Backdrop — tap to close */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.backdrop} />
      </TouchableWithoutFeedback>

      {/* Centered card */}
      <View style={s.centeredWrap} pointerEvents="box-none">
        <View style={[s.card, { backgroundColor: c.bgCard, maxHeight: H * 0.80 }]}>

          {/* Close button */}
          <TouchableOpacity style={[s.closeBtn, { backgroundColor: c.bgCardAlt }]} onPress={onClose} hitSlop={8}>
            <Icon name="close" size={16} color={c.textMuted} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

            {/* ── Avatar + name ───────────────────────────────────── */}
            <View style={s.heroCol}>
              <View style={s.avatarWrap}>
                <Avatar url={user.avatar_url} name={user.full_name ?? user.username} size={72} />
                {user.is_at_gym && (
                  <View style={[s.gymDot, { backgroundColor: PALETTE.success, borderColor: c.bgCard }]} />
                )}
              </View>
              <View style={s.nameBlock}>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: SPACE[6], justifyContent: "center" }}>
                  <Text style={[s.name, { color: c.text }]}>{user.full_name ?? user.username}</Text>
                  {user.age != null && (
                    <Text style={[s.age, { color: c.textMuted }]}>{user.age}</Text>
                  )}
                </View>
                <Text style={[s.username, { color: c.textMuted }]}>@{user.username}</Text>
                {user.is_at_gym && (
                  <View style={s.atGymRow}>
                    <View style={s.atGymDot} />
                    <Text style={s.atGymText}>At the gym now</Text>
                  </View>
                )}
              </View>
            </View>

            {/* ── Stats row ───────────────────────────────────────── */}
            <View style={[s.statsRow, { borderColor: c.border }]}>
              {user.fitness_level && (
                <StatCell label="Level" value={user.fitness_level} valueColor={levelColor} />
              )}
              {user.current_streak >= 1 && (
                <StatCell label="Streak" value={`${user.current_streak}d`} valueColor={c.brand} />
              )}
              {user.city && (
                <StatCell label="City" value={user.city} valueColor={c.text} />
              )}
            </View>

            {/* ── Why this match ──────────────────────────────────── */}
            {user.reasons.length > 0 && (
              <View style={[s.section, { borderColor: c.border }]}>
                <Text style={[s.sectionTitle, { color: c.textMuted }]}>Why you match</Text>
                <View style={s.tagsRow}>
                  {user.reasons.map((r, i) => {
                    const [bg, fg] = TAG_PALETTE[i % TAG_PALETTE.length];
                    return (
                      <View key={r} style={[s.tag, { backgroundColor: bg }]}>
                        <Text style={[s.tagText, { color: fg }]}>{r}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── Bio ─────────────────────────────────────────────── */}
            {user.bio && (
              <View style={[s.section, { borderColor: c.border }]}>
                <Text style={[s.sectionTitle, { color: c.textMuted }]}>About</Text>
                <Text style={[s.bio, { color: c.textSecondary }]}>{user.bio}</Text>
              </View>
            )}

            {/* ── Sports ──────────────────────────────────────────── */}
            {(user.sports ?? []).length > 0 && (
              <View style={[s.section, { borderColor: c.border }]}>
                <Text style={[s.sectionTitle, { color: c.textMuted }]}>Activities</Text>
                <View style={s.tagsRow}>
                  {(user.sports ?? []).map((sp) => (
                    <View key={sp} style={[s.sportChip, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                      <Text style={[s.sportText, { color: c.textSecondary }]}>{sp}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Schedule ────────────────────────────────────────── */}
            {scheduleSlots.length > 0 && (
              <View style={[s.section, { borderColor: c.border }]}>
                <Text style={[s.sectionTitle, { color: c.textMuted }]}>Trains</Text>
                <Text style={[s.scheduleText, { color: c.textSecondary }]}>
                  {scheduleSlots.join(" · ")}
                </Text>
              </View>
            )}

            {/* ── CTA ─────────────────────────────────────────────── */}
            <View style={s.cta}>
              {status === "none" && (
                <TouchableOpacity
                  style={[s.requestBtn, { backgroundColor: c.brand }]}
                  onPress={() => { onConnect(); onClose(); }}
                  activeOpacity={0.85}
                >
                  <Icon name="matchActive" size={18} color="#fff" />
                  <Text style={s.requestText}>Send Request</Text>
                </TouchableOpacity>
              )}
              {status === "pending" && (
                <View style={[s.stateRow, { borderColor: c.borderMedium }]}>
                  <Icon name="clock" size={16} color={c.textMuted} />
                  <Text style={[s.stateText, { color: c.textMuted }]}>Request sent — waiting for response</Text>
                </View>
              )}
              {status === "accepted" && (
                <View style={[s.stateRow, { borderColor: "#166534" }]}>
                  <Icon name="checkActive" size={16} color="#22C55E" />
                  <Text style={[s.stateText, { color: "#22C55E" }]}>You're matched — open Chat to coordinate</Text>
                </View>
              )}
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function StatCell({ label, value, valueColor }: { label: string; value: string; valueColor: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={s.statCell}>
      <Text style={[s.statValue, { color: valueColor }]}>{value}</Text>
      <Text style={[s.statLabel, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

const CARD_W = Math.min(W - SPACE[32], 400);

const s = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  centeredWrap:{ ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  card:        { width: CARD_W, borderRadius: RADIUS.xxl, overflow: "hidden" },

  closeBtn:    { position: "absolute", top: SPACE[14], right: SPACE[14], zIndex: 10, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },

  content:  { padding: SPACE[20], gap: SPACE[16], paddingBottom: SPACE[24] },

  heroCol:   { alignItems: "center", gap: SPACE[10] },
  avatarWrap:{ width: 72, height: 72 },
  gymDot:    { position: "absolute", bottom: 2, right: 2, width: 16, height: 16, borderRadius: 8, borderWidth: 2.5, zIndex: 1 },
  nameBlock: { alignItems: "center", gap: SPACE[4] },
  name:      { fontSize: FONT.size.xxl, fontWeight: FONT.weight.black, letterSpacing: -0.3, textAlign: "center" },
  age:       { fontSize: FONT.size.lg, fontWeight: FONT.weight.medium, paddingBottom: 2 },
  username:  { fontSize: FONT.size.sm, textAlign: "center" },
  atGymRow:  { flexDirection: "row", alignItems: "center", gap: SPACE[4] },
  atGymDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22C55E" },
  atGymText: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold, color: "#22C55E" },

  statsRow:  { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: SPACE[14] },
  statCell:  { flex: 1, alignItems: "center", gap: SPACE[2] },
  statValue: { fontSize: FONT.size.lg, fontWeight: FONT.weight.black, textTransform: "capitalize" },
  statLabel: { fontSize: FONT.size.xs, fontWeight: FONT.weight.medium, textTransform: "uppercase", letterSpacing: 0.5 },

  section:      { borderTopWidth: 1, paddingTop: SPACE[14], gap: SPACE[8] },
  sectionTitle: { fontSize: FONT.size.xs, fontWeight: FONT.weight.extrabold, textTransform: "uppercase", letterSpacing: 1 },

  tagsRow:   { flexDirection: "row", flexWrap: "wrap", gap: SPACE[6] },
  tag:       { paddingHorizontal: SPACE[10], paddingVertical: 4, borderRadius: RADIUS.pill },
  tagText:   { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  sportChip: { paddingHorizontal: SPACE[10], paddingVertical: SPACE[4], borderRadius: RADIUS.sm, borderWidth: 1 },
  sportText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium },

  bio:          { fontSize: FONT.size.base, lineHeight: FONT.size.base * 1.6 },
  scheduleText: { fontSize: FONT.size.base },

  cta:        { marginTop: SPACE[4] },
  requestBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE[8], borderRadius: RADIUS.lg, paddingVertical: SPACE[16] },
  requestText:{ color: "#fff", fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },
  stateRow:   { flexDirection: "row", alignItems: "center", gap: SPACE[8], borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACE[14] },
  stateText:  { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium, flex: 1 },
});
