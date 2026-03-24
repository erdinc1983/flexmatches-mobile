// Shared types for the Home screen sections

export type HomeProfile = {
  id:                  string;
  username:            string;
  full_name:           string | null;
  current_streak:      number;
  last_checkin_date:   string | null;
  match_count:         number;
  workout_count_month: number;
  is_at_gym:           boolean;
  gym_checkin_at:      string | null;
};

export type PendingRequest = {
  id:            string;
  sender_id:     string;
  username:      string;
  full_name:     string | null;
  fitness_level: string | null;
  city:          string | null;
};

// reasons = ["Same level", "Running", "Nearby", "Trains mornings"] — max 3
export type SuggestedUser = {
  id:            string;
  username:      string;
  full_name:     string | null;
  fitness_level: string | null;
  city:          string | null;
  shared_sports: string[];
  reasons:       string[];
};

export type CirclePreview = {
  id:           string;
  name:         string;
  icon:         string;
  member_count: number;
};

export type SessionInfo = {
  id:           string;
  match_id:     string;
  sport:        string;
  session_time: string | null;
  status:       "confirmed" | "pending";
  partner_name: string;
};

// ─── Primary Action discriminated union ───────────────────────────────────────
// Drives the top card on Home. Evaluated in priority order.

export type PrimaryAction =
  | { kind: "session_today";   partnerName: string; matchId: string; sport: string; time: string | null }
  | { kind: "session_pending"; partnerName: string; sessionId: string; matchId: string; sport: string }
  | { kind: "unread";          count: number }
  | { kind: "match_request";   requesterName: string; matchId: string }
  | { kind: "at_gym_log";      streak: number }
  | { kind: "log_streak";      streak: number }
  | { kind: "done";            streak: number };

// ─── Helper ───────────────────────────────────────────────────────────────────
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function computePrimaryAction(params: {
  profile:         HomeProfile;
  confirmedSessions: SessionInfo[];
  pendingSessions:   SessionInfo[];
  unreadCount:     number;
  pendingRequests: PendingRequest[];
  today:           string;
}): PrimaryAction {
  const { profile, confirmedSessions, pendingSessions, unreadCount, pendingRequests, today } = params;
  const checkedIn = profile.last_checkin_date === today;

  if (confirmedSessions.length > 0) {
    const s = confirmedSessions[0];
    return { kind: "session_today", partnerName: s.partner_name, matchId: s.match_id, sport: s.sport, time: s.session_time };
  }
  if (pendingSessions.length > 0) {
    const s = pendingSessions[0];
    return { kind: "session_pending", partnerName: s.partner_name, sessionId: s.id, matchId: s.match_id, sport: s.sport };
  }
  if (unreadCount > 0) {
    return { kind: "unread", count: unreadCount };
  }
  if (pendingRequests.length > 0) {
    const r = pendingRequests[0];
    return { kind: "match_request", requesterName: r.full_name ?? r.username, matchId: r.id };
  }
  if (profile.is_at_gym && !checkedIn) {
    return { kind: "at_gym_log", streak: profile.current_streak };
  }
  if (!checkedIn) {
    return { kind: "log_streak", streak: profile.current_streak };
  }
  return { kind: "done", streak: profile.current_streak };
}

export function buildMatchReasons(
  user: { sports?: string[]; fitness_level?: string | null; city?: string | null; availability?: Record<string, boolean> | null },
  myProfile: { sports?: string[]; fitness_level?: string | null; city?: string | null; availability?: Record<string, boolean> | null }
): string[] {
  const reasons: string[] = [];
  const mySports    = myProfile.sports ?? [];
  const myLevel     = myProfile.fitness_level ?? "";
  const myCity      = myProfile.city ?? "";
  const myAvail     = myProfile.availability ?? {};
  const theirAvail  = user.availability ?? {};
  const sharedSports = mySports.filter((s) => (user.sports ?? []).includes(s));

  if (myLevel && user.fitness_level === myLevel)                               reasons.push("Same level");
  if (myCity && user.city?.toLowerCase() === myCity.toLowerCase())             reasons.push("Nearby");
  if (sharedSports.length === 1)                                               reasons.push(sharedSports[0]);
  if (sharedSports.length > 1)                                                 reasons.push(`${sharedSports.length} shared sports`);

  const mySlots    = Object.entries(myAvail).filter(([, v]) => v).map(([k]) => k);
  const theirSlots = Object.entries(theirAvail).filter(([, v]) => v).map(([k]) => k);
  const shared     = mySlots.filter((s) => theirSlots.includes(s));
  const slotLabel: Record<string, string> = {
    morning: "Trains mornings", afternoon: "Trains afternoons",
    evening: "Trains evenings", weekend: "Trains weekends",
  };
  if (shared.length > 0) reasons.push(slotLabel[shared[0]] ?? `Free ${shared[0]}`);

  return reasons.slice(0, 3);
}
