import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { Avatar } from "../components/Avatar";

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

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setMyId(user?.id ?? null));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }

    debounceRef.current = setTimeout(() => search(query.trim()), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  async function search(q: string) {
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select("id, username, full_name, avatar_url, fitness_level, city, current_streak")
      .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
      .neq("id", myId ?? "")
      .limit(20);

    setResults(data ?? []);
    setLoading(false);
  }

  async function sendRequest(targetId: string) {
    if (!myId) return;
    const { error } = await supabase.from("matches").insert({
      sender_id: myId,
      receiver_id: targetId,
      status: "pending",
    });
    if (!error) {
      setResults(r => r.filter(u => u.id !== targetId));
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or username..."
          placeholderTextColor="#444"
          autoFocus
          returnKeyType="search"
        />
      </View>

      {loading && (
        <ActivityIndicator color="#FF4500" style={{ marginTop: 40 }} />
      )}

      {!loading && query.length > 0 && results.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyText}>No users found for "{query}"</Text>
        </View>
      )}

      {!loading && query.length === 0 && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>Search for gym partners by name or username</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const levelColor = item.fitness_level ? LEVEL_COLOR[item.fitness_level] : "#555";
          return (
            <View style={styles.row}>
              <Avatar url={item.avatar_url} name={item.username} size={52} />
              <View style={styles.info}>
                <Text style={styles.name}>{item.full_name ?? item.username}</Text>
                <Text style={styles.username}>@{item.username}</Text>
                <View style={styles.chips}>
                  {item.fitness_level && (
                    <View style={[styles.chip, { borderColor: levelColor + "55" }]}>
                      <Text style={[styles.chipText, { color: levelColor }]}>{item.fitness_level}</Text>
                    </View>
                  )}
                  {item.city && (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>📍 {item.city}</Text>
                    </View>
                  )}
                  {item.current_streak > 0 && (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>🔥 {item.current_streak}</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity style={styles.connectBtn} onPress={() => sendRequest(item.id)} activeOpacity={0.8}>
                <Text style={styles.connectText}>Connect</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  backBtn: { padding: 4 },
  backText: { fontSize: 24, color: "#888" },
  input: { flex: 1, backgroundColor: "#141414", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11, color: "#fff", fontSize: 15, borderWidth: 1, borderColor: "#222" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: "#111" },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: "700", color: "#fff" },
  username: { fontSize: 12, color: "#555" },
  chips: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#222", backgroundColor: "#111" },
  chipText: { fontSize: 11, color: "#666", fontWeight: "600" },
  connectBtn: { backgroundColor: "#FF4500", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  connectText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 14, color: "#555" },
  hint: { flex: 1, alignItems: "center", justifyContent: "center" },
  hintText: { fontSize: 14, color: "#333", textAlign: "center", paddingHorizontal: 40 },
});
