import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { useTheme } from "../lib/theme";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";

type MatchStatus = "none" | "pending" | "accepted" | "sending";

type User = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  fitness_level: string | null;
  city: string | null;
  current_streak: number;
};

const LEVEL_COLOR: Record<string, string> = {
  beginner: "#22c55e",
  intermediate: "#f59e0b",
  advanced: "#FF4500",
};

/**
 * Escape characters that have special meaning in PostgREST ILIKE patterns or
 * filter strings, preventing wildcard abuse and OR-clause injection.
 *
 * ILIKE wildcards:  % → \%   _ → \_
 * PostgREST syntax: , ( ) removed (these delimit OR conditions and groups)
 */
function sanitizeILike(q: string): string {
  return q
    .replace(/\\/g, "\\\\")  // escape backslash first
    .replace(/%/g, "\\%")    // % is ILIKE wildcard → treat as literal
    .replace(/_/g, "\\_")    // _ is ILIKE single-char wildcard → treat as literal
    .replace(/[,()']/g, ""); // strip PostgREST OR/grouping syntax chars
}

export default function SearchScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState<User[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [myId,     setMyId]     = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, MatchStatus>>({});
  const [matchIds, setMatchIds] = useState<Record<string, string>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setMyId(user?.id ?? null));
  }, []);

  useEffect(() => {
    // Debounced search. Intentionally only depends on `query` — including
    // `search` (a regular fn, new every render) would reset the debounce
    // timer on every render and defeat the debounce entirely.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setStatuses({}); return; }

    debounceRef.current = setTimeout(() => search(query.trim()), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function search(q: string) {
    if (!myId) return;
    setLoading(true);
    const safe = sanitizeILike(q);
    const { data } = await supabase
      .from("users")
      .select("id, username, full_name, avatar_url, fitness_level, city, current_streak")
      .or(`username.ilike.%${safe}%,full_name.ilike.%${safe}%`)
      .neq("id", myId)
      .limit(20);

    const users = data ?? [];
    setResults(users);

    // Load existing match statuses for all results
    if (users.length > 0) {
      const ids = users.map((u: User) => u.id);
      const { data: matches } = await supabase
        .from("matches")
        .select("id, sender_id, receiver_id, status")
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .in("sender_id", [myId, ...ids])
        .in("receiver_id", [myId, ...ids]);

      const newStatuses: Record<string, MatchStatus> = {};
      const newMatchIds: Record<string, string> = {};
      for (const m of matches ?? []) {
        const otherId = m.sender_id === myId ? m.receiver_id : m.sender_id;
        if (m.status === "accepted") {
          newStatuses[otherId] = "accepted";
          newMatchIds[otherId] = m.id;
        } else if (m.status === "pending") {
          newStatuses[otherId] = "pending";
          newMatchIds[otherId] = m.id;
        }
      }
      setStatuses(newStatuses);
      setMatchIds(newMatchIds);
    }

    setLoading(false);
  }

  async function sendRequest(targetId: string) {
    if (!myId || statuses[targetId] === "sending") return;
    setStatuses(prev => ({ ...prev, [targetId]: "sending" }));
    try {
      const { data, error } = await supabase.from("matches").insert({
        sender_id: myId,
        receiver_id: targetId,
        status: "pending",
      }).select("id").single();
      if (error) throw error;
      setStatuses(prev => ({ ...prev, [targetId]: "pending" }));
      if (data) setMatchIds(prev => ({ ...prev, [targetId]: data.id }));
    } catch {
      Alert.alert("Error", "Could not send request. Please try again.");
      setStatuses(prev => ({ ...prev, [targetId]: "none" }));
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="back" size={24} color={c.textMuted} />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { backgroundColor: c.bgCard, color: c.text, borderColor: c.border }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or username..."
          placeholderTextColor={c.textFaint}
          autoFocus
          returnKeyType="search"
        />
      </View>

      {loading && (
        <ActivityIndicator color={c.brand} style={{ marginTop: 40 }} />
      )}

      {!loading && query.length > 0 && results.length === 0 && (
        <View style={styles.empty}>
          <Icon name="search" size={44} color={c.textMuted} />
          <Text style={[styles.emptyText, { color: c.textMuted }]}>No users found for "{query}"</Text>
        </View>
      )}

      {!loading && query.length === 0 && (
        <View style={styles.hint}>
          <Text style={[styles.hintText, { color: c.textFaint }]}>Search for gym partners by name or username</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const levelColor = item.fitness_level ? LEVEL_COLOR[item.fitness_level] : c.textMuted;
          return (
            <View style={[styles.row, { borderBottomColor: c.border }]}>
              <Avatar url={item.avatar_url} name={item.username} size={52} />
              <View style={styles.info}>
                <Text style={[styles.name, { color: c.text }]}>{item.full_name ?? item.username}</Text>
                <Text style={[styles.username, { color: c.textMuted }]}>@{item.username}</Text>
                <View style={styles.chips}>
                  {item.fitness_level && (
                    <View style={[styles.chip, { borderColor: levelColor + "55", backgroundColor: c.bgCard }]}>
                      <Text style={[styles.chipText, { color: levelColor }]}>{item.fitness_level}</Text>
                    </View>
                  )}
                  {item.city && (
                    <View style={[styles.chip, { borderColor: c.border, backgroundColor: c.bgCard }]}>
                      <Text style={[styles.chipText, { color: c.textMuted }]}>📍 {item.city}</Text>
                    </View>
                  )}
                  {item.current_streak > 0 && (
                    <View style={[styles.chip, { borderColor: c.border, backgroundColor: c.bgCard }]}>
                      <Text style={[styles.chipText, { color: c.textMuted }]}>🔥 {item.current_streak}</Text>
                    </View>
                  )}
                </View>
              </View>
              {(statuses[item.id] === "none" || !statuses[item.id]) && (
                <TouchableOpacity style={[styles.connectBtn, { backgroundColor: c.brand }]} onPress={() => sendRequest(item.id)} activeOpacity={0.8}>
                  <Text style={styles.connectText}>Connect</Text>
                </TouchableOpacity>
              )}
              {statuses[item.id] === "sending" && (
                <View style={[styles.connectBtn, { backgroundColor: c.brand }]}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              )}
              {statuses[item.id] === "pending" && (
                <View style={[styles.connectBtn, styles.pendingBtn, { borderColor: c.border }]}>
                  <Text style={[styles.pendingText, { color: c.textMuted }]}>Pending</Text>
                </View>
              )}
              {statuses[item.id] === "accepted" && (
                <TouchableOpacity
                  style={[styles.connectBtn, styles.connectedBtn]}
                  onPress={() => matchIds[item.id] && router.push(`/chat/${matchIds[item.id]}` as any)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.connectedText}>Connected</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  input: { flex: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11, fontSize: 15, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1 },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: "700" },
  username: { fontSize: 12 },
  chips: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  chipText: { fontSize: 11, fontWeight: "600" },
  connectBtn:    { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, minWidth: 80, alignItems: "center" },
  connectText:   { color: "#fff", fontWeight: "700", fontSize: 13 },
  pendingBtn:    { backgroundColor: "transparent", borderWidth: 1 },
  pendingText:   { fontWeight: "600", fontSize: 13 },
  connectedBtn:  { backgroundColor: "#16A34A" },
  connectedText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 14 },
  hint: { flex: 1, alignItems: "center", justifyContent: "center" },
  hintText: { fontSize: 14, textAlign: "center", paddingHorizontal: 40 },
});
