/**
 * ConversationRow
 *
 * A single row in the Chat inbox.
 *
 * Layout: avatar | name + timestamp | session pill OR last message | unread badge
 *
 * The session pill replaces the last message preview when a session exists —
 * it is the more important coordination signal. One pill max per row.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme, SPACE, FONT, RADIUS } from "../../lib/theme";
import { Avatar } from "../Avatar";
import { getSessionState, formatSessionDate } from "./SessionBanner";
import type { BuddySession } from "./SessionBanner";

// ─── Types ────────────────────────────────────────────────────────────────────
type Props = {
  name:          string;
  username:      string;
  avatarUrl:     string | null;
  lastMessage:   string | null;
  lastMessageAt: string | null;
  unreadCount:   number;
  session:       BuddySession | null;
  myId:          string;
  onPress:       () => void;
};

type Pill = { label: string; color: string; bg: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
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
  if (!session || session.status === "declined" || session.status === "confirmed") return null;

  const state = getSessionState(session, myId);

  switch (state) {
    case "pending_mine":
      return { label: "Session pending", color: "#D97706", bg: "#F59E0B18" };
    case "pending_theirs":
      return { label: "Respond to session →", color: "#FF4500", bg: "#FF450018" };
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

// ─── Component ────────────────────────────────────────────────────────────────
export function ConversationRow({
  name, username, avatarUrl, lastMessage, lastMessageAt,
  unreadCount, session, myId, onPress,
}: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const unread = unreadCount > 0;
  const pill   = getSessionPill(session, myId);

  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.75}>

      {/* Avatar */}
      <View style={[s.avatarWrap, unread && { borderColor: c.brand, borderWidth: 2 }]}>
        <Avatar url={avatarUrl} name={name ?? username} size={52} />
      </View>

      {/* Content */}
      <View style={s.content}>
        <View style={s.topRow}>
          <Text
            style={[s.name, { color: c.text, fontWeight: unread ? FONT.weight.extrabold : FONT.weight.semibold }]}
            numberOfLines={1}
          >
            {name}
          </Text>
          {lastMessageAt && (
            <Text style={[s.time, { color: unread ? c.brand : c.textMuted }]}>
              {timeAgo(lastMessageAt)}
            </Text>
          )}
        </View>

        {/* Session pill takes priority over last message preview */}
        {pill ? (
          <View style={[s.pill, { backgroundColor: pill.bg }]}>
            <Text style={[s.pillText, { color: pill.color }]} numberOfLines={1}>
              {pill.label}
            </Text>
          </View>
        ) : (
          <Text
            style={[s.lastMsg, { color: unread ? c.textSecondary : c.textMuted }]}
            numberOfLines={1}
          >
            {lastMessage ?? "Matched — say hello!"}
          </Text>
        )}
      </View>

      {/* Unread badge */}
      {unread && (
        <View style={[s.badge, { backgroundColor: c.brand }]}>
          <Text style={s.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
        </View>
      )}

    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  row:        { flexDirection: "row", alignItems: "center", paddingVertical: SPACE[12], paddingHorizontal: SPACE[20], gap: SPACE[12] },
  avatarWrap: { borderRadius: 26, borderWidth: 0, flexShrink: 0 },
  content:  { flex: 1, gap: SPACE[4] },
  topRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name:     { fontSize: FONT.size.md, flex: 1, marginRight: SPACE[8] },
  time:     { fontSize: FONT.size.xs, fontWeight: FONT.weight.medium },
  lastMsg:  { fontSize: FONT.size.sm },
  pill:     { alignSelf: "flex-start", paddingHorizontal: SPACE[8], paddingVertical: 3, borderRadius: RADIUS.pill },
  pillText: { fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold },
  badge:    { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeText:{ fontSize: FONT.size.xs, fontWeight: FONT.weight.black, color: "#fff" },
});
