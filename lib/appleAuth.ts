/**
 * Apple Sign In utility
 *
 * Prerequisites:
 *   1. npx expo install expo-apple-authentication
 *   2. Apple Developer Portal → Identifier → Enable "Sign In with Apple"
 *   3. Supabase Dashboard → Auth → Providers → Apple → Enable
 *   4. EAS dev build (does NOT work in Expo Go)
 *
 * Flow:
 *   Apple credential (identityToken) → Supabase signInWithIdToken
 *   → session created → user row auto-created if new
 *   → if new user → redirect to onboarding
 */

import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "./supabase";

export type AppleSignInResult =
  | { status: "success"; isNewUser: boolean }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export async function signInWithApple(): Promise<AppleSignInResult> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const identityToken = credential.identityToken;
    if (!identityToken) {
      return { status: "error", message: "Apple did not return an identity token." };
    }

    // Sign in to Supabase with Apple identity token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: identityToken,
    });

    if (error) return { status: "error", message: error.message };
    if (!data.user) return { status: "error", message: "Authentication failed." };

    const userId = data.user.id;

    // Apple only sends name/email on the FIRST sign-in.
    // Save them to users table if present.
    const firstName = credential.fullName?.givenName ?? null;
    const lastName  = credential.fullName?.familyName ?? null;
    const email     = credential.email ?? data.user.email ?? null;
    const fullName  = [firstName, lastName].filter(Boolean).join(" ") || null;

    // Check if this is a new user (no username set yet)
    const { data: existing } = await supabase
      .from("users")
      .select("username, full_name")
      .eq("id", userId)
      .single();

    const isNewUser = !existing?.username;

    if (isNewUser) {
      // Generate a unique username from email or Apple user ID
      const base = email?.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "") ?? "user";
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const username = `${base}${suffix}`.toLowerCase().slice(0, 20);

      await supabase.from("users").upsert({
        id:        userId,
        email,
        full_name: fullName || existing?.full_name || null,
        username,
      }, { onConflict: "id" });
    }

    return { status: "success", isNewUser };
  } catch (err: any) {
    if (err?.code === "ERR_REQUEST_CANCELED") {
      return { status: "cancelled" };
    }
    return { status: "error", message: err?.message ?? "Unknown error" };
  }
}

/** Returns true if Apple Sign In is available on this device */
export function isAppleAuthAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}
