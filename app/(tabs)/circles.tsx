/**
 * Circles Screen
 *
 * Browse, join, and create local activity communities.
 * - Tap a circle → centered detail popup with member list
 * - Create circle: category-tabbed activity picker + field/venue with map picker
 * - New Circle disclosure: handled via Home tab discovery feed
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorState } from "../../components/ui/ErrorState";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, ScrollView,
  RefreshControl, Alert, KeyboardAvoidingView, Platform, Dimensions,
  useWindowDimensions,
} from "react-native";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ImageBackground } from "react-native";
import { supabase } from "../../lib/supabase";

const HERO_IMG = require("../../assets/images/circles-hero.jpeg");
import { useTheme, SPACE, FONT, RADIUS } from "../../lib/theme";
import { Icon } from "../../components/Icon";
import { Avatar } from "../../components/Avatar";
import { EmptyState } from "../../components/ui/EmptyState";
import { CirclesSkeleton } from "../../components/ui/Skeleton";
import { MapLocationPicker } from "../../components/MapLocationPicker";
import { scheduleEventReminder } from "../../lib/notifications";
import { notifyUser } from "../../lib/push";

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
  const { width: screenW } = useWindowDimensions();
  // 5 chips: All + 4 categories. Subtract horizontal padding (16×2) and gaps (8×4)
  const chipW = Math.floor((screenW - SPACE[16] * 2 - SPACE[8] * 4) / 5);

  const [communities,    setCommunities]    = useState<Community[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(false);
  const [refreshing,     setRefreshing]     = useState(false);
  const [userId,         setUserId]         = useState<string | null>(null);
  const [search,         setSearch]         = useState("");
  const [filterCat,      setFilterCat]      = useState("");
  const [showCreate,     setShowCreate]     = useState(false);
  const lastLoadRef  = useRef(0);
  const loadingRef   = useRef(false);
  const mountedRef   = useRef(true);

  const STALE_MS = 5 * 60_000; // 5 min cache per tab

  // Detail popup
  const [selectedCircle, setSelectedCircle] = useState<Community | null>(null);
  const [circleMembers,  setCircleMembers]  = useState<CircleMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [joiningId,      setJoiningId]      = useState<string | null>(null);
  const [popupView,      setPopupView]      = useState<"detail" | "edit">("detail");
  const [editName,       setEditName]       = useState("");
  const [editDesc,       setEditDesc]       = useState("");
  const [editField,      setEditField]      = useState("");
  const [editDate,       setEditDate]       = useState("");
  const [editTime,       setEditTime]       = useState("");
  const [editSaving,     setEditSaving]     = useState(false);

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
  const [createStep,     setCreateStep]     = useState<1|2|3|4>(1);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // ── Data ──────────────────────────────────────────────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
    if (mountedRef.current) setError(false);
    if (!isRefresh && mountedRef.current) setLoading(true);
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
    if (mountedRef.current) lastLoadRef.current = Date.now();
    } catch (err) {
      console.error("[Circles] load failed:", err);
      if (!mountedRef.current) return;
      if (isRefresh) {
        Alert.alert("Error", "Could not refresh. Please try again.");
      } else {
        setError(true);
      }
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const elapsed = Date.now() - lastLoadRef.current;
    if (elapsed > STALE_MS || communities.length === 0) load();
  }, [load, communities.length]));

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => { setLoading(false); setError(true); }, 30_000);
    return () => clearTimeout(t);
  }, [loading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  // ── Circle detail ─────────────────────────────────────────────────────────
  async function openCircle(circle: Community) {
    setSelectedCircle(circle);
    setPopupView("detail");
    setEditName(circle.name);
    setEditDesc(circle.description ?? "");
    setEditField(circle.field ?? "");
    setEditDate(circle.event_date ?? "");
    setEditTime(circle.event_time ?? "");
    setLoadingMembers(true);
    try {
      const { data } = await supabase
        .from("community_members")
        .select("user:users(id, username, full_name, avatar_url)")
        .eq("community_id", circle.id);
      setCircleMembers(
        (data ?? []).map((row: any) => row.user).filter(Boolean) as CircleMember[]
      );
    } catch (err) {
      console.error("[Circles] loadMembers failed:", err);
    } finally {
      setLoadingMembers(false);
    }
  }

  async function saveCircleEdit() {
    if (!selectedCircle || !editName.trim()) return;
    setEditSaving(true);
    const newEventDate = editDate || null;
    const eventAdded = newEventDate && newEventDate !== selectedCircle.event_date;
    await supabase.from("communities").update({
      name:        editName.trim(),
      description: editDesc.trim() || null,
      field:       editField.trim() || null,
      event_date:  newEventDate,
      event_time:  editTime.trim() || null,
    }).eq("id", selectedCircle.id);
    setCommunities((prev) => prev.map((c) =>
      c.id === selectedCircle.id
        ? { ...c, name: editName.trim(), description: editDesc.trim() || null, field: editField.trim() || null, event_date: newEventDate, event_time: editTime.trim() || null }
        : c
    ));
    setSelectedCircle((prev) => prev ? { ...prev, name: editName.trim(), description: editDesc.trim() || null, field: editField.trim() || null, event_date: newEventDate, event_time: editTime.trim() || null } : prev);

    // Notify all members when a new event date is set
    if (eventAdded && circleMembers.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      const dateLabel = newEventDate.split("-").slice(1).join("/"); // "MM/DD"
      for (const member of circleMembers) {
        if (member.id === user?.id) continue; // skip self
        notifyUser(member.id, {
          type: "match_accepted", // reuse generic type for delivery
          title: `📅 New event in ${editName.trim()}`,
          body: `Event scheduled for ${dateLabel}${editTime.trim() ? " at " + editTime.trim() : ""}`,
          relatedId: selectedCircle.id,
          data: { type: "circle_event", relatedId: selectedCircle.id },
        });
      }
    }

    setEditSaving(false);
    setPopupView("detail");
  }

  function confirmDeleteCircle() {
    if (!selectedCircle) return;
    Alert.alert(
      "Cancel event?",
      "This will permanently delete the circle and remove all members.",
      [
        { text: "Keep it", style: "cancel" },
        { text: "Delete circle", style: "destructive", onPress: async () => {
          await supabase.from("communities").delete().eq("id", selectedCircle.id);
          setCommunities((prev) => prev.filter((c) => c.id !== selectedCircle.id));
          setSelectedCircle(null);
        }},
      ]
    );
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function joinOrLeave(communityId: string, isMember: boolean) {
    if (!userId || joiningId) return;
    if (!isMember) {
      const circle = communities.find((c) => c.id === communityId) ?? selectedCircle;
      if (circle?.max_members != null && circle.member_count >= circle.max_members) {
        Alert.alert("Circle Full", "This circle is at capacity and isn't accepting new members.");
        return;
      }
    }
    setJoiningId(communityId);
    if (isMember) {
      await supabase.from("community_members").delete()
        .eq("community_id", communityId).eq("user_id", userId);
    } else {
      await supabase.from("community_members")
        .insert({ community_id: communityId, user_id: userId });

      // Schedule event reminder 24h before the event (if circle has a date)
      const circle = communities.find((c) => c.id === communityId) ?? selectedCircle;
      if (circle?.event_date) {
        const [y, m, d] = circle.event_date.split("-").map(Number);
        const eventDate = new Date(y, m - 1, d, 10, 0, 0); // 10am on event day
        scheduleEventReminder(circle.name, eventDate);
      }
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
    setJoiningId(null);
  }

  async function createCircle() {
    if (!formName.trim() || !userId) return;
    setSaving(true);
    const { data: created, error } = await supabase.from("communities").insert({
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
    }).select("id").single();
    if (error) { setSaving(false); Alert.alert("Error", error.message); return; }
    // Auto-join creator
    if (created?.id) {
      await supabase.from("community_members").insert({ community_id: created.id, user_id: userId });
    }
    setSaving(false);
    resetCreate();
    await load();
  }

  function resetCreate() {
    setShowCreate(false);
    setCreateStep(1);
    setFormName(""); setFormDesc(""); setFormActivity("Gym");
    setFormCatTab("fitness"); setFormCity(""); setFormField(""); setFormMaxMembers("");
    setFormEventDate(""); setFormEventHour(9); setFormEventMin(0); setFormUseTime(false); setFormEmoji("🏋️");
  }

  // ── Active vs Past split ────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const activeCircles = communities.filter((c) => !c.event_date || c.event_date >= todayStr);
  const pastCircles   = communities.filter((c) => c.event_date && c.event_date < todayStr);

  // ── Filter (search + category applied to active only) ───────────────────────
  const catActivities = filterCat
    ? (ACTIVITY_CATEGORIES.find((c) => c.key === filterCat)?.activities ?? []) as readonly string[]
    : [];
  const filtered = activeCircles.filter((c) => {
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
        <CirclesSkeleton />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <ErrorState onRetry={load} message="Could not load circles." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      {/* ── Hero image header ── */}
      <ImageBackground source={HERO_IMG} style={s.hero} resizeMode="cover">
        <LinearGradient
          colors={["rgba(0,0,0,0.18)", "rgba(0,0,0,0.62)"]}
          style={s.heroGradient}
        >
          <View style={s.heroContent}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>Circles</Text>
              <Text style={s.heroSub}>Your local activity communities</Text>
            </View>
            <TouchableOpacity
              style={s.newBtn}
              onPress={() => setShowCreate(true)}
              activeOpacity={0.85}
            >
              <Icon name="add" size={16} color="#FF4500" />
              <Text style={s.newBtnText}>New</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ImageBackground>

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
            accessibilityLabel="Search circles"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={14} color={c.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category filters — all 5 chips always fully visible */}
      <View style={[s.catRow, { paddingHorizontal: SPACE[16], marginBottom: SPACE[8] }]}>
        {[{ key: "", label: "All" }, ...ACTIVITY_CATEGORIES.map((cat) => ({ key: cat.key, label: cat.label }))].map(({ key, label }) => {
          const active = filterCat === key;
          return (
            <TouchableOpacity
              key={key}
              style={[s.catChip, { width: chipW, backgroundColor: active ? c.brand : c.bgCard, borderColor: active ? c.brand : c.border }]}
              onPress={() => {
                const next = active && key !== "" ? "" : key;
                setFilterCat(next);
              }}
              activeOpacity={0.8}
            >
              <Text style={[s.catChipText, { color: active ? "#fff" : c.text }]} numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
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
                joining={joiningId === item.id}
              />
            </>
          );
        }}
        ListEmptyComponent={
          listData.length === 0 && pastCircles.length === 0 ? (
            <EmptyState
              icon="circlesActive"
              title="No circles yet"
              subtitle="Create a circle for your local fitness community."
              action={{ label: "Create a Circle", onPress: () => setShowCreate(true) }}
            />
          ) : null
        }
        ListFooterComponent={
          pastCircles.length > 0 ? (
            <View style={{ marginTop: SPACE[24] }}>
              <Text style={[s.sectionLabel, { color: c.textMuted }]}>PAST EVENTS</Text>
              {pastCircles.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[s.card, pe.card, { backgroundColor: c.bgCard, borderColor: c.border }]}
                  onPress={() => openCircle(item)}
                  activeOpacity={0.8}
                >
                  <View style={[s.cardEmoji, { backgroundColor: c.bgCardAlt, opacity: 0.6 }]}>
                    <Text style={s.cardEmojiText}>{item.avatar_emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={pe.nameRow}>
                      <Text style={[s.cardName, { color: c.textSecondary, flex: 1 }]} numberOfLines={1}>{item.name}</Text>
                      <View style={pe.endedBadge}>
                        <Text style={pe.endedText}>Ended</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: FONT.size.xs, color: c.textFaint, marginTop: 2 }}>
                      {[item.sport, item.city].filter(Boolean).join(" · ")}
                      {item.event_date ? `  ·  ${formatCircleDate(item.event_date)}` : ""}
                    </Text>
                    <Text style={[pe.memberCount, { color: c.textFaint }]}>
                      {item.member_count} {item.member_count === 1 ? "member" : "members"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null
        }
      />

      {/* ── Circle detail popup ───────────────────────────────────────────────── */}
      {selectedCircle && (
        <TouchableOpacity
          style={s.popupBackdrop}
          activeOpacity={1}
          onPress={() => { setSelectedCircle(null); setPopupView("detail"); }}
        >
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
          <TouchableOpacity
            style={[s.popupCard, { backgroundColor: c.bgCard }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <TouchableOpacity
              style={s.popupClose}
              onPress={() => popupView === "edit" ? setPopupView("detail") : setSelectedCircle(null)}
              hitSlop={10}
            >
              <Icon name="close" size={20} color={c.textMuted} />
            </TouchableOpacity>

            {/* ── Detail view ── */}
            {popupView === "detail" && (<>
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
                    <Icon name="location" size={14} color={c.textMuted} />
                    <Text style={[s.popupFieldText, { color: c.textSecondary }]} numberOfLines={2}>
                      {selectedCircle.field}
                    </Text>
                  </View>
                )}
                {selectedCircle.event_date && (
                  <View style={[s.popupField, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}>
                    <Icon name="calendar" size={14} color={c.textMuted} />
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
                      <Text style={[s.memberName, { color: c.text }]}>{m.full_name ?? m.username}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Join / Leave */}
              {(() => {
                const isFull = !selectedCircle.is_member &&
                  selectedCircle.max_members != null &&
                  selectedCircle.member_count >= selectedCircle.max_members;
                return (
                  <TouchableOpacity
                    style={[
                      s.popupJoinBtn,
                      selectedCircle.is_member
                        ? { borderWidth: 1, borderColor: c.brandBorder, backgroundColor: "transparent" }
                        : isFull
                          ? { backgroundColor: c.border, opacity: 0.7 }
                          : { backgroundColor: c.brand },
                      joiningId === selectedCircle.id && { opacity: 0.6 },
                    ]}
                    onPress={() => joinOrLeave(selectedCircle.id, selectedCircle.is_member)}
                    disabled={!!joiningId || isFull}
                    activeOpacity={0.85}
                  >
                    {joiningId === selectedCircle.id
                      ? <ActivityIndicator color={selectedCircle.is_member ? c.brand : "#fff"} size="small" />
                      : <Text style={[s.popupJoinText, { color: selectedCircle.is_member ? c.brand : "#fff" }]}>
                          {selectedCircle.is_member ? "Leave Circle" : isFull ? "Circle Full" : "Join Circle"}
                        </Text>
                    }
                  </TouchableOpacity>
                );
              })()}

              {/* Creator actions */}
              {selectedCircle.creator_id === userId && (
                <View style={s.creatorRow}>
                  <TouchableOpacity
                    style={[s.creatorBtn, { backgroundColor: c.bgCardAlt, borderColor: c.border }]}
                    onPress={() => setPopupView("edit")}
                    activeOpacity={0.8}
                  >
                    <Icon name="edit" size={14} color={c.brand} />
                    <Text style={[s.creatorBtnText, { color: c.brand }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.creatorBtn, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}
                    onPress={confirmDeleteCircle}
                    activeOpacity={0.8}
                  >
                    <Icon name="close" size={14} color="#DC2626" />
                    <Text style={[s.creatorBtnText, { color: "#DC2626" }]}>Cancel Event</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>)}

            {/* ── Edit view ── */}
            {popupView === "edit" && (
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: SCREEN_H * 0.55 }}>
                <Text style={[s.editLabel, { color: c.textMuted }]}>Circle Name</Text>
                <TextInput style={[s.editInput, { backgroundColor: c.bgCardAlt, borderColor: c.border, color: c.text }]} value={editName} onChangeText={setEditName} placeholder="Circle name" placeholderTextColor={c.textFaint} />

                <Text style={[s.editLabel, { color: c.textMuted }]}>Description</Text>
                <TextInput style={[s.editInput, s.editTextArea, { backgroundColor: c.bgCardAlt, borderColor: c.border, color: c.text }]} value={editDesc} onChangeText={setEditDesc} placeholder="What's this circle about?" placeholderTextColor={c.textFaint} multiline numberOfLines={3} />

                <Text style={[s.editLabel, { color: c.textMuted }]}>Location / Venue</Text>
                <TextInput style={[s.editInput, { backgroundColor: c.bgCardAlt, borderColor: c.border, color: c.text }]} value={editField} onChangeText={setEditField} placeholder="e.g. Central Park Court 3" placeholderTextColor={c.textFaint} />

                <Text style={[s.editLabel, { color: c.textMuted }]}>Event Date (YYYY-MM-DD)</Text>
                <TextInput style={[s.editInput, { backgroundColor: c.bgCardAlt, borderColor: c.border, color: c.text }]} value={editDate} onChangeText={setEditDate} placeholder="2025-06-15" placeholderTextColor={c.textFaint} keyboardType="numbers-and-punctuation" />

                <Text style={[s.editLabel, { color: c.textMuted }]}>Event Time (HH:MM)</Text>
                <TextInput style={[s.editInput, { backgroundColor: c.bgCardAlt, borderColor: c.border, color: c.text }]} value={editTime} onChangeText={setEditTime} placeholder="09:00" placeholderTextColor={c.textFaint} keyboardType="numbers-and-punctuation" />

                <TouchableOpacity
                  style={[s.popupJoinBtn, { backgroundColor: editSaving || !editName.trim() ? c.bgCardAlt : c.brand, marginTop: SPACE[12] }]}
                  onPress={saveCircleEdit}
                  disabled={editSaving || !editName.trim()}
                  activeOpacity={0.85}
                >
                  {editSaving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={[s.popupJoinText, { color: "#fff" }]}>Save Changes</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.popupJoinBtn, { borderWidth: 1, borderColor: c.border, backgroundColor: "transparent", marginTop: SPACE[8] }]}
                  onPress={() => setPopupView("detail")}
                  activeOpacity={0.7}
                >
                  <Text style={[s.popupJoinText, { color: c.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

          </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      )}

      {/* ── Create Circle Wizard ─────────────────────────────────────────────── */}
      <Modal visible={showCreate && !showMapPicker} transparent animationType="fade" onRequestClose={resetCreate}>
        <KeyboardAvoidingView style={wiz.backdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={[wiz.card, { backgroundColor: c.bg }]}>
            {/* Header */}
            <View style={[wiz.header, { borderBottomColor: c.border }]}>
              <TouchableOpacity onPress={resetCreate} hitSlop={12}>
                <Icon name="close" size={20} color={c.textMuted} />
              </TouchableOpacity>
              <Text style={[wiz.title, { color: c.text }]}>New Circle</Text>
              <View style={{ width: 20 }} />
            </View>

            {/* Step dots */}
            <View style={wiz.dots}>
              {([1,2,3,4] as const).map((i) => (
                <View key={i} style={[wiz.dot, { backgroundColor: i <= createStep ? c.brand : c.border }]} />
              ))}
            </View>

            {/* Content */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={wiz.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Step 1 — Name & Icon */}
              {createStep === 1 && (
                <>
                  <Text style={[wiz.label, { color: c.textMuted }]}>Icon</Text>
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
                  <Text style={[wiz.label, { color: c.textMuted }]}>Circle Name *</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text }]}
                    value={formName}
                    onChangeText={setFormName}
                    placeholder="e.g. Sunday Soccer, Morning Runners"
                    placeholderTextColor={c.textMuted}
                    accessibilityLabel="Circle name"
                  />
                </>
              )}

              {/* Step 2 — Activity & Description */}
              {createStep === 2 && (
                <>
                  <Text style={[wiz.label, { color: c.textMuted }]}>Activity</Text>
                  <View style={[s.catTabRow, { borderColor: c.border }]}>
                    {ACTIVITY_CATEGORIES.map((cat) => {
                      const active = formCatTab === cat.key;
                      return (
                        <TouchableOpacity
                          key={cat.key}
                          style={[s.catTab, active && { borderBottomColor: c.brand }]}
                          onPress={() => {
                            setFormCatTab(cat.key);
                            if (!(cat.activities as readonly string[]).includes(formActivity)) {
                              setFormActivity(cat.activities[0]);
                            }
                          }}
                        >
                          <Text style={[s.catTabText, { color: active ? c.brand : c.textMuted }]}>{cat.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={[s.actGrid, { marginBottom: SPACE[16] }]}>
                    {(tabActivities as readonly string[]).map((a) => {
                      const active = formActivity === a;
                      return (
                        <TouchableOpacity
                          key={a}
                          style={[s.actChip, { backgroundColor: active ? c.brandSubtle : "transparent", borderColor: active ? c.brand : c.borderMedium }]}
                          onPress={() => setFormActivity(a)}
                        >
                          <Text style={[s.actChipText, { color: active ? c.brand : c.textSecondary }]}>{a}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={[wiz.label, { color: c.textMuted }]}>Description (optional)</Text>
                  <TextInput
                    style={[s.input, s.textArea, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text }]}
                    value={formDesc}
                    onChangeText={setFormDesc}
                    placeholder="What's this circle about?"
                    placeholderTextColor={c.textMuted}
                    multiline
                    accessibilityLabel="Circle description"
                  />
                </>
              )}

              {/* Step 3 — Location & Size */}
              {createStep === 3 && (
                <>
                  <Text style={[wiz.label, { color: c.textMuted }]}>City (optional)</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text, marginBottom: SPACE[16] }]}
                    value={formCity}
                    onChangeText={setFormCity}
                    placeholder="e.g. Istanbul, New York"
                    placeholderTextColor={c.textMuted}
                    accessibilityLabel="Circle city"
                  />
                  <Text style={[wiz.label, { color: c.textMuted }]}>Field / Venue (optional)</Text>
                  <View style={[s.locationRow, { marginBottom: SPACE[16] }]}>
                    <TextInput
                      style={[s.inputFlex, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text }]}
                      value={formField}
                      onChangeText={setFormField}
                      placeholder="e.g. Central Park, Fenerbahçe Stadium"
                      placeholderTextColor={c.textMuted}
                      accessibilityLabel="Field or venue name"
                    />
                    <TouchableOpacity
                      style={[s.mapBtn, { backgroundColor: c.bgInput, borderColor: c.border }]}
                      onPress={() => setShowMapPicker(true)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Pick location on map"
                    >
                      <Icon name="map" size={18} color={c.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <Text style={[wiz.label, { color: c.textMuted }]}>Max Members (optional)</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text }]}
                    value={formMaxMembers}
                    onChangeText={(v) => setFormMaxMembers(v.replace(/[^0-9]/g, ""))}
                    placeholder="e.g. 10, 20 — unlimited if empty"
                    placeholderTextColor={c.textMuted}
                    keyboardType="number-pad"
                    accessibilityLabel="Maximum number of members"
                  />
                </>
              )}

              {/* Step 4 — Date & Time */}
              {createStep === 4 && (
                <>
                  <Text style={[wiz.label, { color: c.textMuted }]}>Date (optional)</Text>
                  {formEventDate ? (
                    <View style={[s.selectedDateRow, { backgroundColor: c.brand+"15", borderColor: c.brand+"60", marginBottom: SPACE[8] }]}>
                      <Icon name="calendar" size={14} color={c.brand} />
                      <Text style={[s.selectedDateText, { color: c.brand }]}>{formatCircleDate(formEventDate)}</Text>
                      <TouchableOpacity onPress={() => setFormEventDate("")} hitSlop={10}>
                        <Text style={{ color: c.textMuted, fontSize: 14 }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={{ fontSize: FONT.size.xs, color: c.textFaint, marginBottom: SPACE[4] }}>Tap a day to select</Text>
                  )}
                  <CalendarPicker value={formEventDate} onChange={setFormEventDate} colors={c} />
                  <View style={[s.timeHeaderRow, { marginTop: SPACE[12] }]}>
                    <Text style={[wiz.label, { color: c.textMuted, marginBottom: 0 }]}>Time</Text>
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
                    <View style={[s.timePickerWrap, { backgroundColor: c.bgCardAlt, borderColor: c.border, marginTop: SPACE[8] }]}>
                      <TimePickerInline
                        hour={formEventHour} minute={formEventMin}
                        onHourChange={setFormEventHour} onMinuteChange={setFormEventMin}
                        colors={c}
                      />
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {/* Nav buttons */}
            <View style={[wiz.nav, { borderTopColor: c.border }]}>
              {createStep > 1 ? (
                <TouchableOpacity
                  style={[wiz.backBtn, { borderColor: c.border }]}
                  onPress={() => setCreateStep((p) => (p - 1) as 1|2|3|4)}
                  activeOpacity={0.8}
                >
                  <Text style={[wiz.backText, { color: c.textMuted }]}>Back</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              {createStep < 4 ? (
                <TouchableOpacity
                  style={[wiz.nextBtn, { backgroundColor: c.brand }, createStep === 1 && !formName.trim() && { opacity: 0.4 }]}
                  onPress={() => setCreateStep((p) => (p + 1) as 1|2|3|4)}
                  disabled={createStep === 1 && !formName.trim()}
                  activeOpacity={0.85}
                >
                  <Text style={wiz.nextText}>Next →</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[wiz.nextBtn, { backgroundColor: c.brand }, saving && { opacity: 0.6 }]}
                  onPress={createCircle}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={wiz.nextText}>Create Circle</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Map Picker Modal ──────────────────────────────────────────────────── */}
      <Modal visible={showMapPicker} transparent animationType="slide" onRequestClose={() => setShowMapPicker(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", paddingHorizontal: 12, paddingBottom: 36 }}>
          <View style={{ borderRadius: 20, overflow: "hidden", height: SCREEN_H * 0.75 }}>
            <MapLocationPicker
              colors={c}
              onSelect={(loc) => { setFormField(loc); setShowMapPicker(false); }}
              onClose={() => setShowMapPicker(false)}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Circle Card ──────────────────────────────────────────────────────────────
function CircleCard({ item, onPress, onJoin, joining = false }: { item: Community; onPress: () => void; onJoin: () => void; joining?: boolean }) {
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

      {/* Join / Joined / Full */}
      {(() => {
        const isFull = !item.is_member && item.max_members != null && item.member_count >= item.max_members;
        return (
          <TouchableOpacity
            style={[
              s.joinBtn,
              item.is_member
                ? { backgroundColor: "transparent", borderWidth: 1, borderColor: c.brandBorder }
                : isFull
                  ? { backgroundColor: c.border, opacity: 0.7 }
                  : { backgroundColor: c.brand },
              joining && { opacity: 0.6 },
            ]}
            onPress={onJoin}
            disabled={joining || isFull}
            activeOpacity={0.8}
          >
            {joining
              ? <ActivityIndicator color={item.is_member ? c.brand : "#fff"} size="small" />
              : <Text style={[s.joinText, { color: item.is_member ? c.brand : "#fff" }]}>
                  {item.is_member ? "Joined" : isFull ? "Full" : "Join"}
                </Text>
            }
          </TouchableOpacity>
        );
      })()}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:            { flex: 1 },
  hero:            { height: 160, overflow: "hidden" },
  heroGradient:    { flex: 1, paddingHorizontal: SPACE[20], justifyContent: "flex-end", paddingBottom: SPACE[16] },
  heroContent:     { flexDirection: "row", alignItems: "center" },
  heroTitle:       { fontSize: FONT.size.xxxl, fontWeight: FONT.weight.black, color: "#fff", letterSpacing: -0.5 },
  heroSub:         { fontSize: FONT.size.xs, color: "rgba(255,255,255,0.80)", marginTop: 3 },
  newBtn:          { flexDirection: "row", alignItems: "center", gap: SPACE[4],
                     borderRadius: RADIUS.pill, paddingHorizontal: SPACE[14], paddingVertical: SPACE[8],
                     backgroundColor: "#fff" },
  newBtnText:      { color: "#FF4500", fontWeight: FONT.weight.extrabold, fontSize: FONT.size.sm },
  searchWrap:      { marginBottom: SPACE[10] },
  searchBar:       { flexDirection: "row", alignItems: "center", gap: SPACE[8],
                     borderRadius: RADIUS.lg, paddingHorizontal: SPACE[14], paddingVertical: SPACE[12], borderWidth: 1 },
  searchInput:     { flex: 1, fontSize: FONT.size.md, padding: 0 },
  catRow:          { flexDirection: "row", gap: SPACE[8] },
  catChip:         { borderRadius: RADIUS.pill, paddingVertical: SPACE[6], borderWidth: 1, alignItems: "center" },
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
  joinBtn:         { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[14], paddingVertical: SPACE[8],
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
  popupFieldText:  { flex: 1, fontSize: FONT.size.sm, color: "#8E8E93" },
  popupDesc:       { fontSize: FONT.size.sm, textAlign: "center", lineHeight: FONT.size.sm * 1.5 },
  popupDivider:    { height: 1, marginVertical: SPACE[14] },
  popupMemberHeader:{ fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 1, marginBottom: SPACE[8] },
  memberList:      { maxHeight: 180 },
  memberRow:       { flexDirection: "row", alignItems: "center", gap: SPACE[10], paddingVertical: SPACE[6] },
  memberName:      { fontSize: FONT.size.md, fontWeight: FONT.weight.semibold },
  popupJoinBtn:    { borderRadius: RADIUS.pill, paddingVertical: SPACE[14], alignItems: "center", marginTop: SPACE[12] },
  popupJoinText:   { fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold },
  creatorRow:      { flexDirection: "row", gap: SPACE[10], marginTop: SPACE[10] },
  creatorBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE[6], paddingVertical: SPACE[12], borderRadius: RADIUS.lg, borderWidth: 1 },
  creatorBtnText:  { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  editLabel:       { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: SPACE[6], marginTop: SPACE[12] },
  editInput:       { borderRadius: RADIUS.md, borderWidth: 1, paddingHorizontal: SPACE[12], paddingVertical: SPACE[10], fontSize: FONT.size.sm },
  editTextArea:    { minHeight: 80, textAlignVertical: "top" },

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
  createBtn:       { borderRadius: RADIUS.pill, paddingVertical: SPACE[16], alignItems: "center", marginTop: SPACE[8] },
  createBtnText:   { color: "#fff", fontWeight: FONT.weight.extrabold, fontSize: FONT.size.lg },
  mapOverlay:      { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 },
  selectedDateRow: { flexDirection: "row", alignItems: "center", gap: SPACE[8], paddingHorizontal: SPACE[14], paddingVertical: SPACE[10], borderRadius: RADIUS.md, borderWidth: 1 },
  selectedDateText:{ flex: 1, fontSize: FONT.size.md, fontWeight: FONT.weight.bold },
  timeHeaderRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timeToggle:      { paddingHorizontal: SPACE[12], paddingVertical: SPACE[8], borderRadius: RADIUS.pill, borderWidth: 1 },
  timeToggleText:  { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  timePickerWrap:  { borderRadius: RADIUS.xl, borderWidth: 1, paddingVertical: SPACE[20] },
});

// ─── Wizard styles ────────────────────────────────────────────────────────────
const wiz = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 16, paddingVertical: 40 },
  card:     { width: "100%", borderRadius: 24, height: SCREEN_H * 0.78 },
  header:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
              paddingHorizontal: SPACE[20], paddingVertical: SPACE[16], borderBottomWidth: 1 },
  title:    { fontSize: FONT.size.xl, fontWeight: FONT.weight.black },
  dots:     { flexDirection: "row", gap: 6, justifyContent: "center", paddingVertical: SPACE[12] },
  dot:      { width: 8, height: 8, borderRadius: 4 },
  body:     { padding: SPACE[20], paddingBottom: SPACE[8], gap: SPACE[8] },
  label:    { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, textTransform: "uppercase",
              letterSpacing: 0.8, marginBottom: SPACE[8] },
  nav:      { flexDirection: "row", gap: SPACE[10], paddingHorizontal: SPACE[20],
              paddingVertical: SPACE[16], borderTopWidth: 1 },
  backBtn:  { flex: 1, paddingVertical: SPACE[14], borderRadius: RADIUS.pill, borderWidth: 1.5, alignItems: "center" },
  backText: { fontSize: FONT.size.md, fontWeight: FONT.weight.semibold },
  nextBtn:  { flex: 2, paddingVertical: SPACE[14], borderRadius: RADIUS.pill, alignItems: "center" },
  nextText: { fontSize: FONT.size.md, fontWeight: FONT.weight.extrabold, color: "#fff" },
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

const pe = StyleSheet.create({
  card:        { opacity: 0.8 },
  nameRow:     { flexDirection: "row", alignItems: "center", gap: SPACE[8], flex: 1 },
  endedBadge:  { backgroundColor: "#F3F4F6", borderRadius: RADIUS.pill, paddingHorizontal: SPACE[8], paddingVertical: 2 },
  endedText:   { fontSize: 11, fontWeight: FONT.weight.bold, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 },
  memberCount: { fontSize: FONT.size.xs, marginTop: 2 },
});
