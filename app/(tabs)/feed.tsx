import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { ErrorState } from "../../components/ui/ErrorState";
import { Avatar } from "../../components/Avatar";
import { useTheme, SPACE, FONT, RADIUS, PALETTE, BRAND } from "../../lib/theme";
import { Icon } from "../../components/Icon";

const POST_TYPE_META: Record<string, { emoji: string; label: string; color: string }> = {
  workout:   { emoji: "💪", label: "logged a workout",     color: BRAND.primary },
  goal:      { emoji: "🎯", label: "hit a goal",           color: PALETTE.success },
  badge:     { emoji: "🏅", label: "earned a badge",       color: "#FFD700" },
  match:     { emoji: "🤝", label: "made a match",         color: PALETTE.info },
  event:     { emoji: "📅", label: "joined an event",      color: "#a855f7" },
  milestone: { emoji: "🔥", label: "reached a milestone",  color: "#f97316" },
};

const KUDOS_EMOJIS = ["🔥", "💪", "🎉", "❤️", "⚡"];

type FeedPost = {
  id: string;
  user_id: string;
  post_type: string;
  content: string | null;
  meta: Record<string, any>;
  kudos_count: number;
  created_at: string;
  author: { full_name: string | null; username: string; avatar_url: string | null; current_streak: number };
  myReaction: string | null;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function FeedScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [me, setMe] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeType, setComposeType] = useState("workout");
  const [composeContent, setComposeContent] = useState("");
  const [reactingId, setReactingId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
    setError(false);
    if (!isRefresh) setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);

    const { data: matchData } = await supabase
      .from("matches")
      .select("sender_id,receiver_id")
      .eq("status", "accepted")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
    const friendIds = (matchData ?? []).map((m: any) =>
      m.sender_id === user.id ? m.receiver_id : m.sender_id
    );
    const allIds = [user.id, ...friendIds];

    const { data: postsData } = await supabase
      .from("feed_posts")
      .select("id,user_id,post_type,content,meta,kudos_count,created_at")
      .in("user_id", allIds)
      .order("created_at", { ascending: false })
      .limit(40);

    if (!postsData || postsData.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const authorIds = [...new Set(postsData.map((p: any) => p.user_id))];
    const { data: authorsData } = await supabase
      .from("users")
      .select("id,full_name,username,avatar_url,current_streak")
      .in("id", authorIds);
    const authorMap = Object.fromEntries((authorsData ?? []).map((a: any) => [a.id, a]));

    const postIds = postsData.map((p: any) => p.id);
    const { data: reactionsData } = await supabase
      .from("feed_reactions")
      .select("post_id,emoji")
      .eq("user_id", user.id)
      .in("post_id", postIds);
    const reactionMap = Object.fromEntries((reactionsData ?? []).map((r: any) => [r.post_id, r.emoji]));

    setPosts(postsData.map((p: any) => ({
      ...p,
      author: authorMap[p.user_id] ?? { full_name: null, username: "?", avatar_url: null, current_streak: 0 },
      myReaction: reactionMap[p.id] ?? null,
    })));
    } catch (err) {
      console.error("[Feed] load failed:", err);
      if (isRefresh) {
        Alert.alert("Error", "Could not refresh. Please try again.");
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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

  async function react(post: FeedPost, emoji: string) {
    if (!me || reactingId) return;
    setReactingId(post.id);

    if (post.myReaction === emoji) {
      await supabase.from("feed_reactions").delete()
        .eq("post_id", post.id).eq("user_id", me);
      setPosts((prev) => prev.map((p) =>
        p.id === post.id ? { ...p, kudos_count: Math.max(p.kudos_count - 1, 0), myReaction: null } : p
      ));
    } else {
      if (post.myReaction) {
        await supabase.from("feed_reactions").update({ emoji })
          .eq("post_id", post.id).eq("user_id", me);
      } else {
        await supabase.from("feed_reactions").insert({ post_id: post.id, user_id: me, emoji });
      }
      setPosts((prev) => prev.map((p) =>
        p.id === post.id
          ? { ...p, kudos_count: post.myReaction ? p.kudos_count : p.kudos_count + 1, myReaction: emoji }
          : p
      ));
    }
    setReactingId(null);
  }

  async function publishPost() {
    if (!me || !composeContent.trim()) return;
    setPosting(true);
    await supabase.from("feed_posts").insert({
      user_id: me,
      post_type: composeType,
      content: composeContent.trim(),
      meta: {},
    });
    setComposeContent("");
    setShowCompose(false);
    setPosting(false);
    load();
  }

  const renderPost = ({ item: post }: { item: FeedPost }) => {
    const meta = POST_TYPE_META[post.post_type] ?? POST_TYPE_META.workout;
    const isMe = post.user_id === me;
    const displayName = isMe ? "You" : (post.author.full_name ?? post.author.username);

    return (
      <View style={[s.card, { backgroundColor: c.bgCard, borderColor: c.border }]}>
        <View style={s.authorRow}>
          <Avatar
            url={post.author.avatar_url}
            name={post.author.username || post.author.full_name || "?"}
            size={42}
          />
          <View style={{ flex: 1 }}>
            <Text style={[s.authorName, { color: c.text }]}>
              {displayName}{" "}
              <Text style={[s.actionLabel, { color: meta.color }]}>
                {meta.emoji} {meta.label}
              </Text>
            </Text>
            <Text style={[s.authorMeta, { color: c.textMuted }]}>
              {timeAgo(post.created_at)}
              {post.author.current_streak > 0 ? `  ·  🔥 ${post.author.current_streak}d` : ""}
            </Text>
          </View>
        </View>

        {post.content ? (
          <Text style={[s.content, { color: c.textSecondary }]}>{post.content}</Text>
        ) : null}

        <View style={[s.kudosRow, { borderTopColor: c.border }]}>
          {KUDOS_EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={[
                s.emojiBtn,
                { borderColor: c.border },
                post.myReaction === emoji && { backgroundColor: meta.color + "22", borderColor: meta.color + "66" },
              ]}
              onPress={() => react(post, emoji)}
              disabled={!!reactingId}
              activeOpacity={0.7}
            >
              <Text style={s.emojiBtnText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
          <View style={s.kudosCount}>
            <Text style={[s.kudosCountText, { color: c.textMuted }]}>🔥 {post.kudos_count}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.title, { color: c.text }]}>Activity Feed</Text>
          <Text style={[s.subtitle, { color: c.textMuted }]}>Your matches' latest activity</Text>
        </View>
        <TouchableOpacity
          style={[s.postBtn, { backgroundColor: c.brand }]}
          onPress={() => setShowCompose(true)}
        >
          <Icon name="add" size={15} color="#fff" />
          <Text style={s.postBtnText}>Post</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={c.brand} size="large" style={{ flex: 1 }} />
      ) : error ? (
        <ErrorState onRetry={load} message="Could not load the feed." />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Icon name="message" size={48} color={c.textMuted} />
              <Text style={[s.emptyTitle, { color: c.text }]}>Your feed is empty</Text>
              <Text style={[s.emptyText, { color: c.textMuted }]}>Connect with workout buddies to see their activity here</Text>
              <TouchableOpacity
                style={[s.discoverBtn, { backgroundColor: c.brand }]}
                onPress={() => router.push("/(tabs)/discover")}
              >
                <Text style={s.discoverBtnText}>Find Partners</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Compose Modal */}
      <Modal visible={showCompose} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[s.flex, { backgroundColor: c.bg }]}>
          <View style={[s.modalHeader, { borderBottomColor: c.border }]}>
            <Text style={[s.modalTitle, { color: c.text }]}>Share Activity</Text>
            <TouchableOpacity onPress={() => setShowCompose(false)} style={s.closeBtn}>
              <Icon name="close" size={22} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={{ padding: SPACE[20], gap: SPACE[16] }} keyboardShouldPersistTaps="handled">
            <Text style={[s.fieldLabel, { color: c.textMuted }]}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACE[4] }}>
              <View style={{ flexDirection: "row", gap: SPACE[8] }}>
                {Object.entries(POST_TYPE_META).map(([key, val]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      s.typeChip,
                      { backgroundColor: c.bgCard, borderColor: c.border },
                      composeType === key && { backgroundColor: val.color, borderColor: val.color },
                    ]}
                    onPress={() => setComposeType(key)}
                  >
                    <Text style={[s.typeChipText, { color: composeType === key ? "#fff" : c.textMuted }]}>
                      {val.emoji} {key.charAt(0).toUpperCase() + key.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={[s.fieldLabel, { color: c.textMuted, marginTop: SPACE[8] }]}>Your update</Text>
            <TextInput
              style={[s.textArea, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text }]}
              value={composeContent}
              onChangeText={setComposeContent}
              placeholder={`Share your ${composeType} update...`}
              placeholderTextColor={c.textFaint}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity
              style={[s.publishBtn, { backgroundColor: c.brand }, (!composeContent.trim() || posting) && { opacity: 0.5 }]}
              onPress={publishPost}
              disabled={!composeContent.trim() || posting}
            >
              {posting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={s.publishBtnInner}>
                  <Icon name="send" size={16} color="#fff" />
                  <Text style={s.publishBtnText}>Post</Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: SPACE[20], paddingTop: SPACE[12], paddingBottom: SPACE[12] },
  title: { fontSize: 22, fontWeight: FONT.weight.extrabold },
  subtitle: { fontSize: FONT.size.xs, marginTop: 2 },
  postBtn: { flexDirection: "row", alignItems: "center", gap: SPACE[4], borderRadius: RADIUS.pill, paddingHorizontal: SPACE[14], paddingVertical: SPACE[8] },
  postBtnText: { color: "#fff", fontWeight: FONT.weight.bold, fontSize: FONT.size.sm },
  list: { paddingHorizontal: SPACE[16], paddingBottom: SPACE[40] },
  card: { borderRadius: RADIUS.lg, padding: SPACE[14], marginBottom: SPACE[12], borderWidth: 1, gap: SPACE[10] },
  authorRow: { flexDirection: "row", alignItems: "center", gap: SPACE[10] },
  authorName: { fontSize: FONT.size.base, fontWeight: FONT.weight.bold, lineHeight: 20 },
  actionLabel: { fontWeight: FONT.weight.semibold },
  authorMeta: { fontSize: FONT.size.xs, marginTop: 2 },
  content: { fontSize: FONT.size.base, lineHeight: 21 },
  kudosRow: { flexDirection: "row", alignItems: "center", gap: SPACE[6], borderTopWidth: 1, paddingTop: SPACE[10] },
  emojiBtn: { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[8], paddingVertical: SPACE[4], borderWidth: 1, backgroundColor: "transparent" },
  emojiBtnText: { fontSize: FONT.size.base },
  kudosCount: { marginLeft: "auto" as any },
  kudosCountText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },
  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: SPACE[32], gap: SPACE[10] },
  emptyTitle: { fontSize: 18, fontWeight: FONT.weight.extrabold },
  emptyText: { fontSize: FONT.size.base, textAlign: "center" },
  discoverBtn: { borderRadius: RADIUS.md, paddingHorizontal: SPACE[28], paddingVertical: SPACE[12], marginTop: SPACE[8] },
  discoverBtnText: { color: "#fff", fontWeight: FONT.weight.bold, fontSize: FONT.size.md },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: SPACE[20], paddingVertical: SPACE[16], borderBottomWidth: 1 },
  modalTitle: { fontSize: FONT.size.xl, fontWeight: FONT.weight.black },
  closeBtn: { padding: SPACE[4] },
  fieldLabel: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 0.8 },
  typeChip: { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[12], paddingVertical: 7, borderWidth: 1 },
  typeChipText: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold },
  textArea: { borderRadius: RADIUS.md, paddingHorizontal: SPACE[16], paddingVertical: SPACE[14], fontSize: FONT.size.md, borderWidth: 1.5, minHeight: 100, textAlignVertical: "top" },
  publishBtn: { borderRadius: RADIUS.lg, paddingVertical: 18, alignItems: "center", marginTop: SPACE[8] },
  publishBtnInner: { flexDirection: "row", alignItems: "center", gap: SPACE[8] },
  publishBtnText: { color: "#fff", fontWeight: FONT.weight.extrabold, fontSize: FONT.size.lg },
});
