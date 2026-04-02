/**
 * SessionBanner
 *
 * Shows the current session state at the top of a conversation.
 * This is the primary coordination signal in Chat — visible before
 * the user reads a single message.
 *
 * States:
 *   pending_mine   — I proposed, waiting for partner to respond
 *   pending_theirs — Partner proposed, I need to accept or decline
 *   upcoming       — Session accepted, future date
 *   needs_confirm  — Session date has passed, needs post-session confirmation
 *   confirmed      — Session marked as completed (quiet dismissal)
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme, SPACE, FONT, RADIUS } from "../../lib/theme";
import { Icon } from "../Icon";

// ─── Types ────────────────────────────────────────────────────────────────────
export type BuddySession = {
  id:           string;
  match_id:     string;
  proposer_id:  string;
  receiver_id:  string;
  sport:        string;
  session_date: string;
  session_time: string | null;
  location:     string | null;
  notes:        string | null;
  status:       "pending" | "accepted" | "completed" | "cancelled" | "declined";
};

export type SessionState =
  | "pending_mine"
  | "pending_theirs"
  | "upcoming"
  | "needs_confirm"
  | "confirmed";

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function getSessionState(session: BuddySession, myId: string): SessionState {
  if (session.status === "completed") return "confirmed";

  if (session.status === "accepted") {
    return isDatePast(session.session_date) ? "needs_confirm" : "upcoming";
  }

  // pending
  return session.proposer_id === myId ? "pending_mine" : "pending_theirs";
}

function isDatePast(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const sessionDate = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return sessionDate < today;
}

export function formatSessionDate(dateStr: string, timeStr: string | null): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let label: string;
  if (date.getTime() === today.getTime())       label = "Today";
  else if (date.getTime() === tomorrow.getTime()) label = "Tomorrow";
  else label = date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  return timeStr ? `${label} · ${timeStr}` : label;
}

// ─── Color tokens for semantic states ────────────────────────────────────────
const AMBER = {
  darkBg:      "#1C1400",
  darkBorder:  "#78350F55",
  darkText:    "#FCD34D",
  darkSub:     "#B45309",
  lightBg:     "#FFFBEB",
  lightBorder: "#FDE68A",
  lightText:   "#92400E",
  lightSub:    "#D97706",
  icon:        "#D97706",
} as const;

const GREEN = {
  darkBg:      "#0D2D1A",
  darkBorder:  "#166534",
  darkText:    "#86EFAC",
  lightBg:     "#ECFDF5",
  lightBorder: "#BBF7D0",
  lightText:   "#15803D",
  icon:        "#22C55E",
} as const;

// ─── Component ────────────────────────────────────────────────────────────────
type Props = {
  session:     BuddySession;
  myId:        string;
  partnerName: string;
  onAccept:    () => void;
  onDecline:   () => void;
  onConfirm:   () => void;
  onNoShow?:   () => void;
  onCancel?:   () => void;
  onEdit?:     () => void;
};

export function SessionBanner({ session, myId, partnerName, onAccept, onDecline, onConfirm, onNoShow, onCancel, onEdit }: Props) {
  const { theme, isDark } = useTheme();
  const c = theme.colors;

  const state     = getSessionState(session, myId);
  const dateLabel = formatSessionDate(session.session_date, session.session_time);

  // ── Confirmed: no banner needed ───────────────────────────────────────────
  if (state === "confirmed") return null;

  // ── Pending (I proposed): waiting state + edit/cancel ─────────────────────
  if (state === "pending_mine") {
    const bg     = isDark ? AMBER.darkBg     : AMBER.lightBg;
    const border = isDark ? AMBER.darkBorder : AMBER.lightBorder;
    const txt    = isDark ? AMBER.darkText   : AMBER.lightText;
    const sub    = isDark ? AMBER.darkSub    : AMBER.lightSub;
    return (
      <View style={[s.banner, s.bannerTall, { backgroundColor: bg, borderBottomColor: border }]}>
        <View style={s.row}>
          <Icon name="clock" size={13} color={AMBER.icon} />
          <View style={s.textCol}>
            <Text style={[s.text, { color: txt }]}>
              {session.sport} · {dateLabel}
            </Text>
            {session.location && (
              <Text style={[s.sub, { color: sub }]}>📍 {session.location}</Text>
            )}
            <Text style={[s.sub, { color: sub }]}>
              Waiting for {partnerName} to confirm
            </Text>
          </View>
        </View>
        <View style={s.actions}>
          {onEdit && (
            <TouchableOpacity
              style={[s.editBtn, { borderColor: isDark ? AMBER.darkBorder : AMBER.lightBorder }]}
              onPress={onEdit}
              activeOpacity={0.8}
            >
              <Icon name="edit" size={13} color={AMBER.icon} />
              <Text style={[s.editText, { color: AMBER.icon }]}>Edit</Text>
            </TouchableOpacity>
          )}
          {onCancel && (
            <TouchableOpacity
              style={[s.cancelBtn, { borderColor: isDark ? AMBER.darkBorder : AMBER.lightBorder }]}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={[s.cancelText, { color: isDark ? AMBER.darkText : AMBER.lightText }]}>Cancel session</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ── Pending (they proposed): I need to respond ─────────────────────────────
  if (state === "pending_theirs") {
    return (
      <View style={[s.banner, s.bannerTall, { backgroundColor: c.bgCard, borderBottomColor: c.border }]}>
        <View style={s.row}>
          <Icon name="calendar" size={13} color={c.brand} />
          <View style={s.textCol}>
            <Text style={[s.text, { color: c.text }]}>
              {partnerName} proposed {session.sport} · {dateLabel}
            </Text>
            {session.location && (
              <Text style={[s.sub, { color: c.textMuted }]}>📍 {session.location}</Text>
            )}
          </View>
        </View>
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.declineBtn, { borderColor: c.borderMedium }]}
            onPress={onDecline}
            activeOpacity={0.8}
          >
            <Text style={[s.declineText, { color: c.textMuted }]}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.acceptBtn, { backgroundColor: c.brand }]}
            onPress={onAccept}
            activeOpacity={0.85}
          >
            <Text style={s.ctaText}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Upcoming: session confirmed, future date ───────────────────────────────
  if (state === "upcoming") {
    const bg     = isDark ? GREEN.darkBg     : GREEN.lightBg;
    const border = isDark ? GREEN.darkBorder : GREEN.lightBorder;
    const txt    = isDark ? GREEN.darkText   : GREEN.lightText;
    return (
      <View style={[s.banner, { backgroundColor: bg, borderBottomColor: border }]}>
        <View style={s.row}>
          <Icon name="checkActive" size={13} color={GREEN.icon} />
          <View style={s.textCol}>
            <Text style={[s.text, { color: txt }]}>
              {session.sport} confirmed · {dateLabel}
            </Text>
            {session.location && (
              <Text style={[s.sub, { color: txt }]}>📍 {session.location}</Text>
            )}
          </View>
        </View>
      </View>
    );
  }

  // ── Needs confirm: date passed, awaiting post-session log ──────────────────
  return (
    <View style={[s.banner, s.bannerTall, { backgroundColor: c.bgCard, borderBottomColor: c.border }]}>
      <View style={s.row}>
        <Icon name="calendar" size={13} color={c.brand} />
        <View style={s.textCol}>
          <Text style={[s.text, { color: c.text }]}>
            {session.sport} · {dateLabel}
          </Text>
          <Text style={[s.sub, { color: c.textMuted }]}>
            Did this session happen?
          </Text>
        </View>
      </View>
      <View style={s.actions}>
        {onNoShow && (
          <TouchableOpacity
            style={[s.declineBtn, { borderColor: c.borderMedium }]}
            onPress={onNoShow}
            activeOpacity={0.8}
          >
            <Text style={[s.declineText, { color: c.textMuted }]}>Didn't happen</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.acceptBtn, { backgroundColor: c.brand }]}
          onPress={onConfirm}
          activeOpacity={0.85}
        >
          <Text style={s.ctaText}>Mark done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  banner:      { borderBottomWidth: 1, paddingHorizontal: SPACE[16], paddingVertical: SPACE[12], gap: SPACE[8] },
  bannerTall:  { gap: SPACE[10] },
  row:         { flexDirection: "row", alignItems: "flex-start", gap: SPACE[8] },
  textCol:     { flex: 1, gap: 2 },
  text:        { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  sub:         { fontSize: FONT.size.xs, fontWeight: FONT.weight.medium },
  actions:     { flexDirection: "row", gap: SPACE[8] },
  declineBtn:  { flex: 1, paddingVertical: SPACE[8], borderRadius: RADIUS.md, borderWidth: 1, alignItems: "center" },
  declineText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium },
  acceptBtn:   { flex: 1, paddingVertical: SPACE[8], borderRadius: RADIUS.md, alignItems: "center" },
  ctaText:     { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold, color: "#fff" },
  editBtn:     { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: SPACE[8], paddingHorizontal: SPACE[12], borderRadius: RADIUS.md, borderWidth: 1 },
  editText:    { fontSize: FONT.size.sm, fontWeight: FONT.weight.semibold },
  cancelBtn:   { flex: 1, paddingVertical: SPACE[8], borderRadius: RADIUS.md, borderWidth: 1, alignItems: "center" },
  cancelText:  { fontSize: FONT.size.sm, fontWeight: FONT.weight.medium },
});
