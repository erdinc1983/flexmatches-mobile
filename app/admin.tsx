/**
 * Admin Panel
 *
 * Protected to is_admin users only.
 * List all users, search/filter, and perform actions:
 * ban/unban, promote/demote admin, make/remove pro, delete, edit name/city.
 */

import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { useTheme, SPACE, FONT, RADIUS, PALETTE } from "../lib/theme";
import { Avatar } from "../components/Avatar";

const ADMIN_ACTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/admin-action`;

async function callAdminAction(
  body: { userId: string; action: string; updates?: Record<string, unknown> }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: "Not authenticated" };
    const res = await fetch(ADMIN_ACTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Network error" };
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
type AdminUser = {
  id:            string;
  full_name:     string | null;
  username:      string | null;
  city:          string | null;
  sports:        string[] | null;
  fitness_level: string | null;
  is_admin:      boolean;
  is_pro:        boolean;
  banned_at:     string | null;
  created_at:    string;
  avatar_url:    string | null;
};

type Filter = "all" | "banned" | "admins" | "pro";

type ActionType = "ban" | "unban" | "delete" | "promote" | "demote" | "make_pro" | "remove_pro";

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AdminScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [loading,       setLoading]       = useState(true);
  const [users,         setUsers]         = useState<AdminUser[]>([]);
  const [search,        setSearch]        = useState("");
  const [filter,        setFilter]        = useState<Filter>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    userId: string; name: string; action: ActionType;
  } | null>(null);

  const [editModal, setEditModal] = useState<{
    userId: string; full_name: string; city: string; fitness_level: string;
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/(auth)/login"); return; }
    const { data } = await supabase.from("users").select("is_admin").eq("id", user.id).single();
    if (!data?.is_admin) { router.replace("/(tabs)/home"); return; }
    loadUsers();
  }

  // ── Data ────────────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select("id, full_name, username, city, sports, fitness_level, is_admin, is_pro, banned_at, created_at, avatar_url")
      .order("created_at", { ascending: false });
    setUsers(data ?? []);
    setLoading(false);
  }, []);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function execAction(userId: string, action: ActionType) {
    setActionLoading(userId + action);
    setConfirmModal(null);

    const { ok, error } = await callAdminAction({ userId, action });

    if (ok) {
      if (action === "delete") {
        setUsers(prev => prev.filter(u => u.id !== userId));
        showToast("User deleted.");
      } else {
        // Optimistically update local state to reflect the change
        const patch: Partial<AdminUser> = {};
        if (action === "ban")        patch.banned_at = new Date().toISOString();
        if (action === "unban")      patch.banned_at = null;
        if (action === "promote")    patch.is_admin  = true;
        if (action === "demote")     patch.is_admin  = false;
        if (action === "make_pro")   patch.is_pro    = true;
        if (action === "remove_pro") patch.is_pro    = false;
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...patch } : u));
        showToast(
          action === "ban"        ? "User banned." :
          action === "unban"      ? "User unbanned." :
          action === "promote"    ? "Promoted to admin." :
          action === "demote"     ? "Admin access removed." :
          action === "make_pro"   ? "Upgraded to Pro." :
          action === "remove_pro" ? "Pro removed." : "Done."
        );
      }
    } else {
      showToast(error ?? "Action failed.", false);
    }

    setActionLoading(null);
  }

  async function saveEdit() {
    if (!editModal) return;
    setEditSaving(true);
    const { ok, error } = await callAdminAction({
      userId: editModal.userId,
      action: "edit",
      updates: {
        full_name:     editModal.full_name || null,
        city:          editModal.city || null,
        fitness_level: editModal.fitness_level || null,
      },
    });
    setEditSaving(false);
    if (!ok) { showToast(error ?? "Save failed.", false); return; }
    setUsers(prev => prev.map(u =>
      u.id === editModal.userId
        ? { ...u, full_name: editModal.full_name || null, city: editModal.city || null, fitness_level: editModal.fitness_level || null }
        : u
    ));
    setEditModal(null);
    showToast("User updated.");
  }

  // ── Filter & search ──────────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    if (filter === "banned" && !u.banned_at) return false;
    if (filter === "admins" && !u.is_admin)  return false;
    if (filter === "pro"    && !u.is_pro)    return false;
    if (search) {
      const q = search.toLowerCase();
      return (u.full_name ?? "").toLowerCase().includes(q) ||
             (u.username ?? "").toLowerCase().includes(q) ||
             (u.city ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.brand} size="large" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      {/* ── Header ── */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={[s.backText, { color: c.brand }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.text }]}>Admin Panel</Text>
        <Text style={[s.headerSub, { color: c.textMuted }]}>{users.length} users</Text>
      </View>

      {/* ── Search ── */}
      <View style={[s.searchWrap, { backgroundColor: c.bgInput, borderColor: c.border }]}>
        <TextInput
          style={[s.searchInput, { color: c.text }]}
          placeholder="Search name, username, city..."
          placeholderTextColor={c.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* ── Filter tabs ── */}
      <View style={s.filterRow}>
        {(["all", "banned", "admins", "pro"] as Filter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterTab, filter === f && { backgroundColor: c.brandSubtle, borderColor: c.brand }, { borderColor: c.border }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterTabText, { color: filter === f ? c.brand : c.textMuted }]}>
              {f === "all" ? "All" : f === "banned" ? "Banned" : f === "admins" ? "Admins" : "Pro"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── User list ── */}
      <FlatList
        data={filtered}
        keyExtractor={u => u.id}
        contentContainerStyle={s.list}
        renderItem={({ item: u }) => (
          <UserRow
            user={u}
            colors={c}
            actionLoading={actionLoading}
            onAction={(action) =>
              setConfirmModal({ userId: u.id, name: u.full_name ?? u.username ?? "User", action })
            }
            onEdit={() => setEditModal({
              userId: u.id,
              full_name: u.full_name ?? "",
              city: u.city ?? "",
              fitness_level: u.fitness_level ?? "",
            })}
          />
        )}
        ListEmptyComponent={
          <Text style={[s.empty, { color: c.textMuted }]}>No users found.</Text>
        }
      />

      {/* ── Confirm modal ── */}
      {confirmModal && (
        <Modal transparent animationType="fade" onRequestClose={() => setConfirmModal(null)}>
          <View style={s.overlay}>
            <View style={[s.confirmBox, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              <Text style={[s.confirmTitle, { color: c.text }]}>
                {confirmModal.action === "delete" ? "⚠️ Delete User?" :
                 confirmModal.action === "ban"    ? "🚫 Ban User?" :
                 confirmModal.action === "unban"  ? "✅ Unban User?" :
                 confirmModal.action === "promote" ? "⬆️ Promote to Admin?" :
                 confirmModal.action === "demote"  ? "⬇️ Remove Admin?" :
                 confirmModal.action === "make_pro"   ? "⭐ Make Pro?" :
                 "Remove Pro?"}
              </Text>
              <Text style={[s.confirmSub, { color: c.textMuted }]}>{confirmModal.name}</Text>
              {confirmModal.action === "delete" && (
                <Text style={[s.confirmWarn, { color: PALETTE.error }]}>
                  This is permanent and cannot be undone.
                </Text>
              )}
              <View style={s.confirmBtns}>
                <TouchableOpacity style={[s.confirmCancel, { borderColor: c.border }]} onPress={() => setConfirmModal(null)}>
                  <Text style={[s.confirmCancelText, { color: c.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.confirmOk, {
                    backgroundColor: confirmModal.action === "delete" || confirmModal.action === "ban" ? PALETTE.error : c.brand
                  }]}
                  onPress={() => execAction(confirmModal.userId, confirmModal.action)}
                >
                  <Text style={s.confirmOkText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Edit modal ── */}
      {editModal && (
        <Modal transparent animationType="slide" onRequestClose={() => setEditModal(null)}>
          <View style={s.overlay}>
            <View style={[s.editBox, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              <Text style={[s.editTitle, { color: c.text }]}>Edit User</Text>

              {[
                { label: "Full Name",      key: "full_name" as const },
                { label: "City",           key: "city" as const },
                { label: "Fitness Level",  key: "fitness_level" as const },
              ].map(({ label, key }) => (
                <View key={key} style={s.editField}>
                  <Text style={[s.editLabel, { color: c.textMuted }]}>{label}</Text>
                  <TextInput
                    style={[s.editInput, { backgroundColor: c.bgInput, borderColor: c.border, color: c.text }]}
                    value={(editModal as any)[key]}
                    onChangeText={v => setEditModal({ ...editModal, [key]: v })}
                    placeholder={label}
                    placeholderTextColor={c.textMuted}
                  />
                </View>
              ))}

              <View style={s.confirmBtns}>
                <TouchableOpacity style={[s.confirmCancel, { borderColor: c.border }]} onPress={() => setEditModal(null)}>
                  <Text style={[s.confirmCancelText, { color: c.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.confirmOk, { backgroundColor: c.brand }, editSaving && { opacity: 0.6 }]}
                  onPress={saveEdit}
                  disabled={editSaving}
                >
                  {editSaving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.confirmOkText}>Save</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Toast ── */}
      {toast && (
        <View style={[s.toast, { backgroundColor: toast.ok ? PALETTE.success : PALETTE.error }]}>
          <Text style={s.toastText}>{toast.msg}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── User Row ─────────────────────────────────────────────────────────────────
function UserRow({ user: u, colors: c, actionLoading, onAction, onEdit }: {
  user: AdminUser;
  colors: any;
  actionLoading: string | null;
  onAction: (action: ActionType) => void;
  onEdit: () => void;
}) {
  const isBanned  = !!u.banned_at;
  const isLoading = (a: ActionType) => actionLoading === u.id + a;

  return (
    <View style={[s.userRow, { backgroundColor: c.bgCard, borderColor: isBanned ? PALETTE.error + "44" : c.border }]}>
      <View style={s.userTop}>
        <Avatar url={u.avatar_url} name={u.username ?? "?"} size={44} />
        <View style={s.userInfo}>
          <View style={s.userNameRow}>
            <Text style={[s.userName, { color: c.text }]} numberOfLines={1}>
              {u.full_name ?? u.username ?? "—"}
            </Text>
            {u.is_admin && (
              <View style={[s.tag, { backgroundColor: "#f59e0b22", borderColor: "#f59e0b55" }]}>
                <Text style={[s.tagText, { color: "#f59e0b" }]}>ADMIN</Text>
              </View>
            )}
            {u.is_pro && (
              <View style={[s.tag, { backgroundColor: "#6366f122", borderColor: "#6366f155" }]}>
                <Text style={[s.tagText, { color: "#6366f1" }]}>PRO</Text>
              </View>
            )}
            {isBanned && (
              <View style={[s.tag, { backgroundColor: PALETTE.error + "22", borderColor: PALETTE.error + "55" }]}>
                <Text style={[s.tagText, { color: PALETTE.error }]}>BANNED</Text>
              </View>
            )}
          </View>
          <Text style={[s.userSub, { color: c.textMuted }]} numberOfLines={1}>
            @{u.username ?? "?"}{u.city ? ` · ${u.city}` : ""}
            {u.fitness_level ? ` · ${u.fitness_level}` : ""}
          </Text>
          <Text style={[s.userDate, { color: c.textMuted }]}>
            Joined {new Date(u.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={s.actionRow}>
        <ActionBtn label="Edit" color={c.brand} onPress={onEdit} loading={false} />
        {isBanned
          ? <ActionBtn label="Unban" color={PALETTE.success} onPress={() => onAction("unban")} loading={isLoading("unban")} />
          : <ActionBtn label="Ban"   color={PALETTE.error}   onPress={() => onAction("ban")}   loading={isLoading("ban")} />
        }
        {u.is_admin
          ? <ActionBtn label="Demote" color={PALETTE.warning} onPress={() => onAction("demote")}  loading={isLoading("demote")} />
          : <ActionBtn label="Promote" color={PALETTE.warning} onPress={() => onAction("promote")} loading={isLoading("promote")} />
        }
        {u.is_pro
          ? <ActionBtn label="−Pro"  color="#6366f1" onPress={() => onAction("remove_pro")} loading={isLoading("remove_pro")} />
          : <ActionBtn label="+Pro"  color="#6366f1" onPress={() => onAction("make_pro")}   loading={isLoading("make_pro")} />
        }
        <ActionBtn label="Delete" color={PALETTE.error} onPress={() => onAction("delete")} loading={isLoading("delete")} />
      </View>
    </View>
  );
}

function ActionBtn({ label, color, onPress, loading }: {
  label: string; color: string; onPress: () => void; loading: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.actionBtn, { borderColor: color + "55", backgroundColor: color + "11" }]}
      onPress={onPress}
      disabled={loading}
    >
      {loading
        ? <ActivityIndicator size="small" color={color} />
        : <Text style={[s.actionBtnText, { color }]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  header:      { paddingHorizontal: SPACE[20], paddingVertical: SPACE[16], borderBottomWidth: 1 },
  backBtn:     { marginBottom: SPACE[4] },
  backText:    { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  headerTitle: { fontSize: FONT.size.xl, fontWeight: FONT.weight.black },
  headerSub:   { fontSize: FONT.size.sm },

  searchWrap:  { margin: SPACE[16], borderRadius: RADIUS.lg, borderWidth: 1.5, paddingHorizontal: SPACE[14] },
  searchInput: { paddingVertical: SPACE[12], fontSize: FONT.size.md },

  filterRow:    { flexDirection: "row", gap: SPACE[8], paddingHorizontal: SPACE[16], marginBottom: SPACE[8] },
  filterTab:    { paddingHorizontal: SPACE[14], paddingVertical: SPACE[8], borderRadius: RADIUS.pill, borderWidth: 1 },
  filterTabText:{ fontSize: FONT.size.sm, fontWeight: FONT.weight.bold },

  list:    { paddingHorizontal: SPACE[16], paddingBottom: SPACE[40], gap: SPACE[12] },
  empty:   { textAlign: "center", paddingTop: SPACE[40] },

  userRow:     { borderRadius: RADIUS.xl, borderWidth: 1, padding: SPACE[14], gap: SPACE[12] },
  userTop:     { flexDirection: "row", gap: SPACE[12], alignItems: "flex-start" },
  userInfo:    { flex: 1, gap: SPACE[2] },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: SPACE[6], flexWrap: "wrap" },
  userName:    { fontSize: FONT.size.base, fontWeight: FONT.weight.bold, flex: 1 },
  userSub:     { fontSize: FONT.size.sm },
  userDate:    { fontSize: 11 },
  tag:         { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[6], paddingVertical: 2, borderWidth: 1 },
  tagText:     { fontSize: 10, fontWeight: FONT.weight.extrabold, letterSpacing: 0.5 },

  actionRow:     { flexDirection: "row", flexWrap: "wrap", gap: SPACE[6] },
  actionBtn:     { paddingHorizontal: SPACE[10], paddingVertical: SPACE[6], borderRadius: RADIUS.md, borderWidth: 1, minWidth: 48, alignItems: "center" },
  actionBtnText: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold },

  // Modals
  overlay:     { flex: 1, backgroundColor: "#00000088", justifyContent: "center", alignItems: "center", padding: SPACE[24] },
  confirmBox:  { width: "100%", borderRadius: RADIUS.xl, borderWidth: 1, padding: SPACE[24], gap: SPACE[12] },
  confirmTitle:{ fontSize: FONT.size.lg, fontWeight: FONT.weight.black },
  confirmSub:  { fontSize: FONT.size.md },
  confirmWarn: { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  confirmBtns: { flexDirection: "row", gap: SPACE[10], marginTop: SPACE[4] },
  confirmCancel:    { flex: 1, paddingVertical: SPACE[14], borderRadius: RADIUS.lg, borderWidth: 1, alignItems: "center" },
  confirmCancelText:{ fontWeight: FONT.weight.bold },
  confirmOk:        { flex: 1, paddingVertical: SPACE[14], borderRadius: RADIUS.lg, alignItems: "center" },
  confirmOkText:    { color: "#fff", fontWeight: FONT.weight.extrabold },

  editBox:   { width: "100%", borderRadius: RADIUS.xl, borderWidth: 1, padding: SPACE[24], gap: SPACE[12] },
  editTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.black },
  editField: { gap: SPACE[6] },
  editLabel: { fontSize: FONT.size.xs, fontWeight: FONT.weight.bold, textTransform: "uppercase", letterSpacing: 0.8 },
  editInput: { borderRadius: RADIUS.lg, paddingHorizontal: SPACE[14], paddingVertical: SPACE[12], fontSize: FONT.size.md, borderWidth: 1.5 },

  // Toast
  toast:     { position: "absolute", bottom: SPACE[40], left: SPACE[20], right: SPACE[20], borderRadius: RADIUS.lg, padding: SPACE[14], alignItems: "center" },
  toastText: { color: "#fff", fontWeight: FONT.weight.bold, fontSize: FONT.size.sm },
});
