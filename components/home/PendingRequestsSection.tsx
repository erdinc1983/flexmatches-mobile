import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTheme, SPACE, FONT, RADIUS } from "../../lib/theme";
import { Icon } from "../Icon";
import { Avatar } from "../Avatar";
import { SectionHeader } from "../ui/SectionHeader";
import type { PendingRequest } from "./types";

type Props = {
  requests:  PendingRequest[];
  onAccept:  (id: string) => void;
  onDecline: (id: string) => void;
};

const MAX_VISIBLE = 2;

export function PendingRequestsSection({ requests, onAccept, onDecline }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (requests.length === 0) return null;

  const visible  = requests.slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, requests.length - MAX_VISIBLE);

  return (
    <View style={{ gap: SPACE[10] }}>
      <SectionHeader
        title="Requests"
        count={requests.length}
        action={overflow > 0
          ? { label: `+${overflow} more`, onPress: () => router.push("/(tabs)/matches" as any) }
          : undefined
        }
      />
      {visible.map((req) => (
        <RequestRow
          key={req.id}
          req={req}
          onAccept={() => onAccept(req.id)}
          onDecline={() => onDecline(req.id)}
        />
      ))}
    </View>
  );
}

function RequestRow({
  req, onAccept, onDecline,
}: { req: PendingRequest; onAccept: () => void; onDecline: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const meta = [req.fitness_level, req.city].filter(Boolean).join(" · ");

  return (
    <View style={[s.row, { backgroundColor: c.bgCard, borderColor: c.brandBorder }]}>
      <Avatar url={req.avatar_url} name={req.full_name ?? req.username} size={42} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.name, { color: c.text }]}>{req.full_name ?? req.username}</Text>
        {meta ? <Text style={[s.meta, { color: c.textMuted }]}>{meta}</Text> : null}
      </View>
      <View style={{ flexDirection: "row", gap: SPACE[8] }}>
        <TouchableOpacity
          style={[s.declineBtn, { borderColor: c.borderMedium }]}
          onPress={onDecline}
          activeOpacity={0.7}
        >
          <Icon name="close" size={15} color={c.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.acceptBtn, { backgroundColor: c.brand }]}
          onPress={onAccept}
          activeOpacity={0.8}
        >
          <Icon name="save" size={17} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row:        { flexDirection: "row", alignItems: "center", borderRadius: RADIUS.lg, padding: SPACE[12], gap: SPACE[12], borderWidth: 1 },
  name:       { fontSize: FONT.size.base, fontWeight: FONT.weight.bold },
  meta:       { fontSize: FONT.size.sm, textTransform: "capitalize" },
  declineBtn: { width: 34, height: 34, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  acceptBtn:  { width: 34, height: 34, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
});
