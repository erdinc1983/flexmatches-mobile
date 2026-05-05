import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * Resolves the current Supabase user, refreshing the session once if needed.
 *
 * Heals the "wedged keychain" failure mode where the JWT looks valid locally
 * (so getUser() returns a user once) but every server-side validation fails.
 * If we exhaust the refresh path without recovering a user, force a signOut
 * so onAuthStateChange fires SIGNED_OUT and the root layout redirects to
 * /(auth)/welcome instead of routing into the tabs with no auth.
 */
export async function getCurrentUserWithRefresh(): Promise<User | null> {
  let { data: { user } } = await supabase.auth.getUser();
  if (user) return user;

  const { data: refreshed } = await supabase.auth.refreshSession();
  if (refreshed.user) return refreshed.user;

  ({ data: { user } } = await supabase.auth.getUser());
  if (user) return user;

  // No authenticated user across getUser → refreshSession → getUser. Any
  // residual local session is stale; clear it so the app routes to welcome
  // instead of mounting a tab and showing "Something went wrong".
  await supabase.auth.signOut().catch(() => {});
  return null;
}
