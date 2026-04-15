/**
 * Referral Screen — Invite Friends
 *
 * Shows the user's referral code + link, milestone rewards,
 * and a list of people they've invited.
 * Deep-link: flexmatchesmobile://referral (or push from profile tab)
 */

import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Share, RefreshControl,
 Clipboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../lib/supabase";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../lib/theme";
import { Icon } from "../components/Icon";
import { Avatar } from "../components/Avatar";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReferralEntry = {
  id:               string;
  created_at:       string;
  validated_at:     string | null;
  referred_user_id: string;
  username:         string;
  avatar_url:       string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

// Mara's tiered reward model — reachable rewards early, so the loop
// actually activates in a sparse network. Previously the only real Pro
// reward was at 10 invites, which sits past the churn cliff.
const MILESTONES = [
  { count: 1, label: "First Invite", emoji: "📣", reward: "Founder badge",         color: "#a855f7" },
  { count: 3, label: "3 Friends",    emoji: "🎯", reward: "3 months Pro free",     color: "#3b82f6" },
  { count: 6, label: "6 Friends",    emoji: "💎", reward: "6 months Pro free",     color: "#60a5fa" },
];

const BASE_URL = "https://flexmatches.com";

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ReferralScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referrals,    setReferrals]    = useState<ReferralEntry[]>([]);
  const [copied,       setCopied]       = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: userData }, { data: refs }] = await Promise.all([
      supabase.from("users").select("username, referral_code").eq("id", user.id).single(),
      // Include validated_at so we can distinguish pending (signed up) from
      // counted (onboarding + phone verified). Only validated referrals
      // count toward milestone rewards.
      supabase.from("referrals")
        .select("id, created_at, validated_at, referred_user_id")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    // Every user gets a referral code — no profile-completion gate. If the
    // row doesn't have one yet (pre-trigger signup), mint one on the spot.
    // Format: 6-char upper-case alphanumeric, readable over voice.
    let code = userData?.referral_code ?? "";
    if (!code) {
      const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
      for (let attempt = 0; attempt < 5 && !code; attempt++) {
        const candidate = Array.from({ length: 6 }, () =>
          ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
        ).join("");
        const { error } = await supabase
          .from("users").update({ referral_code: candidate }).eq("id", user.id);
        if (!error) code = candidate; // unique-constraint hits retry
      }
    }
    setReferralCode(code);

    // Apply any milestone rewards the user has newly earned (idempotent).
    // Covers the case where a referral validated between sessions and the
    // grant didn't fire on the validate path. Uses the no-arg variant so
    // the server derives the referrer from auth.uid() — never trust a
    // user-supplied id for a grant call.
    supabase.rpc("apply_my_referral_rewards").then(() => {});

    if (refs && refs.length > 0) {
      const ids = refs.map((r: any) => r.referred_user_id);
      const { data: users } = await supabase
        .from("users").select("id, username, avatar_url").in("id", ids);
      const umap = Object.fromEntries((users ?? []).map((u: any) => [u.id, u]));
      setReferrals(refs.map((r: any) => ({
        ...r,
        username:  umap[r.referred_user_id]?.username  ?? "?",
        avatar_url: umap[r.referred_user_id]?.avatar_url ?? null,
      })));
    } else {
      setReferrals([]);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Actions ───────────────────────────────────────────────────────────────

  const referralLink = `${BASE_URL}/register?ref=${referralCode}`;

  async function handleShare() {
    try {
      await Share.share({
        message: `Join me on FlexMatches — find fitness partners who match your schedule and sport! 💪\n${referralLink}`,
        url: referralLink,
        title: "Join FlexMatches",
      });
    } catch { /* user dismissed */ }
  }

  async function handleCopyCode() {
    if (!referralCode) return;
    Clipboard.setString(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Only validated referrals count toward milestones (Mara's spec:
  // phone-verified + onboarding-complete). Pending-invitees still show
  // up in the "invited" list with a "pending" pill.
  const totalValidated = referrals.filter((r) => r.validated_at).length;
  const totalPending   = referrals.length - totalValidated;
  const total          = totalValidated;
  const nextMile       = MILESTONES.find((m) => m.count > total);
  const toNext         = nextMile ? nextMile.count - total : 0;

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: c.bg }]}>
        <ActivityIndicator color="#FF4500" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Icon name="back" size={24} color={c.textMuted} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.text }]}>Invite Friends</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#FF4500" />
        }
      >
        {/* Hero — background is always dark brown so text is pinned to light
            colors regardless of the user's theme. Previously used c.text /
            c.textMuted, which rendered near-black on dark brown in light
            mode and was unreadable. */}
        <View style={[s.hero, { backgroundColor: "#1a0800", borderColor: "#FF450033" }]}>
          <Text style={s.heroEmoji}>📣</Text>
          <Text style={[s.heroTitle, { color: "#FFFFFF" }]}>Invite & Earn Rewards</Text>
          <Text style={[s.heroSub, { color: "rgba(255,255,255,0.78)" }]}>
            Share your link — when a friend joins, you both unlock rewards.{"\n"}The more you invite, the bigger the prizes.
          </Text>
        </View>

        {/* Referral code card */}
        {referralCode ? (
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <Text style={[s.cardLabel, { color: c.textFaint }]}>YOUR REFERRAL CODE</Text>

            <View style={s.codeRow}>
              <View style={[s.codeBox, { backgroundColor: c.bg, borderColor: "#FF450044" }]}>
                <Text style={[s.codeText, { color: "#FF4500" }]}>{referralCode}</Text>
              </View>
              <TouchableOpacity
                style={[s.copyBtn, { borderColor: c.border }]}
                onPress={handleCopyCode}
                activeOpacity={0.8}
              >
                <Text style={[s.copyBtnText, { color: copied ? PALETTE.success : c.textMuted }]}>
                  {copied ? "✓ Copied" : "Copy"}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[s.shareBtn, { backgroundColor: "#FF4500" }]}
              onPress={handleShare}
              activeOpacity={0.85}
            >
              <Text style={s.shareBtnText}>🔗 Share My Link</Text>
            </TouchableOpacity>

            <Text style={[s.linkPreview, { color: c.textFaint }]} numberOfLines={1}>
              {referralLink}
            </Text>
          </View>
        ) : (
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border, alignItems: "center" }]}>
            <Text style={[s.noCodeText, { color: c.textMuted }]}>Generating your invite code…</Text>
            <TouchableOpacity
              style={[s.shareBtn, { backgroundColor: "#FF4500", marginTop: SPACE[12] }]}
              onPress={() => load()}
              activeOpacity={0.85}
            >
              <Text style={s.shareBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Progress to next reward */}
        {nextMile && total < 6 && (
          <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <View style={s.progressHeader}>
              <Text style={[s.progressTitle, { color: c.text }]}>
                Next: {nextMile.emoji} {nextMile.reward}
              </Text>
              <Text style={[s.progressCount, { color: "#FF4500" }]}>{toNext} to go</Text>
            </View>
            <View style={[s.progressTrack, { backgroundColor: c.border }]}>
              <View style={[
                s.progressFill,
                { width: `${Math.min((total / nextMile.count) * 100, 100)}%` as any, backgroundColor: "#FF4500" },
              ]} />
            </View>
            <Text style={[s.progressSub, { color: c.textFaint }]}>{total} / {nextMile.count} referrals</Text>
          </View>
        )}

        {/* Milestone list */}
        <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Text style={[s.cardLabel, { color: c.textFaint }]}>REWARD MILESTONES</Text>
          {MILESTONES.map((m) => {
            const achieved = total >= m.count;
            return (
              <View key={m.count} style={s.milestoneRow}>
                <View style={[s.milestoneIcon, {
                  backgroundColor: achieved ? m.color + "22" : c.bg,
                  borderColor:     achieved ? m.color : c.border,
                }]}>
                  <Text style={{ fontSize: 18 }}>{m.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.milestoneReward, { color: achieved ? c.text : c.textMuted }]}>
                    {m.reward}
                  </Text>
                  <Text style={[s.milestoneSub, { color: c.textFaint }]}>
                    {m.count} referral{m.count > 1 ? "s" : ""}
                  </Text>
                </View>
                {achieved && <Text style={{ color: PALETTE.success, fontSize: 16 }}>✓</Text>}
              </View>
            );
          })}
        </View>

        {/* Invited people */}
        <Text style={[s.sectionLabel, { color: c.textFaint }]}>
          PEOPLE YOU'VE INVITED ({totalValidated}{totalPending > 0 ? ` · ${totalPending} pending` : ""})
        </Text>

        {referrals.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={{ fontSize: 40 }}>👥</Text>
            <Text style={[s.emptyText, { color: c.textMuted }]}>No referrals yet. Share your link above!</Text>
          </View>
        ) : (
          referrals.map((r) => {
            const counted = !!r.validated_at;
            return (
              <View key={r.id} style={[s.refRow, { backgroundColor: c.bgCard, borderColor: c.border }]}>
                <Avatar url={r.avatar_url} name={r.username} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.refUsername, { color: c.text }]}>@{r.username}</Text>
                  <Text style={[s.refDate, { color: c.textFaint }]}>
                    {counted ? "Counted" : "Joined"} {new Date(counted ? r.validated_at! : r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </Text>
                </View>
                <Text style={[s.joinedText, { color: counted ? PALETTE.success : "#F59E0B" }]}>
                  {counted ? "✓ Counted" : "Pending"}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:       { flex: 1 },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACE[20], paddingVertical: SPACE[14], borderBottomWidth: 1 },
  headerTitle:     { fontSize: FONT.size.xl, fontWeight: FONT.weight.black },
  scroll:          { padding: SPACE[16], gap: SPACE[14], paddingBottom: 80 },

  hero:            { borderRadius: RADIUS.xl, padding: SPACE[24], borderWidth: 1, alignItems: "center", gap: SPACE[10] },
  heroEmoji:       { fontSize: 44 },
  heroTitle:       { fontSize: FONT.size.xl, fontWeight: FONT.weight.black, textAlign: "center" },
  heroSub:         { fontSize: FONT.size.sm, lineHeight: 20, textAlign: "center" },

  card:            { borderRadius: RADIUS.xl, padding: SPACE[20], borderWidth: 1, gap: SPACE[14] },
  cardLabel:       { fontSize: 11, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 0.8 },

  codeRow:         { flexDirection: "row", alignItems: "center", gap: SPACE[10] },
  codeBox:         { flex: 1, borderRadius: RADIUS.lg, paddingHorizontal: SPACE[16], paddingVertical: SPACE[14], borderWidth: 1 },
  codeText:        { fontSize: FONT.size.xxl, fontWeight: FONT.weight.black, letterSpacing: 4 },
  copyBtn:         { paddingHorizontal: SPACE[14], paddingVertical: SPACE[14], borderRadius: RADIUS.lg, borderWidth: 1 },
  copyBtnText:     { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },

  shareBtn:        { borderRadius: RADIUS.xl, paddingVertical: SPACE[14], alignItems: "center" },
  shareBtnText:    { color: "#fff", fontWeight: FONT.weight.black, fontSize: FONT.size.base },
  linkPreview:     { fontSize: 11, textAlign: "center" },
  noCodeText:      { fontSize: FONT.size.sm, textAlign: "center" },

  progressHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressTitle:   { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold, flex: 1 },
  progressCount:   { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  progressTrack:   { height: 6, borderRadius: 4, overflow: "hidden" },
  progressFill:    { height: 6, borderRadius: 4 },
  progressSub:     { fontSize: 11 },

  milestoneRow:    { flexDirection: "row", alignItems: "center", gap: SPACE[12] },
  milestoneIcon:   { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  milestoneReward: { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  milestoneSub:    { fontSize: 11, marginTop: 2 },

  sectionLabel:    { fontSize: 11, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: SPACE[4] },
  emptyWrap:       { alignItems: "center", paddingVertical: SPACE[40], gap: SPACE[12] },
  emptyText:       { fontSize: FONT.size.sm, textAlign: "center" },

  refRow:          { flexDirection: "row", alignItems: "center", gap: SPACE[12], borderRadius: RADIUS.lg, padding: SPACE[14], borderWidth: 1 },
  refUsername:     { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  refDate:         { fontSize: 11, marginTop: 2 },
  joinedText:      { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
});
