/**
 * Circles Screen
 *
 * Browse, join, and create local fitness communities.
 * Split into "My Circles" and "Discover" sections.
 * Full light/dark theme support via design system.
 */

import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, ScrollView,
  RefreshControl, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useTheme, SPACE, FONT, RADIUS } from "../../lib/theme";
import { Icon } from "../../components/Icon";
import { EmptyState } from "../../components/ui/EmptyState";

// ─── Constants ────────────────────────────────────────────────────────────────
const ACTIVITY_CATEGORIES: Record<string, { label: string; emoji: string; activities: string[] }> = {
  fitness: { label: "Fitness",    emoji: "💪", activities: ["Gym", "CrossFit", "Pilates", "Yoga"] },
  sports:  { label: "Sports",     emoji: "⚽", activities: ["Running", "Cycling", "Swimming", "Soccer", "Basketball", "Tennis", "Boxing"] },
  mind:    { label: "Mind Games", emoji: "♟️", activities: ["Chess", "Board Games"] },
  outdoor: { label: "Outdoor",    emoji: "🌿", activities: ["Hiking", "Climbing", "Kayaking"] },
};

const ALL_ACTIVITIES = Object.values(ACTIVITY_CATEGORIES).flatMap((c) => c.activities);

const EMOJIS = ["🏋️", "🏃", "🚴", "🏊", "⚽", "🏀", "🎾", "🥊", "🧘", "💪", "♟️", "🎲", "🏔️", "🧗", "🔥", "⚡", "🎯", "🌿"];

// ─── Types ────────────────────────────────────────────────────────────────────
type Community = {
  id:           string;
  name:         string;
  description:  string | null;
  sport:        string | null;
  city:         string | null;
  avatar_emoji: string;
  creator_id:   string;
  member_count: number;
  is_member:    boolean;
};

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CirclesScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [userId,      setUserId]      = useState<string | null>(null);
  const [search,      setSearch]      = useState("");
  const [filterCat,   setFilterCat]   = useState("");
  const [showCreate,  setShowCreate]  = useState(false);

  // Create form state
  const [formName,     setFormName]     = useState("");
  const [formDesc,     setFormDesc]     = useState("");
  const [formActivity, setFormActivity] = useState("Gym");
  const [formCity,     setFormCity]     = useState("");
  const [formEmoji,    setFormEmoji]    = useState("🏋️");
  const [saving,       setSaving]       = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [{ data: comms }, { data: memberships }] = await Promise.all([
      supabase.from("communities")
        .select("id, name, description, sport, city, avatar_emoji, creator_id")
        .order("created_at", { ascending: false }),
      supabase.from("community_members")
        .select("community_id")
        .eq("user_id", user.id),
    ]);

    const joinedIds = new Set((memberships ?? []).map((m: any) => m.community_id));
    const ids = (comms ?? []).map((c: any) => c.id);

    let countMap: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: counts } = await supabase
        .from("community_members")
        .select("community_id")
        .in("community_id", ids);
      for (const row of counts ?? []) {
        countMap[(row as any).community_id] = (countMap[(row as any).community_id] ?? 0) + 1;
      }
    }

    setCommunities((comms ?? []).map((c: any) => ({
      ...c,
      member_count: countMap[c.id] ?? 0,
      is_member:    joinedIds.has(c.id),
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Actions ────────────────────────────────────────────────────────────────
  async function joinOrLeave(communityId: string, isMember: boolean) {
    if (!userId) return;
    if (isMember) {
      await supabase.from("community_members").delete()
        .eq("community_id", communityId).eq("user_id", userId);
    } else {
      await supabase.from("community_members")
        .insert({ community_id: communityId, user_id: userId });
    }
    setCommunities((prev) => prev.map((c) =>
      c.id === communityId
        ? { ...c, is_member: !isMember, member_count: c.member_count + (isMember ? -1 : 1) }
        : c
    ));
  }

  async function createCircle() {
    if (!formName.trim() || !userId) return;
    setSaving(true);
    const { error } = await supabase.from("communities").insert({
      name:         formName.trim(),
      description:  formDesc.trim() || null,
      sport:        formActivity,
      city:         formCity.trim() || null,
      avatar_emoji: formEmoji,
      creator_id:   userId,
    });
    setSaving(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setShowCreate(false);
    setFormName(""); setFormDesc(""); setFormActivity("Gym"); setFormCity(""); setFormEmoji("🏋️");
    await load();
  }

  function resetCreate() {
    setShowCreate(false);
    setFormName(""); setFormDesc(""); setFormActivity("Gym"); setFormCity(""); setFormEmoji("🏋️");
  }

  // ── Filter ─────────────────────────────────────────────────────────────────
  const catActivities = filterCat ? ACTIVITY_CATEGORIES[filterCat]?.activities ?? [] : [];
  const filtered = communities.filter((c) => {
    const matchSearch = !search.trim() ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.city ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || catActivities.includes(c.sport ?? "");
    return matchSearch && matchCat;
  });

  const myCircles      = filtered.filter((c) => c.is_member);
  const discoverCircles = filtered.filter((c) => !c.is_member);
  const listData = [...myCircles, ...discoverCircles];

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.brand} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.title, { color: c.text }]}>Circles</Text>
          <Text style={[s.subtitle, { color: c.textMuted }]}>Your local activity communities</Text>
        </View>
        <TouchableOpacity
          style={[s.newBtn, { backgroundColor: c.brand }]}
          onPress={() => setShowCreate(true)}
          activeOpacity={0.85}
        >
          <Icon name="add" size={16} color="#fff" />
          <Text style={s.newBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[s.searchWrap, { paddingHorizontal: SPACE[16] }]}>
        <View style={[s.searchBar, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Icon name="search" size={16} color={c.textMuted} />
          <TextInput
            style={[s.searchInput, { color: c.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search circles..."
            placeholderTextColor={c.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={14} color={c.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.catScroll}
        contentContainerStyle={[s.catRow, { paddingHorizontal: SPACE[16] }]}
      >
        {[{ key: "", label: "All", emoji: "" }, ...Object.entries(ACTIVITY_CATEGORIES).map(([k, v]) => ({ key: k, label: v.label, emoji: v.emoji }))].map(({ key, label, emoji }) => {
          const active = filterCat === key;
          return (
            <TouchableOpacity
              key={key}
              style={[s.catChip, { backgroundColor: active ? c.brandSubtle : c.bgCard, borderColor: active ? c.brand : c.border }]}
              onPress={() => setFilterCat(active && key !== "" ? "" : key)}
              activeOpacity={0.8}
            >
              <Text style={[s.catChipText, { color: active ? c.brand : c.textMuted }]}>
                {emoji ? `${emoji} ` : ""}{label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[s.list, listData.length === 0 && { flex: 1 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} />}
        renderItem={({ item, index }) => {
          const showMyHeader      = item.is_member && index === 0;
          const showDiscoverHeader = !item.is_member && index === myCircles.length;
          return (
            <>
              {showMyHeader && (
                <Text style={[s.sectionLabel, { color: c.textMuted }]}>MY CIRCLES</Text>
              )}
              {showDiscoverHeader && (
                <Text style={[s.sectionLabel, { color: c.textMuted, marginTop: myCircles.length > 0 ? SPACE[16] : 0 }]}>
                  DISCOVER
                </Text>
              )}
              <CircleCard
                item={item}
                onJoin={() => joinOrLeave(item.id, item.is_member)}
              />
            </>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="circlesActive"
            title="No circles yet"
            subtitle="Create a circle for your local fitness community."
            action={{ label: "Create a Circle", onPress: () => setShowCreate(true) }}
          />
        }
      />

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[s.modal, { backgroundColor: c.bg }]}>
          {/* Modal header */}
          <View style={[s.modalHeader, { borderBottomColor: c.border }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>New Circle</Text>
            <TouchableOpacity onPress={resetCreate} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={22} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
            {/* Emoji picker */}
            <Text style={[s.fieldLabel, { color: c.textMuted }]}>Icon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACE[20] }}>
              <View style={s.emojiRow}>
                {EMOJIS.map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[s.emojiOpt, { backgroundColor: c.bgCard, borderColor: formEmoji === e ? c.brand : c.border },
                      formEmoji === e && { backgroundColor: c.brandSubtle }]}
                    onPress={() => setFormEmoji(e)}
                  >
                    <Text style={s.emojiText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Name */}
            <Text style={[s.fieldLabel, { color: c.textMuted }]}>Circle Name *</Text>
            <TextInput
              style={[s.input, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text }]}
              value={formName}
              onChangeText={setFormName}
              placeholder="e.g. Sunday Soccer, Morning Runners"
              placeholderTextColor={c.textMuted}
            />

            {/* Activity */}
            <Text style={[s.fieldLabel, { color: c.textMuted, marginTop: SPACE[16] }]}>Activity</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACE[16] }}>
              <View style={s.actRow}>
                {ALL_ACTIVITIES.map((a) => {
                  const active = formActivity === a;
                  return (
                    <TouchableOpacity
                      key={a}
                      style={[s.actChip, { backgroundColor: active ? c.brandSubtle : c.bgCard, borderColor: active ? c.brand : c.border }]}
                      onPress={() => setFormActivity(a)}
                    >
                      <Text style={[s.actChipText, { color: active ? c.brand : c.textMuted }]}>{a}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Description */}
            <Text style={[s.fieldLabel, { color: c.textMuted }]}>Description (optional)</Text>
            <TextInput
              style={[s.input, s.textArea, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text }]}
              value={formDesc}
              onChangeText={setFormDesc}
              placeholder="What's this circle about?"
              placeholderTextColor={c.textMuted}
              multiline
            />

            {/* City */}
            <Text style={[s.fieldLabel, { color: c.textMuted, marginTop: SPACE[16] }]}>City (optional)</Text>
            <TextInput
              style={[s.input, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text }]}
              value={formCity}
              onChangeText={setFormCity}
              placeholder="e.g. New York"
              placeholderTextColor={c.textMuted}
            />

            <TouchableOpacity
              style={[s.createBtn, { backgroundColor: c.brand }, (!formName.trim() || saving) && { opacity: 0.45 }]}
              onPress={createCircle}
              disabled={!formName.trim() || saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.createBtnText}>Create Circle</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Circle Card ─────────────────────────────────────────────────────────────
function CircleCard({ item, onJoin }: { item: Community; onJoin: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: c.bgCard, borderColor: item.is_member ? c.brandBorder : c.border }]}
      activeOpacity={0.85}
    >
      {/* Emoji avatar */}
      <View style={[s.cardEmoji, { backgroundColor: c.bgCardAlt }]}>
        <Text style={s.cardEmojiText}>{item.avatar_emoji}</Text>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <Text style={[s.cardName, { color: c.text }]} numberOfLines={1}>{item.name}</Text>
        <View style={s.cardMeta}>
          {item.sport && (
            <View style={[s.chip, { backgroundColor: c.bgCardAlt, borderColor: c.borderMedium }]}>
              <Text style={[s.chipText, { color: c.textMuted }]}>{item.sport}</Text>
            </View>
          )}
          {item.city && (
            <View style={[s.chip, { backgroundColor: c.bgCardAlt, borderColor: c.borderMedium }]}>
              <Icon name="location" size={10} color={c.textMuted} />
              <Text style={[s.chipText, { color: c.textMuted }]}>{item.city}</Text>
            </View>
          )}
        </View>
        <View style={s.memberRow}>
          <Icon name="circlesActive" size={11} color={c.textFaint} />
          <Text style={[s.memberCount, { color: c.textFaint }]}>
            {item.member_count} member{item.member_count !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      {/* Join / Joined */}
      <TouchableOpacity
        style={[
          s.joinBtn,
          item.is_member
            ? { backgroundColor: "transparent", borderWidth: 1, borderColor: c.brandBorder }
            : { backgroundColor: c.brand },
        ]}
        onPress={onJoin}
        activeOpacity={0.8}
      >
        <Text style={[s.joinText, { color: item.is_member ? c.brand : "#fff" }]}>
          {item.is_member ? "Joined" : "Join"}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                 paddingHorizontal: SPACE[20], paddingTop: SPACE[12], paddingBottom: SPACE[8] },
  title:       { fontSize: FONT.size.xxxl, fontWeight: FONT.weight.black, letterSpacing: -0.5 },
  subtitle:    { fontSize: FONT.size.xs, marginTop: 2 },
  newBtn:      { flexDirection: "row", alignItems: "center", gap: SPACE[4],
                 borderRadius: RADIUS.pill, paddingHorizontal: SPACE[14], paddingVertical: SPACE[8] },
  newBtnText:  { color: "#fff", fontWeight: FONT.weight.extrabold, fontSize: FONT.size.sm },
  searchWrap:  { marginBottom: SPACE[10] },
  searchBar:   { flexDirection: "row", alignItems: "center", gap: SPACE[8],
                 borderRadius: RADIUS.lg, paddingHorizontal: SPACE[14], paddingVertical: SPACE[12],
                 borderWidth: 1 },
  searchInput: { flex: 1, fontSize: FONT.size.md, padding: 0 },
  catScroll:   { flexGrow: 0, marginBottom: SPACE[8] },
  catRow:      { flexDirection: "row", gap: SPACE[8] },
  catChip:     { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[14], paddingVertical: SPACE[6],
                 borderWidth: 1 },
  catChipText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  list:        { paddingHorizontal: SPACE[16], paddingBottom: SPACE[40] },
  sectionLabel:{ fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, textTransform: "uppercase",
                 letterSpacing: 1, marginBottom: SPACE[8], marginTop: SPACE[4] },
  card:        { flexDirection: "row", alignItems: "center", borderRadius: RADIUS.xl,
                 padding: SPACE[14], marginBottom: SPACE[10], borderWidth: 1, gap: SPACE[12] },
  cardEmoji:   { width: 52, height: 52, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center" },
  cardEmojiText:{ fontSize: 26 },
  cardName:    { fontSize: FONT.size.md, fontWeight: FONT.weight.bold, marginBottom: SPACE[4] },
  cardMeta:    { flexDirection: "row", gap: SPACE[6], flexWrap: "wrap", marginBottom: SPACE[4] },
  chip:        { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: RADIUS.pill,
                 paddingHorizontal: SPACE[8], paddingVertical: 3, borderWidth: 1 },
  chipText:    { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
  memberRow:   { flexDirection: "row", alignItems: "center", gap: 4 },
  memberCount: { fontSize: FONT.size.xs },
  joinBtn:     { borderRadius: RADIUS.md, paddingHorizontal: SPACE[14], paddingVertical: SPACE[8],
                 minWidth: 60, alignItems: "center" },
  joinText:    { fontWeight: FONT.weight.bold, fontSize: FONT.size.sm },
  modal:       { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                 paddingHorizontal: SPACE[20], paddingVertical: SPACE[16], borderBottomWidth: 1 },
  modalTitle:  { fontSize: FONT.size.xl, fontWeight: FONT.weight.black },
  modalBody:   { padding: SPACE[20], gap: SPACE[8] },
  fieldLabel:  { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, textTransform: "uppercase",
                 letterSpacing: 0.8, marginBottom: SPACE[8] },
  emojiRow:    { flexDirection: "row", gap: SPACE[10] },
  emojiOpt:    { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: "center",
                 justifyContent: "center", borderWidth: 1 },
  emojiText:   { fontSize: 24 },
  input:       { borderRadius: RADIUS.lg, paddingHorizontal: SPACE[16], paddingVertical: SPACE[14],
                 fontSize: FONT.size.md, borderWidth: 1.5 },
  textArea:    { height: 88, textAlignVertical: "top", paddingTop: SPACE[12] },
  actRow:      { flexDirection: "row", gap: SPACE[8] },
  actChip:     { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[14], paddingVertical: SPACE[6],
                 borderWidth: 1 },
  actChipText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  createBtn:   { borderRadius: RADIUS.xl, paddingVertical: SPACE[16], alignItems: "center", marginTop: SPACE[8] },
  createBtnText:{ color: "#fff", fontWeight: FONT.weight.extrabold, fontSize: FONT.size.lg },
});
