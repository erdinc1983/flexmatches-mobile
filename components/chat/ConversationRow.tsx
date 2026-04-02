/**
 * ConversationRow
 *
 * iOS Gmail–style inbox row with swipe actions.
 *
 * Swipe left reveals:
 *   Save (blue bookmark) · Delete messages (gray trash) · Unmatch (red)
 *
 * Typography:
 *   Name  — bold black (#000) when unread, semibold when read
 *   Preview — always gray (#8E8E93), slightly darker when unread
 *   Time  — gray, top-right
 */

import React, { useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { SPACE, FONT, RADIUS } from "../../lib/theme";
import { Avatar } from "../Avatar";
import { getSessionState, formatSessionDate } from "./SessionBanner";
import type { BuddySession } from "./SessionBanner";

// ─── Types ────────────────────────────────────────────────────────────────────
type Props = {
  name:             string;
  username:         string;
  avatarUrl:        string | null;
  lastMessage:      string | null;
  lastMessageAt:    string | null;
  unreadCount:      number;
  session:          BuddySession | null;
  saved:            boolean;
  myId:             string;
  onPress:          () => void;
  onSave:           () => void;
  onDeleteMessages: () => void;
  onUnmatch:        () => void;
};

type Pill = { label: string; color: string; bg: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function getSessionPill(session: BuddySession | null, myId: string): Pill | null {
  if (!session || ["declined", "cancelled", "completed"].includes(session.status)) return null;
  const state = getSessionState(session, myId);
  switch (state) {
    case "pending_mine":
      return { label: "Session pending", color: "#D97706", bg: "#F59E0B18" };
    case "pending_theirs":
      return { label: "Respond to session →", color: "#FF3B30", bg: "#FF3B3018" };
    case "upcoming": {
      const label = `${session.sport} · ${formatSessionDate(session.session_date, session.session_time)}`;
      return { label, color: "#22C55E", bg: "#22C55E18" };
    }
    case "needs_confirm":
      return { label: "Did this happen?", color: "#D97706", bg: "#F59E0B18" };
    default:
      return null;
  }
}

// ─── Swipe actions ───────────────────────────────────────────────────────────
function RightActions({
  name, saved, onSave, onDeleteMessages, onUnmatch,
}: { name: string; saved: boolean; onSave: () => void; onDeleteMessages: () => void; onUnmatch: () => void; }) {
  return (
    <View style={ra.wrap}>
      {/* Save / bookmark */}
      <TouchableOpacity style={[ra.btn, { backgroundColor: "#007AFF" }]} onPress={onSave} activeOpacity={0.85}>
        <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={20} color="#fff" />
        <Text style={ra.label}>{saved ? "Saved" : "Save"}</Text>
      </TouchableOpacity>

      {/* Delete messages */}
      <TouchableOpacity
        style={[ra.btn, { backgroundColor: "#8E8E93" }]}
        onPress={() =>
          Alert.alert(
            "Delete Messages",
            `Delete all messages with ${name}? The match will be preserved.`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: onDeleteMessages },
            ]
          )
        }
        activeOpacity={0.85}
      >
        <Ionicons name="trash-outline" size={20} color="#fff" />
        <Text style={ra.label}>Delete</Text>
      </TouchableOpacity>

      {/* Unmatch */}
      <TouchableOpacity
        style={[ra.btn, { backgroundColor: "#FF3B30" }]}
        onPress={() =>
          Alert.alert(
            "Unmatch",
            `Unmatch ${name}? This will permanently remove this connection and all messages. This cannot be undone.`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Unmatch", style: "destructive", onPress: onUnmatch },
            ]
          )
        }
        activeOpacity={0.85}
      >
        <Ionicons name="person-remove-outline" size={20} color="#fff" />
        <Text style={ra.label}>Unmatch</Text>
      </TouchableOpacity>
    </View>
  );
}

const ra = StyleSheet.create({
  wrap:  { flexDirection: "row" },
  btn:   { width: 76, alignItems: "center", justifyContent: "center", gap: 4 },
  label: { fontSize: 11, fontWeight: "600", color: "#fff" },
});

// ─── Component ────────────────────────────────────────────────────────────────
export function ConversationRow({
  name, username, avatarUrl, lastMessage, lastMessageAt,
  unreadCount, session, saved, myId,
  onPress, onSave, onDeleteMessages, onUnmatch,
}: Props) {
  const swipeRef = useRef<Swipeable>(null);
  const unread   = unreadCount > 0;
  const pill     = getSessionPill(session, myId);

  function closeSwipe() { swipeRef.current?.close(); }

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      renderRightActions={() => (
        <RightActions
          name={name}
          saved={saved}
          onSave={() => { closeSwipe(); onSave(); }}
          onDeleteMessages={() => { closeSwipe(); onDeleteMessages(); }}
          onUnmatch={() => { closeSwipe(); onUnmatch(); }}
        />
      )}
      overshootRight={false}
    >
      <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>

        {/* Unread dot */}
        <View style={s.dotCol}>
          {unread
            ? <View style={s.dot} />
            : <View style={s.dotPlaceholder} />
          }
        </View>

        {/* Avatar */}
        <Avatar url={avatarUrl} name={name ?? username} size={50} />

        {/* Content */}
        <View style={s.content}>
          <View style={s.topRow}>
            <Text
              style={[s.name, { fontWeight: unread ? "700" : "500" }]}
              numberOfLines={1}
            >
              {name}
            </Text>
            {lastMessageAt && (
              <Text style={[s.time, unread && s.timeUnread]}>
                {timeLabel(lastMessageAt)}
              </Text>
            )}
          </View>

          {/* Session pill > last message */}
          {pill ? (
            <View style={[s.pill, { backgroundColor: pill.bg }]}>
              <Text style={[s.pillText, { color: pill.color }]} numberOfLines={1}>
                {pill.label}
              </Text>
            </View>
          ) : (
            <Text
              style={[s.preview, unread && s.previewUnread]}
              numberOfLines={1}
            >
              {lastMessage ?? "Matched — say hello!"}
            </Text>
          )}

          {/* Saved indicator */}
          {saved && !pill && (
            <View style={s.savedRow}>
              <Ionicons name="bookmark" size={11} color="#007AFF" />
              <Text style={s.savedText}>Saved</Text>
            </View>
          )}
        </View>

        {/* Unread count badge */}
        {unread && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
          </View>
        )}

      </TouchableOpacity>
    </Swipeable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  row:            { flexDirection: "row", alignItems: "center", paddingVertical: SPACE[12], paddingRight: SPACE[16], backgroundColor: "#fff" },
  dotCol:         { width: 20, alignItems: "center" },
  dot:            { width: 9, height: 9, borderRadius: 5, backgroundColor: "#007AFF" },
  dotPlaceholder: { width: 9 },

  content:        { flex: 1, marginLeft: SPACE[12], gap: 3 },
  topRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name:           { fontSize: 16, color: "#000", flex: 1, marginRight: SPACE[8] },
  time:           { fontSize: 12, color: "#8E8E93", fontWeight: "400" },
  timeUnread:     { color: "#007AFF", fontWeight: "600" },

  preview:        { fontSize: 14, color: "#8E8E93", fontWeight: "400" },
  previewUnread:  { color: "#3C3C43CC" },

  pill:           { alignSelf: "flex-start", paddingHorizontal: SPACE[8], paddingVertical: 3, borderRadius: RADIUS.pill },
  pillText:       { fontSize: 12, fontWeight: "600" },

  savedRow:       { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  savedText:      { fontSize: 11, color: "#007AFF", fontWeight: "500" },

  badge:          { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, backgroundColor: "#007AFF" },
  badgeText:      { fontSize: 12, fontWeight: "700", color: "#fff" },
});
