/**
 * Google Sign In utility (browser-based PKCE OAuth via expo-auth-session)
 *
 * Why browser-based instead of native @react-native-google-signin?
 *   - Works in Expo Go for dev iteration (native lib needs custom dev client).
 *   - Cross-platform same code, no iOS reverse-client-ID URL scheme to wire.
 *   - Trade-off: opens system browser briefly. Industry-standard pre-2020,
 *     still used by many production apps. Upgrade to native button in v1.1
 *     polish if conversion data justifies.
 *
 * SETUP — what needs to happen before this works in production
 *
 *   1. Google Cloud Console → APIs & Services → Credentials
 *      a. Use the existing FlexMatches Cloud project (where Places + Maps API keys live)
 *      b. OAuth consent screen → External, add `support@flexmatches.com` as
 *         developer contact, app domain `flexmatches.com`. Submit for verification
 *         when crossing 100 users (Google requires it for "in production" status).
 *      c. Create three OAuth Client IDs:
 *         - **iOS Client ID** — Application type "iOS", bundle ID `com.flexmatches.app`
 *         - **Android Client ID** — Application type "Android", package `com.flexmatches.app`,
 *           SHA-1 fingerprint from `eas credentials --platform android` (after first prod build)
 *         - **Web Client ID** — Application type "Web application". Used by Supabase to
 *           validate the idToken server-side. Authorized redirect URI:
 *           `https://bwnklngifvuqgkngelwr.supabase.co/auth/v1/callback`
 *
 *   2. Supabase Dashboard → Auth → Providers → Google → Enable
 *      - Paste the **Web Client ID** (Client ID + Client Secret from Google Cloud)
 *      - Save. Supabase will validate idTokens against this Web Client ID.
 *
 *   3. EAS secrets / .env
 *      - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`     = iOS Client ID from step 1c
 *      - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` = Android Client ID from step 1c
 *      - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`     = Web Client ID from step 1c (not the secret!)
 *      - Add via `eas secret:create` for production builds.
 *
 *   4. Test on EAS dev build OR Expo Go. The browser opens, user picks Google account,
 *      returns idToken to the app, we hand it to Supabase signInWithIdToken.
 *
 * Flow:
 *   Google OAuth (id_token) → Supabase signInWithIdToken
 *   → session created → user row auto-created if new (same as appleAuth.ts)
 *   → if new user → redirect to onboarding
 */

import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// Required for the in-app browser to dismiss properly when OAuth completes.
// Calling this at module load is the recommended pattern from expo-auth-session docs.
WebBrowser.maybeCompleteAuthSession();

export type GoogleSignInResult =
  | { status: "success"; isNewUser: boolean }
  | { status: "cancelled" }
  | { status: "error"; message: string };

/**
 * Hook-based Google sign-in. Returns a `promptAsync` function and a `request` object.
 * Call `promptAsync()` from a button onPress; the OAuth flow opens, then the response
 * arrives via the `useEffect` inside the consuming screen.
 *
 * Why a hook (not a plain async function like signInWithApple)?
 *   expo-auth-session uses React state to manage the OAuth dance — the request object
 *   needs to live across the browser-redirect boundary, which only React state preserves.
 *   This is the canonical pattern from Expo's docs.
 */
export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId:     process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    clientId:        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  return { request, response, promptAsync };
}

/**
 * Hand a Google id_token to Supabase, then auto-create the user row if new.
 * Mirrors the post-auth section of signInWithApple.
 */
export async function exchangeGoogleIdToken(idToken: string): Promise<GoogleSignInResult> {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token:    idToken,
  });

  if (error)       return { status: "error",   message: error.message };
  if (!data.user)  return { status: "error",   message: "Authentication failed." };

  const userId   = data.user.id;
  const email    = data.user.email ?? null;
  // Google's id_token claims include name/email; Supabase puts them in user_metadata.
  const fullName =
    (data.user.user_metadata?.full_name as string | undefined) ??
    (data.user.user_metadata?.name as string | undefined) ??
    null;

  // Check if this is a new user (no username row yet).
  const { data: existing } = await supabase
    .from("users")
    .select("username, full_name")
    .eq("id", userId)
    .single();

  const isNewUser = !existing?.username;

  if (isNewUser) {
    // Generate a unique username from email or random suffix
    const base   = email?.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "") ?? "user";
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
}

/** Returns true if Google OAuth client IDs are configured (env vars set). */
export function isGoogleAuthAvailable(): boolean {
  return !!(
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  );
}

/**
 * Convenience hook that runs the full flow and reports a single result.
 * Use this in screens that already have other async loading state.
 *
 * Example:
 *   const { promptAsync, signingIn } = useGoogleSignIn((res) => {
 *     if (res.status === "error") Alert.alert("Google Sign In Failed", res.message);
 *   });
 *   <Button onPress={promptAsync} disabled={signingIn} />
 */
export function useGoogleSignIn(onResult: (r: GoogleSignInResult) => void) {
  const { request, response, promptAsync } = useGoogleAuth();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!response) return;

    if (response.type === "cancel" || response.type === "dismiss") {
      onResult({ status: "cancelled" });
      setSigningIn(false);
      return;
    }

    if (response.type === "error") {
      onResult({ status: "error", message: response.error?.message ?? "Google sign-in failed." });
      setSigningIn(false);
      return;
    }

    if (response.type === "success") {
      const idToken = response.params?.id_token;
      if (!idToken) {
        onResult({ status: "error", message: "Google did not return an id_token." });
        setSigningIn(false);
        return;
      }
      exchangeGoogleIdToken(idToken)
        .then(onResult)
        .finally(() => setSigningIn(false));
    }
  }, [response, onResult]);

  async function startSignIn() {
    setSigningIn(true);
    await promptAsync();
  }

  return { promptAsync: startSignIn, signingIn, ready: !!request };
}
