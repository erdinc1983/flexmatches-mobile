import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export async function getCurrentUserWithRefresh(): Promise<User | null> {
  let { data: { user } } = await supabase.auth.getUser();
  if (user) return user;

  const { data: refreshed } = await supabase.auth.refreshSession();
  if (refreshed.user) return refreshed.user;

  ({ data: { user } } = await supabase.auth.getUser());
  return user ?? null;
}

