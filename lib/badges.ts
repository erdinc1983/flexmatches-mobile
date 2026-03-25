import { supabase } from "./supabase";

// ─── Tiers ────────────────────────────────────────────────────────────────────
export type Tier = {
  key: string; emoji: string; label: string; color: string;
  minPoints: number; nextPoints: number | null;
};

export const TIERS: Tier[] = [
  { key: "bronze",  emoji: "🥉", label: "Bronze",  color: "#cd7f32", minPoints: 0,    nextPoints: 500  },
  { key: "silver",  emoji: "🥈", label: "Silver",  color: "#9ca3af", minPoints: 500,  nextPoints: 1500 },
  { key: "gold",    emoji: "🥇", label: "Gold",    color: "#eab308", minPoints: 1500, nextPoints: 4000 },
  { key: "diamond", emoji: "💎", label: "Diamond", color: "#60a5fa", minPoints: 4000, nextPoints: null },
];

export function calcTier(points: number): Tier {
  return [...TIERS].reverse().find((t) => points >= t.minPoints) ?? TIERS[0];
}

export async function calcUserPoints(userId: string): Promise<number> {
  const [{ count: badges }, { count: workouts }, { data: userData }] = await Promise.all([
    supabase.from("user_badges").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("workouts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("users").select("current_streak").eq("id", userId).single(),
  ]);
  return (badges ?? 0) * 100 + (workouts ?? 0) * 10 + (userData?.current_streak ?? 0) * 5;
}

// ─── Badges ───────────────────────────────────────────────────────────────────
export type BadgeKey =
  | "first_match" | "week_warrior" | "month_champion" | "goal_crusher"
  | "workout_50"  | "first_referral" | "reliable_partner";

export type Badge = {
  key: BadgeKey; emoji: string; title: string; description: string; color: string;
};

export const BADGES: Badge[] = [
  { key: "first_match",      emoji: "🤝", title: "First Connection", description: "Made your first match",          color: "#22c55e" },
  { key: "week_warrior",     emoji: "🔥", title: "Week Warrior",     description: "7-day check-in streak",          color: "#f59e0b" },
  { key: "month_champion",   emoji: "👑", title: "Month Champion",   description: "30-day check-in streak",         color: "#f59e0b" },
  { key: "goal_crusher",     emoji: "💪", title: "Goal Crusher",     description: "Completed your first goal",      color: "#6366f1" },
  { key: "workout_50",       emoji: "🔱", title: "Iron Will",        description: "Logged 50 workouts",             color: "#6366f1" },
  { key: "first_referral",   emoji: "📣", title: "First Referral",   description: "Invited your first friend",      color: "#a855f7" },
  { key: "reliable_partner", emoji: "🫱", title: "Reliable Partner", description: "Confirmed 3+ partner sessions",  color: "#22c55e" },
];

export const BADGE_MAP = Object.fromEntries(BADGES.map((b) => [b.key, b])) as Record<BadgeKey, Badge>;
