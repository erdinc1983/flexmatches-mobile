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
  is_admin:         boolean;
};

type AppDataContextValue = {
  appUser:          AppUser | null;
  appUserLoading:   boolean;
  refreshAppUser:   () => Promise<void>;
  updateAppUser:    (partial: Partial<AppUser>) => void;
};

const AppDataContext = createContext<AppDataContextValue>({
  appUser:        null,
  appUserLoading: true,
  refreshAppUser: async () => {},
  updateAppUser:  () => {},
});

const SELECT = [
  "id", "username", "full_name", "avatar_url", "bio", "city",
  "fitness_level", "sports", "current_streak", "last_checkin_date",
  "is_at_gym", "gym_checkin_at", "gym_name", "availability",
  "lat", "lng", "training_intent", "show_me", "gender", "age",
  "is_pro", "is_admin",
].join(", ");

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [appUser,        setAppUser]        = useState<AppUser | null>(null);
  const [appUserLoading, setAppUserLoading] = useState(true);
  const loadedForRef = useRef<string | null>(null);

  const fetchUser = useCallback(async (uid: string) => {
    // Retry up to 3 times with exponential backoff — cold Supabase / slow network
    let data: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: row, error } = await supabase
        .from("users")
        .select(SELECT)
        .eq("id", uid)
        .single();
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
      availability:     d.availability ?? null,
      lat:              d.lat ?? null,
      lng:              d.lng ?? null,
      training_intent:  d.training_intent ?? null,
      show_me:          d.show_me ?? null,
      gender:           d.gender ?? null,
      age:              d.age ?? null,
      is_pro:           d.is_pro ?? false,
      is_admin:         d.is_admin ?? false,
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

  return (
    <AppDataContext.Provider value={{ appUser, appUserLoading, refreshAppUser, updateAppUser }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  return useContext(AppDataContext);
}
