/**
 * Circles Screen
 *
 * Browse, join, and create local activity communities.
 * - Tap a circle → centered detail popup with member list
 * - Create circle: category-tabbed activity picker + field/venue with map picker
 * - New Circle disclosure: handled via Home tab discovery feed
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, ScrollView,
  RefreshControl, Alert, KeyboardAvoidingView, Platform, Dimensions,
} from "react-native";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useTheme, SPACE, FONT, RADIUS } from "../../lib/theme";
import { Icon } from "../../components/Icon";
import { Avatar } from "../../components/Avatar";
import { EmptyState } from "../../components/ui/EmptyState";
import { MapLocationPicker } from "../../components/MapLocationPicker";

const { height: SCREEN_H } = Dimensions.get("window");

// ─── Constants ────────────────────────────────────────────────────────────────
const ACTIVITY_CATEGORIES = [
  { key: "fitness", label: "Fitness",    emoji: "💪", activities: ["Gym", "CrossFit", "Pilates", "Yoga"] },
  { key: "sports",  label: "Sports",     emoji: "⚽", activities: ["Running", "Cycling", "Swimming", "Soccer", "Basketball", "Tennis", "Boxing"] },
  { key: "mind",    label: "Mind Games", emoji: "♟️", activities: ["Chess", "Board Games"] },
  { key: "outdoor", label: "Outdoor",    emoji: "🌿", activities: ["Hiking", "Climbing", "Kayaking"] },
] as const;

type CategoryKey = typeof ACTIVITY_CATEGORIES[number]["key"];

const EMOJIS = ["🏋️", "🏃", "🚴", "🏊", "⚽", "🏀", "🎾", "🥊", "🧘", "💪", "♟️", "🎲", "🏔️", "🧗", "🔥", "⚡", "🎯", "🌿"];

function categoryOfActivity(activity: string): CategoryKey {
  for (const cat of ACTIVITY_CATEGORIES) {
    if ((cat.activities as readonly string[]).includes(activity)) return cat.key;
  }
  return "fitness";
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Community = {
  id:           string;
  name:         string;
  description:  string | null;
  sport:        string | null;
  city:         string | null;
  field:        string | null;
  event_date:   string | null;
  event_time:   string | null;
  avatar_emoji: string;
  creator_id:   string;
  member_count: number;
  max_members:  number | null;
  is_member:    boolean;
};

type CircleMember = {
  id:         string;
  username:   string;
  full_name:  string | null;
  avatar_url: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCircleDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow";
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

// ─── CalendarPicker ───────────────────────────────────────────────────────────
const CELL_SIZE = Math.floor((Dimensions.get("window").width - 40 - 40) / 7);

function CalendarPicker({ value, onChange, colors }: { value: string; onChange: (d: string) => void; colors: any }) {
  const today = new Date();
  const init = value ? new Date(value + "T12:00:00") : today;
  const [vm, setVm] = useState({ year: init.getFullYear(), month: init.getMonth() });
  const { year, month } = vm;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const dayStr = (d: number) => `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const isSelected = (d: number) => dayStr(d) === value;
  const isPast = (d: number) => dayStr(d) < todayStr;
  const prev = () => setVm(({year:y,month:m}) => m===0 ? {year:y-1,month:11} : {year:y,month:m-1});
  const next = () => setVm(({year:y,month:m}) => m===11 ? {year:y+1,month:0} : {year:y,month:m+1});
  return (
    <View style={cl.root}>
      <View style={cl.nav}>
        <TouchableOpacity onPress={prev} hitSlop={8}><Text style={[cl.arrow, { color: colors.textMuted }]}>‹</Text></TouchableOpacity>
        <Text style={[cl.month, { color: colors.text }]}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={next} hitSlop={8}><Text style={[cl.arrow, { color: colors.textMuted }]}>›</Text></TouchableOpacity>
      </View>
      <View style={cl.row}>
        {DAY_LABELS.map((l) => <Text key={l} style={[cl.dayHdr, { color: colors.textFaint }]}>{l}</Text>)}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={cl.row}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={cl.cell} />;
            const past = isPast(day); const sel = isSelected(day);
            return (
              <TouchableOpacity key={ci} style={[cl.cell, sel && { backgroundColor: "#FF4500", borderRadius: 20 }]} onPress={() => !past && onChange(dayStr(day))} disabled={past} hitSlop={2}>
                <Text style={[cl.dayTxt, { color: past ? colors.textFaint : sel ? "#fff" : colors.text }, sel && { fontWeight: "900" }]}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function TimeColumn({ value, max, step, onChange, colors }: { value:number; max:number; step:number; onChange:(v:number)=>void; colors:any }) {
  return (
    <View style={tp.col}>
      <TouchableOpacity onPress={() => onChange(value+step > max ? 0 : value+step)} style={tp.arrow} hitSlop={10}><Text style={[tp.arrowTxt, { color: colors.textMuted }]}>▲</Text></TouchableOpacity>
      <Text style={[tp.val, { color: colors.text }]}>{String(value).padStart(2,"0")}</Text>
      <TouchableOpacity onPress={() => onChange(value-step < 0 ? max : value-step)} style={tp.arrow} hitSlop={10}><Text style={[tp.arrowTxt, { color: colors.textMuted }]}>▼</Text></TouchableOpacity>
    </View>
  );
}

function TimePickerInline({ hour, minute, onHourChange, onMinuteChange, colors }: { hour:number; minute:number; onHourChange:(h:number)=>void; onMinuteChange:(m:number)=>void; colors:any }) {
  return (
    <View style={tp.root}>
      <TimeColumn value={hour} max={23} step={1} onChange={onHourChange} colors={colors} />
      <Text style={[tp.colon, { color: colors.text }]}>:</Text>
      <TimeColumn value={minute} max={55} step={5} onChange={onMinuteChange} colors={colors} />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CirclesScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [communities,    setCommunities]    = useState<Community[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [userId,         setUserId]         = useState<string | null>(null);
  const [search,         setSearch]         = useState("");
  const [filterCat,      setFilterCat]      = useState("");
  const [showCreate,     setShowCreate]     = useState(false);

  // Detail popup
  const [selectedCircle, setSelectedCircle] = useState<Community | null>(null);
  const [circleMembers,  setCircleMembers]  = useState<CircleMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Create form state
  const [formName,       setFormName]       = useState("");
  const [formDesc,       setFormDesc]       = useState("");
  const [formActivity,   setFormActivity]   = useState("Gym");
  const [formCatTab,     setFormCatTab]     = useState<CategoryKey>("fitness");
  const [formCity,       setFormCity]       = useState("");
  const [formField,      setFormField]      = useState("");
  const [formMaxMembers, setFormMaxMembers] = useState("");
  const [formEventDate,  setFormEventDate]  = useState("");
  const [formEventHour,  setFormEventHour]  = useState(9);
  const [formEventMin,   setFormEventMin]   = useState(0);
  const [formUseTime,    setFormUseTime]    = useState(false);
  const [formEmoji,      setFormEmoji]      = useState("🏋️");
  const [saving,         setSaving]         = useState(false);
  const [showMapPicker,  setShowMapPicker]  = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [{ data: comms }, { data: memberships }] = await Promise.all([
      supabase.from("communities")
        .select("id, name, description, sport, city, field, event_date, event_time, max_members, avatar_emoji, creator_id")
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

    setCommunities((comms ?? []).map((cc: any) => ({
      ...cc,
      field:        cc.field ?? null,
      event_date:   cc.event_date ?? null,
      event_time:   cc.event_time ?? null,
      max_members:  cc.max_members ?? null,
      member_count: countMap[cc.id] ?? 0,
      is_member:    joinedIds.has(cc.id),
    })));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Circle detail ─────────────────────────────────────────────────────────
  async function openCircle(circle: Community) {
    setSelectedCircle(circle);
    setLoadingMembers(true);
    const { data } = await supabase
      .from("community_members")
      .select("user:users(id, username, full_name, avatar_url)")
      .eq("community_id", circle.id);
    setCircleMembers(
      (data ?? []).map((row: any) => row.user).filter(Boolean) as CircleMember[]
    );
    setLoadingMembers(false);
  }

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
    if (selectedCircle?.id === communityId) {
      setSelectedCircle((prev) => prev
        ? { ...prev, is_member: !isMember, member_count: prev.member_count + (isMember ? -1 : 1) }
        : null
      );
    }
  }

  async function createCircle() {
    if (!formName.trim() || !userId) return;
    setSaving(true);
    const { error } = await supabase.from("communities").insert({
      name:         formName.trim(),
      description:  formDesc.trim() || null,
      sport:        formActivity,
      city:         formCity.trim() || null,
      field:        formField.trim() || null,
      max_members:  formMaxMembers.trim() ? parseInt(formMaxMembers, 10) : null,
      event_date:   formEventDate.trim() || null,
      event_time:   formUseTime ? `${String(formEventHour).padStart(2,"0")}:${String(formEventMin).padStart(2,"0")}` : null,
      avatar_emoji: formEmoji,
      creator_id:   userId,
    });
    setSaving(false);
    if (error) { Alert.alert("Error", error.message); return; }
    resetCreate();
    await load();
  }

  function resetCreate() {
    setShowCreate(false);
    setFormName(""); setFormDesc(""); setFormActivity("Gym");
    setFormCatTab("fitness"); setFormCity(""); setFormField(""); setFormMaxMembers("");
    setFormEventDate(""); setFormEventHour(9); setFormEventMin(0); setFormUseTime(false); setFormEmoji("🏋️");
  }

  // ── Filter ─────────────────────────────────────────────────────────────────
  const catActivities = filterCat
    ? (ACTIVITY_CATEGORIES.find((c) => c.key === filterCat)?.activities ?? []) as readonly string[]
    : [];
  const filtered = communities.filter((c) => {
    const matchSearch = !search.trim() ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.city ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || catActivities.includes(c.sport ?? "");
    return matchSearch && matchCat;
  });

  const myCircles       = filtered.filter((c) => c.is_member);
  const discoverCircles = filtered.filter((c) => !c.is_member);
  const listData        = [...myCircles, ...discoverCircles];

  // Activities for the currently selected form category tab
  const tabActivities = ACTIVITY_CATEGORIES.find((c) => c.key === formCatTab)?.activities ?? [];

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
        {[{ key: "", label: "All", emoji: "" }, ...ACTIVITY_CATEGORIES.map((c) => ({ key: c.key, label: c.label, emoji: c.emoji }))].map(({ key, label, emoji }) => {
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
          const showMyHeader       = item.is_member && index === 0;
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
                onPress={() => openCircle(item)}
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

      {/* ── Circle detail popup (absolute overlay, NOT Modal) ─────────────── */}
      {selectedCircle && (
        <TouchableOpacity
          style={s.popupBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedCircle(null)}
        >
          <TouchableOpacity
            style={[s.popupCard, { backgroundColor: c.bgCard }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <TouchableOpacity style={s.popupClose} onPress={() => setSelectedCircle(null)} hitSlop={10}>
              <Icon name="close" size={20} color={c.textMuted} />
            </TouchableOpacity>

            {/* Emoji + title */}
            <View style={s.popupTop}>
              <View style={[s.popupEmoji, { backgroundColor: c.bgCardAlt }]}>
                <Text style={{ fontSize: 36 }}>{selectedCircle.avatar_emoji}</Text>
              </View>
              <Text style={[s.popupName, { color: c.text }]}>{selectedCircle.name}</Text>
              <View style={s.popupChips}>
                {selectedCircle.sport && (
                  <View style={[s.chip, { backgroundColor: c.bgCardAlt, borderColor: c.borderMedium }]}>
                    <Text style={[s.chipText, { color: c.textMuted }]}>{selectedCircle.sport}</Text>
                  </View>
                )}
                {selectedCircle.city && (
                  <View style={[s.chip, { backgroundColor: c.bgCardAlt, borderColor: c.borderMedium }]}>
                    <Icon name="location" size={10} color={c.textMuted} />
                    <Text style={[s.chipText, { color: c.textMuted }]}>{selectedCircle.city}</Text>
                  </View>
                )}
              </View>
              {selectedCircle.field && (
                <View style={[s.popupField, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                  <Text style={{ fontSize: 14 }}>📍</Text>
                  <Text style={[s.popupFieldText, { color: c.textSecondary }]} numberOfLines={2}>
                    {selectedCircle.field}
                  </Text>
                </View>
              )}
              {selectedCircle.event_date && (
                <View style={[s.popupField, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                  <Text style={{ fontSize: 14 }}>📅</Text>
                  <Text style={[s.popupFieldText, { color: c.textSecondary }]}>
                    {formatCircleDate(selectedCircle.event_date)}
                    {selectedCircle.event_time ? `  ·  ${selectedCircle.event_time}` : ""}
                  </Text>
                </View>
              )}
              {selectedCircle.description && (
                <Text style={[s.popupDesc, { color: c.textMuted }]}>{selectedCircle.description}</Text>
              )}
            </View>

            {/* Member list */}
            <View style={[s.popupDivider, { backgroundColor: c.border }]} />
            <Text style={[s.popupMemberHeader, { color: c.textMuted }]}>
              {selectedCircle.member_count}{selectedCircle.max_members ? `/${selectedCircle.max_members}` : ""} MEMBER{selectedCircle.member_count !== 1 ? "S" : ""}
            </Text>
            {loadingMembers ? (
              <ActivityIndicator color={c.brand} size="small" style={{ marginVertical: SPACE[16] }} />
            ) : (
              <ScrollView style={s.memberList} showsVerticalScrollIndicator={false}>
                {circleMembers.map((m) => (
                  <View key={m.id} style={s.memberRow}>
                    <Avatar url={m.avatar_url} name={m.full_name ?? m.username} size={32} />
                    <Text style={[s.memberName, { color: c.text }]}>
                      {m.full_name ?? m.username}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Join / Leave */}
            <TouchableOpacity
              style={[
                s.popupJoinBtn,
                selectedCircle.is_member
                  ? { borderWidth: 1, borderColor: c.brandBorder, backgroundColor: "transparent" }
                  : { backgroundColor: c.brand },
              ]}
              onPress={() => joinOrLeave(selectedCircle.id, selectedCircle.is_member)}
              activeOpacity={0.85}
            >
              <Text style={[s.popupJoinText, { color: selectedCircle.is_member ? c.brand : "#fff" }]}>
                {selectedCircle.is_member ? "Leave Circle" : "Join Circle"}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* ── Create Circle Modal ───────────────────────────────────────────── */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[s.modal, { backgroundColor: c.bg }]}>
          {/* Modal header */}
          <View style={[s.modalHeader, { borderBottomColor: c.border }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>New Circle</Text>
            <TouchableOpacity onPress={resetCreate} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={22} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <ScrollView
              contentContainerStyle={s.modalBody}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
            >
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

              {/* Activity — category tabs + filtered activities */}
              <Text style={[s.fieldLabel, { color: c.textMuted, marginTop: SPACE[16] }]}>Activity</Text>
              {/* Category tabs */}
              <View style={[s.catTabRow, { borderColor: c.border }]}>
                {ACTIVITY_CATEGORIES.map((cat) => {
                  const active = formCatTab === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[s.catTab, active && { borderBottomColor: c.brand }]}
                      onPress={() => {
                        setFormCatTab(cat.key);
                        // Auto-select first activity in tab if current is not in this tab
                        if (!cat.activities.includes(formActivity as any)) {
                          setFormActivity(cat.activities[0]);
                        }
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
                      <Text style={[s.catTabText, { color: active ? c.brand : c.textMuted }]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {/* Activities for selected tab */}
              <View style={[s.actGrid, { marginBottom: SPACE[16] }]}>
                {(tabActivities as readonly string[]).map((a) => {
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
                placeholder="e.g. Istanbul, New York"
                placeholderTextColor={c.textMuted}
              />

              {/* Field / Venue */}
              <Text style={[s.fieldLabel, { color: c.textMuted, marginTop: SPACE[16] }]}>Field / Venue (optional)</Text>
              <View style={s.locationRow}>
                <TextInput
                  style={[s.inputFlex, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text }]}
                  value={formField}
                  onChangeText={setFormField}
                  placeholder="e.g. Central Park, Fenerbahçe Stadium"
                  placeholderTextColor={c.textMuted}
                />
                <TouchableOpacity
                  style={[s.mapBtn, { backgroundColor: c.bgInput, borderColor: c.border }]}
                  onPress={() => setShowMapPicker(true)}
                  hitSlop={8}
                >
                  <Text style={{ fontSize: 18 }}>🗺️</Text>
                </TouchableOpacity>
              </View>

              {/* Max members */}
              <Text style={[s.fieldLabel, { color: c.textMuted, marginTop: SPACE[16] }]}>Max Members (optional)</Text>
              <TextInput
                style={[s.input, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text }]}
                value={formMaxMembers}
                onChangeText={(v) => setFormMaxMembers(v.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 10, 20, unlimited if empty"
                placeholderTextColor={c.textMuted}
                keyboardType="number-pad"
              />

              {/* Date */}
              <Text style={[s.fieldLabel, { color: c.textMuted, marginTop: SPACE[16] }]}>Date (optional)</Text>
              {formEventDate ? (
                <View style={[s.selectedDateRow, { backgroundColor: c.brand+"15", borderColor: c.brand+"60" }]}>
                  <Text style={{ fontSize: 14 }}>📅</Text>
                  <Text style={[s.selectedDateText, { color: c.brand }]}>{formatCircleDate(formEventDate)}</Text>
                  <TouchableOpacity onPress={() => setFormEventDate("")} hitSlop={10}>
                    <Text style={{ color: c.textMuted, fontSize: 14 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={[{ fontSize: FONT.size.xs, color: c.textFaint, marginBottom: -4 }]}>Tap a day to select</Text>
              )}
              <CalendarPicker value={formEventDate} onChange={setFormEventDate} colors={c} />

              {/* Time */}
              <View style={[s.timeHeaderRow, { marginTop: SPACE[4] }]}>
                <Text style={[s.fieldLabel, { color: c.textMuted, marginBottom: 0 }]}>Time</Text>
                <TouchableOpacity
                  style={[s.timeToggle, { backgroundColor: formUseTime ? c.brand : c.bgInput, borderColor: formUseTime ? c.brand : c.border }]}
                  onPress={() => setFormUseTime((v) => !v)}
                >
                  <Text style={[s.timeToggleText, { color: formUseTime ? "#fff" : c.textMuted }]}>
                    {formUseTime ? "Remove time" : "Add time"}
                  </Text>
                </TouchableOpacity>
              </View>
              {formUseTime && (
                <View style={[s.timePickerWrap, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                  <TimePickerInline
                    hour={formEventHour} minute={formEventMin}
                    onHourChange={setFormEventHour} onMinuteChange={setFormEventMin}
                    colors={c}
                  />
                </View>
              )}

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
          </KeyboardAvoidingView>

          {/* Map overlay inside modal */}
          {showMapPicker && (
            <View style={[s.mapOverlay, { backgroundColor: c.bg }]}>
              <MapLocationPicker
                colors={c}
                onSelect={(loc) => { setFormField(loc); setShowMapPicker(false); }}
                onClose={() => setShowMapPicker(false)}
              />
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Circle Card ──────────────────────────────────────────────────────────────
function CircleCard({ item, onPress, onJoin }: { item: Community; onPress: () => void; onJoin: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: c.bgCard, borderColor: item.is_member ? c.brandBorder : c.border }]}
      onPress={onPress}
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
        <View style={s.memberCountRow}>
          <Icon name="circlesActive" size={11} color={c.textFaint} />
          <Text style={[s.memberCountText, { color: c.textFaint }]}>
            {item.member_count}{item.max_members ? `/${item.max_members}` : ""} member{item.member_count !== 1 ? "s" : ""}
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
  root:            { flex: 1 },
  header:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                     paddingHorizontal: SPACE[20], paddingTop: SPACE[12], paddingBottom: SPACE[8] },
  title:           { fontSize: FONT.size.xxxl, fontWeight: FONT.weight.black, letterSpacing: -0.5 },
  subtitle:        { fontSize: FONT.size.xs, marginTop: 2 },
  newBtn:          { flexDirection: "row", alignItems: "center", gap: SPACE[4],
                     borderRadius: RADIUS.pill, paddingHorizontal: SPACE[14], paddingVertical: SPACE[8] },
  newBtnText:      { color: "#fff", fontWeight: FONT.weight.extrabold, fontSize: FONT.size.sm },
  searchWrap:      { marginBottom: SPACE[10] },
  searchBar:       { flexDirection: "row", alignItems: "center", gap: SPACE[8],
                     borderRadius: RADIUS.lg, paddingHorizontal: SPACE[14], paddingVertical: SPACE[12], borderWidth: 1 },
  searchInput:     { flex: 1, fontSize: FONT.size.md, padding: 0 },
  catScroll:       { flexGrow: 0, marginBottom: SPACE[8] },
  catRow:          { flexDirection: "row", gap: SPACE[8] },
  catChip:         { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[14], paddingVertical: SPACE[6], borderWidth: 1 },
  catChipText:     { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  list:            { paddingHorizontal: SPACE[16], paddingBottom: SPACE[40] },
  sectionLabel:    { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, textTransform: "uppercase",
                     letterSpacing: 1, marginBottom: SPACE[8], marginTop: SPACE[4] },
  card:            { flexDirection: "row", alignItems: "center", borderRadius: RADIUS.xl,
                     padding: SPACE[14], marginBottom: SPACE[10], borderWidth: 1, gap: SPACE[12] },
  cardEmoji:       { width: 52, height: 52, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center" },
  cardEmojiText:   { fontSize: 26 },
  cardName:        { fontSize: FONT.size.md, fontWeight: FONT.weight.bold, marginBottom: SPACE[4] },
  cardMeta:        { flexDirection: "row", gap: SPACE[6], flexWrap: "wrap", marginBottom: SPACE[4] },
  chip:            { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: RADIUS.pill,
                     paddingHorizontal: SPACE[8], paddingVertical: 3, borderWidth: 1 },
  chipText:        { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
  memberCountRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  memberCountText: { fontSize: FONT.size.xs },
  joinBtn:         { borderRadius: RADIUS.md, paddingHorizontal: SPACE[14], paddingVertical: SPACE[8],
                     minWidth: 60, alignItems: "center" },
  joinText:        { fontWeight: FONT.weight.bold, fontSize: FONT.size.sm },

  // Detail popup
  popupBackdrop:   { position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                     backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center",
                     alignItems: "center", padding: SPACE[20], zIndex: 100 },
  popupCard:       { width: "100%", borderRadius: RADIUS.xxl, padding: SPACE[20],
                     maxHeight: SCREEN_H * 0.78 },
  popupClose:      { alignSelf: "flex-end", marginBottom: SPACE[4] },
  popupTop:        { alignItems: "center", gap: SPACE[8] },
  popupEmoji:      { width: 72, height: 72, borderRadius: RADIUS.xl, alignItems: "center", justifyContent: "center" },
  popupName:       { fontSize: FONT.size.xl, fontWeight: FONT.weight.black, textAlign: "center" },
  popupChips:      { flexDirection: "row", gap: SPACE[6], flexWrap: "wrap", justifyContent: "center" },
  popupField:      { flexDirection: "row", alignItems: "flex-start", gap: SPACE[6],
                     paddingHorizontal: SPACE[12], paddingVertical: SPACE[8],
                     borderRadius: RADIUS.md, borderWidth: 1, marginTop: SPACE[4] },
  popupFieldText:  { flex: 1, fontSize: FONT.size.sm, color: "#666" },
  popupDesc:       { fontSize: FONT.size.sm, textAlign: "center", lineHeight: FONT.size.sm * 1.5 },
  popupDivider:    { height: 1, marginVertical: SPACE[14] },
  popupMemberHeader:{ fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 1, marginBottom: SPACE[8] },
  memberList:      { maxHeight: 180 },
  memberRow:       { flexDirection: "row", alignItems: "center", gap: SPACE[10], paddingVertical: SPACE[6] },
  memberName:      { fontSize: FONT.size.md, fontWeight: FONT.weight.semibold },
  popupJoinBtn:    { borderRadius: RADIUS.lg, paddingVertical: SPACE[14], alignItems: "center", marginTop: SPACE[12] },
  popupJoinText:   { fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },

  // Create modal
  modal:           { flex: 1 },
  modalHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                     paddingHorizontal: SPACE[20], paddingVertical: SPACE[16], borderBottomWidth: 1 },
  modalTitle:      { fontSize: FONT.size.xl, fontWeight: FONT.weight.black },
  modalBody:       { padding: SPACE[20], gap: SPACE[8], paddingBottom: SPACE[40] },
  fieldLabel:      { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, textTransform: "uppercase",
                     letterSpacing: 0.8, marginBottom: SPACE[8] },
  emojiRow:        { flexDirection: "row", gap: SPACE[10] },
  emojiOpt:        { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: "center",
                     justifyContent: "center", borderWidth: 1 },
  emojiText:       { fontSize: 24 },
  input:           { borderRadius: RADIUS.lg, paddingHorizontal: SPACE[16], paddingVertical: SPACE[14],
                     fontSize: FONT.size.md, borderWidth: 1.5 },
  textArea:        { height: 88, textAlignVertical: "top", paddingTop: SPACE[12] },
  // Category tabs in form
  catTabRow:       { flexDirection: "row", borderBottomWidth: 1, marginBottom: SPACE[12] },
  catTab:          { flex: 1, alignItems: "center", paddingVertical: SPACE[10], gap: 3,
                     borderBottomWidth: 2, borderBottomColor: "transparent" },
  catTabText:      { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
  actGrid:         { flexDirection: "row", flexWrap: "wrap", gap: SPACE[8] },
  actChip:         { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[14], paddingVertical: SPACE[6], borderWidth: 1 },
  actChipText:     { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  locationRow:     { flexDirection: "row", gap: SPACE[8], alignItems: "center" },
  inputFlex:       { flex: 1, borderRadius: RADIUS.lg, paddingHorizontal: SPACE[16], paddingVertical: SPACE[14],
                     fontSize: FONT.size.md, borderWidth: 1.5 },
  mapBtn:          { width: 50, height: 50, borderRadius: RADIUS.lg, alignItems: "center",
                     justifyContent: "center", borderWidth: 1.5 },
  createBtn:       { borderRadius: RADIUS.xl, paddingVertical: SPACE[16], alignItems: "center", marginTop: SPACE[8] },
  createBtnText:   { color: "#fff", fontWeight: FONT.weight.extrabold, fontSize: FONT.size.lg },
  mapOverlay:      { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 },
  selectedDateRow: { flexDirection: "row", alignItems: "center", gap: SPACE[8], paddingHorizontal: SPACE[14], paddingVertical: SPACE[10], borderRadius: RADIUS.md, borderWidth: 1 },
  selectedDateText:{ flex: 1, fontSize: FONT.size.md, fontWeight: FONT.weight.bold },
  timeHeaderRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timeToggle:      { paddingHorizontal: SPACE[12], paddingVertical: SPACE[8], borderRadius: RADIUS.pill, borderWidth: 1 },
  timeToggleText:  { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  timePickerWrap:  { borderRadius: RADIUS.xl, borderWidth: 1, paddingVertical: SPACE[20] },
});

// ─── Calendar styles ──────────────────────────────────────────────────────────
const cl = StyleSheet.create({
  root:    { paddingVertical: SPACE[8] },
  nav:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE[10] },
  arrow:   { fontSize: 26, lineHeight: 30, fontWeight: "300", paddingHorizontal: SPACE[4] },
  month:   { fontSize: FONT.size.base, fontWeight: FONT.weight.extrabold },
  row:     { flexDirection: "row", marginBottom: 2 },
  dayHdr:  { width: CELL_SIZE, textAlign: "center", fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, paddingBottom: 4 },
  cell:    { width: CELL_SIZE, height: CELL_SIZE, alignItems: "center", justifyContent: "center" },
  dayTxt:  { fontSize: FONT.size.sm },
});

// ─── Time picker styles ───────────────────────────────────────────────────────
const tp = StyleSheet.create({
  root:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE[16] },
  col:      { alignItems: "center", gap: SPACE[6] },
  arrow:    { padding: SPACE[8] },
  arrowTxt: { fontSize: 16, lineHeight: 20 },
  val:      { fontSize: 36, fontWeight: FONT.weight.black, width: 60, textAlign: "center" },
  colon:    { fontSize: 36, fontWeight: FONT.weight.black, marginBottom: 2 },
});
