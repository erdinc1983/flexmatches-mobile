import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";

type Notif = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
  related_id: string | null;
};

const TYPE_ICON: Record<string, string> = {
  match_request: "🤝",
  match_accepted: "✅",
  new_message: "💬",
  badge_unlocked: "🏆",
  streak_reminder: "🔥",
  goal_completed: "🎯",
  workout_invite: "📅",
};

export default function NotificationsScreen() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase
      .from("notifications")
      .select("id, type, message, read, created_at, related_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setNotifs(data ?? []);
    setLoading(false);

    // Mark all as read
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function handlePress(notif: Notif) {
    if (notif.type === "new_message" && notif.related_id) {
      router.push(`/chat/${notif.related_id}`);
    } else if (notif.type === "match_request" || notif.type === "match_accepted") {
      router.push("/(tabs)/matches");
    }
  }

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator color="#FF4500" size="large" style={{ flex: 1 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      {notifs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.emptyTitle}>All quiet</Text>
          <Text style={styles.emptyText}>Notifications will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF4500" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, !item.read && styles.rowUnread]}
              onPress={() => handlePress(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, !item.read && styles.iconWrapUnread]}>
                <Text style={styles.icon}>{TYPE_ICON[item.type] ?? "🔔"}</Text>
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.message, !item.read && styles.messageUnread]} numberOfLines={2}>
                  {item.message}
                </Text>
                <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
              </View>
              {!item.read && <View style={styles.dot} />}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 24, color: "#888" },
  title: { fontSize: 18, fontWeight: "800", color: "#fff" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 14, borderBottomWidth: 1, borderBottomColor: "#111" },
  rowUnread: { backgroundColor: "#FF450008" },
  iconWrap: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  iconWrapUnread: { backgroundColor: "#FF450020", borderWidth: 1, borderColor: "#FF450044" },
  icon: { fontSize: 22 },
  rowContent: { flex: 1, gap: 4 },
  message: { fontSize: 14, color: "#888", lineHeight: 20 },
  messageUnread: { color: "#fff", fontWeight: "600" },
  time: { fontSize: 12, color: "#444" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF4500", flexShrink: 0 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },
  emptyText: { fontSize: 14, color: "#555" },
});
