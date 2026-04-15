/**
 * ProfileSheet
 *
 * A centered modal card for reviewing a potential partner's profile.
 * Shown when tapping a PersonCard. Keeps the main list undisturbed.
 *
 * Safety: 3-dot menu (⋯) → Block | Report
 */

import React, { useState } from "react";
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, Alert, ActivityIndicator, Pressable,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../../lib/theme";
import { Icon } from "../Icon";
import { resolveUrl } from "../Avatar";
import { cartoonAvatar } from "../../lib/avatarFallback";
import { supabase } from "../../lib/supabase";
import { RequestStatus, DiscoverUser } from "./PersonCard";

// cartoonAvatar lives in lib/avatarFallback.ts (shared, gender-aware)

const { height: H, width: W } = Dimensions.get("window");

const LEVEL_COLOR: Record<string, string> = {
  beginner: "#22C55E", intermediate: "#F59E0B", advanced: "#FF4500",
};
const TAG_PALETTE: [string, string][] = [
  ["#FF450018", "#FF4500"], ["#22C55E18", "#22C55E"], ["#3B82F618", "#3B82F6"],
];
const SLOT_LABEL: Record<string, string> = {
  morning: "Mornings", afternoon: "Afternoons", evening: "Evenings", weekend: "Weekends",
};

const REPORT_REASONS = [
  "Inappropriate behavior",
  "Fake profile",
  "Harassment",
  "Spam",
  "Other",
];

type Props = {
  user:      DiscoverUser | null;
  status:    RequestStatus;
  onConnect: () => void;
  onClose:   () => void;
  onBlock?:  (userId: string) => void;
};

export function ProfileSheet({ user, status, onConnect, onClose, onBlock }: Props) {
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const [menuOpen,    setMenuOpen]    = useState(false);
  const [showReport,  setShowReport]  = useState(false);
  const [actioning,   setActioning]   = useState(false);
  const [reported,    setReported]    = useState(false);

  if (!user) return null;
  // Capture in a narrowed local so closures don't lose the null check
  const u = user;

  const scheduleSlots = Object.entries((u.availability as Record<string, boolean>) ?? {})
    .filter(([, v]) => v).map(([k]) => SLOT_LABEL[k] ?? k);

  async function handleBlock() {
    setActioning(true);
    const { data: { user: me } } = await supabase.auth.getUser();
    if (!me) { setActioning(false); return; }
    await supabase.from("blocks").insert({ blocker_id: me.id, blocked_id: u.id });
    setActioning(false);
    setMenuOpen(false);
    onBlock?.(u.id);
    onClose();
  }

  async function handleReport(reason: string) {
    setActioning(true);
    const { data: { user: me } } = await supabase.auth.getUser();
    if (!me) { setActioning(false); return; }
    await supabase.from("reports").insert({ reporter_id: me.id, reported_id: u.id, reason });
    setActioning(false);
    setShowReport(false);
    setMenuOpen(false);
    setReported(true);
  }

  function confirmBlock() {
    setMenuOpen(false);
    Alert.alert(
      "Block user?",
      `${u.full_name ?? u.username} will no longer appear in your Discover or contact you.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Block", style: "destructive", onPress: handleBlock },
      ],
    );
  }

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      {/* Blurred backdrop — tap outside to close */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => { setMenuOpen(false); setShowReport(false); onClose(); }}>
        <BlurView
          intensity={isDark ? 40 : 50}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.backdropDim} />
      </Pressable>

      {/* Centered card — tap inside does not close */}
      <Pressable style={s.centeredWrap} onPress={() => { setMenuOpen(false); setShowReport(false); onClose(); }}>
        <Pressable onPress={(e) => e.stopPropagation()} style={[s.card, { backgroundColor: c.bgCard, maxHeight: H * 0.82 }]}>

          {/* Close button — matches AppModal style */}
          <TouchableOpacity style={[s.closeBtn, { backgroundColor: c.bgCardAlt, borderColor: c.border }]} onPress={onClose} hitSlop={8}>
            <Text style={[s.closeX, { color: c.textMuted }]}>✕</Text>
          </TouchableOpacity>

          {/* 3-dot safety menu */}
          <TouchableOpacity
            style={[s.menuBtn, { backgroundColor: c.bgCardAlt }]}
            onPress={() => { setMenuOpen((v) => !v); setShowReport(false); }}
            hitSlop={8}
          >
            <Text style={[s.menuDots, { color: c.textMuted }]}>⋯</Text>
          </TouchableOpacity>

          {/* Dropdown menu */}
          {menuOpen && (
            <View style={[s.dropdown, { backgroundColor: c.bgCard, borderColor: c.border, shadowColor: c.text }]}>
              <TouchableOpacity style={s.dropItem} onPress={confirmBlock} disabled={actioning}>
                <Text style={[s.dropItemText, { color: "#EF4444" }]}>🚫  Block user</Text>
              </TouchableOpacity>
              <View style={[s.dropDivider, { backgroundColor: c.border }]} />
              <TouchableOpacity style={s.dropItem} onPress={() => { setShowReport(true); setMenuOpen(false); }} disabled={actioning}>
                <Text style={[s.dropItemText, { color: c.textSecondary }]}>⚠️  Report</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Report reason modal */}
          {showReport && (
            <View style={[s.reportCard, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
              <View style={s.reportHeader}>
                <Text style={[s.reportTitle, { color: c.text }]}>Why are you reporting?</Text>
                <TouchableOpacity onPress={() => setShowReport(false)} hitSlop={8}>
                  <Icon name="close" size={14} color={c.textMuted} />
                </TouchableOpacity>
              </View>
              {reported ? (
                <Text style={[s.reportedText, { color: PALETTE.success }]}>✓ Reported — we'll review it shortly</Text>
              ) : (
                REPORT_REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={[s.reportReason, { borderColor: c.border }]}
                    onPress={() => handleReport(reason)}
                    disabled={actioning}
                  >
                    {actioning
                      ? <ActivityIndicator size="small" color={c.brand} />
                      : <Text style={[s.reportReasonText, { color: c.textSecondary }]}>{reason}</Text>
                    }
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* ── Full-width photo header ──────────────────────────── */}
          {(() => {
            const rawName     = user.full_name ?? user.username;
            const isUUID      = /^[0-9a-f-]{20,}$/i.test(rawName);
            const displayName = isUUID ? "Member" : rawName;
            const photoUrl    = resolveUrl(user.avatar_url) ?? cartoonAvatar(displayName, user.gender);
            const levelColor  = user.fitness_level ? LEVEL_COLOR[user.fitness_level] : "#9CA3AF";
            return (
              <View style={s.photoHeader}>
                <Image
                  source={{ uri: photoUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  placeholder={{ blurhash: "LKHBBd~q9F%M%MIUofRj00M{D%of" }}
                  transition={200}
                />
                <LinearGradient
                  colors={["rgba(0,0,0,0.0)", "rgba(0,0,0,0.0)", "rgba(0,0,0,0.75)"]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                {user.is_at_gym && (
                  <View style={s.gymBadge}>
                    <View style={s.gymDotBadge} />
                    <Text style={s.gymBadgeText}>At gym</Text>
                  </View>
                )}
                <View style={s.photoNameOverlay}>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: SPACE[8] }}>
                    <Text style={s.photoName} numberOfLines={1}>{displayName}</Text>
                    {user.age != null && <Text style={s.photoAge}>{user.age}</Text>}
                    {user.phone_verified && (
                      <View style={s.verifiedBadge}>
                        <Text style={s.verifiedText}>✓ Verified</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE[8], flexWrap: "wrap" }}>
                    {user.fitness_level && (
                      <View style={[s.levelBadge, { backgroundColor: levelColor + "30", borderColor: levelColor + "70" }]}>
                        <Text style={[s.levelText, { color: levelColor }]}>{user.fitness_level}</Text>
                      </View>
                    )}
                    {user.city && (
                      <Text style={s.photoMeta}>📍 {user.city}</Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })()}

          {/* The ScrollView sizes itself: maxHeight caps it (so dense
              profiles scroll within the card) but it shrinks to its content
              when there's little to show (so sparse profiles don't waste
              space). The earlier `flex: 1` only works when the parent has
              a constrained height — the card here only has maxHeight, so
              flex:1 measured to 0 and the body collapsed to nothing,
              which is what made the sheet look like "just a picture." */}
          <ScrollView
            style={{ maxHeight: H * 0.55 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.content}
            nestedScrollEnabled
          >

            {/* ── Stats row ───────────────────────────────────────── */}
            {(user.current_streak >= 1 || user.matchScore > 0 || user.sessions_completed > 0) && (
              <View style={[s.statsRow, { borderColor: c.border }]}>
                {user.current_streak >= 1 && (
                  <StatCell label="Streak" value={`${user.current_streak}d`} valueColor={c.brand} />
                )}
                {user.matchScore > 0 && (
                  <StatCell label="Match" value={`${user.matchScore}%`} valueColor={
                    user.matchScore >= 70 ? PALETTE.success : user.matchScore >= 45 ? "#3B82F6" : "#F59E0B"
                  } />
                )}
                {user.fitness_level && (
                  <StatCell label="Level" value={user.fitness_level} valueColor={
                    user.fitness_level === "beginner" ? "#22C55E" : user.fitness_level === "intermediate" ? "#F59E0B" : "#FF4500"
                  } />
                )}
                {user.sessions_completed > 0 && (
                  <StatCell label="Sessions" value={`${user.sessions_completed}`} valueColor="#22C55E" />
                )}
                {user.sessions_completed >= 3 && (
                  <StatCell label="Reliable" value={`${user.reliability_score}%`} valueColor={
                    user.reliability_score >= 80 ? "#22C55E" : user.reliability_score >= 50 ? "#F59E0B" : "#FF4500"
                  } />
                )}
              </View>
            )}

            {/* ── Training intent ──────────────────────────────────── */}
            {user.training_intent && (
              <View style={[s.intentChip, { backgroundColor: c.brandSubtle, borderColor: c.brandBorder }]}>
                <Text style={[s.intentText, { color: c.brand }]}>
                  {user.training_intent === "guidance" ? "📚 Wants guidance" :
                   user.training_intent === "teaching" ? "🎓 Loves helping others" :
                                                         "🤝 Equal partner"}
                </Text>
              </View>
            )}

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

            {/* ── Sparse-profile empty state ──────────────────────── */}
            {/* Every body section above is conditional. When a member is
                brand new and hasn't filled anything in (no bio, no sports,
                no schedule, no streak, no reasons), the body collapses to
                nothing and the sheet looks like "just a picture". Show a
                friendly fallback so the user knows there IS a person here. */}
            {!user.bio
              && (user.sports ?? []).length === 0
              && scheduleSlots.length === 0
              && user.reasons.length === 0
              && !user.training_intent
              && user.current_streak < 1
              && user.matchScore < 1
              && (
              <View style={[s.section, { borderColor: c.border }]}>
                <Text style={[s.sectionTitle, { color: c.textMuted }]}>About</Text>
                <Text style={[s.bio, { color: c.textMuted, fontStyle: "italic" }]}>
                  This member is new — they haven't filled out their profile yet.
                  Send a request to start a conversation.
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
        </Pressable>
      </Pressable>
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
  backdropDim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.30)" },
  centeredWrap:{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACE[20] },
  card:        { width: CARD_W, borderRadius: RADIUS.xxl, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10 },

  closeBtn:    { position: "absolute", top: SPACE[14], right: SPACE[14], zIndex: 10, width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  closeX:      { fontSize: 13, fontWeight: FONT.weight.bold, lineHeight: 16 },
  menuBtn:     { position: "absolute", top: SPACE[14], left: SPACE[14], zIndex: 10, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  menuDots:    { fontSize: 18, fontWeight: "700", letterSpacing: 1 },

  // Dropdown
  dropdown:    { position: "absolute", top: SPACE[48], left: SPACE[14], zIndex: 20, borderRadius: RADIUS.xl, borderWidth: 1, minWidth: 160, shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 10, overflow: "hidden" },
  dropItem:    { paddingHorizontal: SPACE[16], paddingVertical: SPACE[12] },
  dropItemText:{ fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  dropDivider: { height: 1 },

  // Report
  reportCard:    { position: "absolute", top: SPACE[48], left: SPACE[14], right: SPACE[14], zIndex: 20, borderRadius: RADIUS.xl, borderWidth: 1, padding: SPACE[14], gap: SPACE[4], elevation: 10 },
  reportHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE[8] },
  reportTitle:   { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  reportReason:  { paddingVertical: SPACE[10], borderBottomWidth: 1 },
  reportReasonText: { fontSize: FONT.size.sm },
  reportedText:  { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold, paddingVertical: SPACE[8] },

  content:  { padding: SPACE[20], gap: SPACE[16], paddingBottom: SPACE[24] },

  // Photo header
  photoHeader:     { width: "100%", height: 220, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, overflow: "hidden" },
  gymBadge:        { position: "absolute", top: SPACE[12], left: SPACE[12], flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.50)", borderRadius: RADIUS.pill, paddingHorizontal: SPACE[10], paddingVertical: 5 },
  gymDotBadge:     { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4ADE80" },
  gymBadgeText:    { fontSize: 11, fontWeight: FONT.weight.bold, color: "#fff" },
  photoNameOverlay:{ position: "absolute", bottom: 0, left: 0, right: 0, padding: SPACE[14], gap: SPACE[6] },
  photoName:       { fontSize: FONT.size.xxl, fontWeight: FONT.weight.black, color: "#fff", letterSpacing: -0.4, flexShrink: 1 },
  photoAge:        { fontSize: FONT.size.lg, fontWeight: FONT.weight.medium, color: "rgba(255,255,255,0.75)", paddingBottom: 2 },
  photoMeta:       { fontSize: FONT.size.xs, color: "rgba(255,255,255,0.75)", fontWeight: FONT.weight.medium },
  levelBadge:      { paddingHorizontal: SPACE[8], paddingVertical: 2, borderRadius: RADIUS.pill, borderWidth: 1 },
  levelText:       { fontSize: FONT.size.xs, fontWeight: FONT.weight.extrabold, textTransform: "capitalize" },

  verifiedBadge: { paddingHorizontal: SPACE[8], paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: "rgba(34,197,94,0.25)", borderWidth: 1, borderColor: "rgba(34,197,94,0.60)", marginBottom: 2 },
  verifiedText:  { fontSize: 11, fontWeight: FONT.weight.extrabold, color: "#4ADE80" },

  intentChip:  { alignSelf: "center", paddingHorizontal: SPACE[14], paddingVertical: SPACE[6], borderRadius: RADIUS.pill, borderWidth: 1 },
  intentText:  { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold },

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
