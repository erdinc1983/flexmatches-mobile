/**
 * AppDataContext
 *
 * Loads the current user's own profile once after auth and caches it globally.
 * All tabs read from here instead of querying the users table independently.
 *
 * Exposes:
 *   appUser          — the current user's profile (null while loading or unauthenticated)
 *   appUserLoading   — true on initial load only
 *   refreshAppUser() — force a fresh fetch (call after profile edits)
 *   updateAppUser()  — optimistic local update (no network, instant UI)
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

export type AppUser = {
  id:               string;
  username:         string;
  full_name:        string | null;
  avatar_url:       string | null;
  bio:              string | null;
  city:             string | null;
  fitness_level:    string | null;
  sports:           string[] | null;
  current_streak:   number;
  last_checkin_date: string | null;
  is_at_gym:        boolean;
  gym_checkin_at:   string | null;
  gym_name:         string | null;
  availability:     Record<string, boolean> | null;
  lat:              number | null;
  lng:              number | null;
  training_intent:  string | null;
  show_me:          string | null;
  gender:           string | null;
  age:              number | null;
  is_pro:           boolean;
  /** "founding_member" for the first 1,000 users, "paid" for Stripe
   *  subscriptions, "referral_3"/"referral_6" for milestone grants,
   *  null when not Pro. Drives the Pro badge copy. */
  pro_source:       string | null;
  /** When set, referral/paid Pro is only active until this timestamp.
   *  founding_member ignores this field. The hourly cron expires
   *  is_pro server-side; isProActive() also guards instantly client-side. */
  pro_expires_at:   string | null;
  is_admin:         boolean;
  phone_verified:   boolean;
  units:            "imperial" | "metric";
};

type AppDataContextValue = {
  appUser:          AppUser | null;
  appUserLoading:   boolean;
  refreshAppUser:   () => Promise<void>;
  updateAppUser:    (partial: Partial<AppUser>) => void;
  /** Returns cached appUser or does a fresh direct fetch. Never throws. */
  fetchAppUser:     () => Promise<AppUser | null>;
};

const AppDataContext = createContext<AppDataContextValue>({
  appUser:        null,
  appUserLoading: true,
  refreshAppUser: async () => {},
  updateAppUser:  () => {},
  fetchAppUser:   async () => null,
});

const SELECT = [
  "id", "username", "full_name", "avatar_url", "bio", "city",
  "fitness_level", "sports", "current_streak", "last_checkin_date",
  "is_at_gym", "gym_checkin_at", "gym_name", "availability",
  "lat", "lng", "training_intent", "show_me", "gender", "age",
  "is_pro", "pro_source", "pro_expires_at", "is_admin", "phone_verified", "units",
].join(", ");

/**
 * Defensive coerce: early versions of onboarding wrote `availability`
 * as a string[] (e.g. ["morning", "evening"]) but every reader in the
 * app expects Record<string, boolean>. Normalize on read so legacy
 * accounts don't render as "availability: not set".
 */
function normalizeAvailability(v: any): Record<string, boolean> | null {
  if (v == null) return null;
  if (Array.isArray(v)) {
    return v.reduce<Record<string, boolean>>((acc, k) => {
      if (typeof k === "string") acc[k] = true;
      return acc;
    }, {});
  }
  if (typeof v === "object") return v as Record<string, boolean>;
  return null;
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [appUser,        setAppUser]        = useState<AppUser | null>(null);
  const [appUserLoading, setAppUserLoading] = useState(true);
  const loadedForRef = useRef<string | null>(null);

  const fetchUser = useCallback(async (uid: string) => {
    // Retry up to 3 times with exponential backoff — cold Supabase / slow network
    // Each attempt races against a 10s timeout to avoid hanging indefinitely.
    let data: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const fetchPromise = supabase
        .from("users")
        .select(SELECT)
        .eq("id", uid)
        .single();
      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error("timeout") }), 10_000)
      );
      const { data: row, error } = await Promise.race([fetchPromise, timeoutPromise]);
      if (!error && row) { data = row; break; }
      console.warn(`[AppData] fetch attempt ${attempt + 1} failed:`, error?.message);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    if (!data) { console.warn("[AppData] all retries failed — appUser stays null"); return; }
    const d = data as any;
    setAppUser({
      id:               d.id,
      username:         d.username ?? "",
      full_name:        d.full_name ?? null,
      avatar_url:       d.avatar_url ?? null,
      bio:              d.bio ?? null,
      city:             d.city ?? null,
      fitness_level:    d.fitness_level ?? null,
      sports:           d.sports ?? null,
      current_streak:   d.current_streak ?? 0,
      last_checkin_date: d.last_checkin_date ?? null,
      is_at_gym:        d.is_at_gym ?? false,
      gym_checkin_at:   d.gym_checkin_at ?? null,
      gym_name:         d.gym_name ?? null,
      availability:     normalizeAvailability(d.availability),
      lat:              d.lat ?? null,
      lng:              d.lng ?? null,
      training_intent:  d.training_intent ?? null,
      show_me:          d.show_me ?? null,
      gender:           d.gender ?? null,
      age:              d.age ?? null,
      is_pro:           d.is_pro ?? false,
      pro_source:       d.pro_source ?? null,
      pro_expires_at:   d.pro_expires_at ?? null,
      is_admin:         d.is_admin ?? false,
      phone_verified:   d.phone_verified ?? false,
      units:            (d.units === "metric" ? "metric" : "imperial") as "imperial" | "metric",
    });
  }, []);

  // Load on mount and on auth state change (sign in / sign out)
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (user) {
        loadedForRef.current = user.id;
        await fetchUser(user.id);
      } else {
        setAppUser(null);
      }
      setAppUserLoading(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      if (event === "SIGNED_IN" && session?.user) {
        if (loadedForRef.current !== session.user.id) {
          loadedForRef.current = session.user.id;
          setAppUserLoading(true);
          await fetchUser(session.user.id);
          setAppUserLoading(false);
        }
      } else if (event === "SIGNED_OUT") {
        loadedForRef.current = null;
        setAppUser(null);
        setAppUserLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchUser]);

  const refreshAppUser = useCallback(async () => {
    if (!appUser?.id) return;
    await fetchUser(appUser.id);
  }, [appUser?.id, fetchUser]);

  const updateAppUser = useCallback((partial: Partial<AppUser>) => {
    setAppUser((prev) => prev ? { ...prev, ...partial } : prev);
  }, []);

  /**
   * Returns cached appUser if available, otherwise does a direct Supabase fetch.
   * Used by tabs as a fallback when AppDataContext's background load failed.
   * Never throws — returns null on any error.
   */
  const fetchAppUser = useCallback(async (): Promise<AppUser | null> => {
    if (appUser) return appUser;
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;
      const { data: row, error } = await supabase
        .from("users")
        .select(SELECT)
        .eq("id", authUser.id)
        .single();
      if (error || !row) return null;
      const d = row as any;
      const profile: AppUser = {
        id:               d.id,
        username:         d.username ?? "",
        full_name:        d.full_name ?? null,
        avatar_url:       d.avatar_url ?? null,
        bio:              d.bio ?? null,
        city:             d.city ?? null,
        fitness_level:    d.fitness_level ?? null,
        sports:           d.sports ?? null,
        current_streak:   d.current_streak ?? 0,
        last_checkin_date: d.last_checkin_date ?? null,
        is_at_gym:        d.is_at_gym ?? false,
        gym_checkin_at:   d.gym_checkin_at ?? null,
        gym_name:         d.gym_name ?? null,
        availability:     normalizeAvailability(d.availability),
        lat:              d.lat ?? null,
        lng:              d.lng ?? null,
        training_intent:  d.training_intent ?? null,
        show_me:          d.show_me ?? null,
        gender:           d.gender ?? null,
        age:              d.age ?? null,
        is_pro:           d.is_pro ?? false,
      pro_source:       d.pro_source ?? null,
      pro_expires_at:   d.pro_expires_at ?? null,
        is_admin:         d.is_admin ?? false,
        phone_verified:   d.phone_verified ?? false,
      units:            (d.units === "metric" ? "metric" : "imperial") as "imperial" | "metric",
      };
      setAppUser(profile); // cache it for other consumers
      return profile;
    } catch {
      return null;
    }
  }, [appUser]);

  return (
    <AppDataContext.Provider value={{ appUser, appUserLoading, refreshAppUser, updateAppUser, fetchAppUser }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  return useContext(AppDataContext);
}
