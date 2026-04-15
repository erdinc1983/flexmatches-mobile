/**
 * verify-phone
 *
 * Server-side phone verification + trusted users.phone_verified write.
 *
 * Why this exists:
 *   Before this function, the client called supabase.auth.verifyOtp() and then
 *   directly UPDATEd users.phone_verified = true. Even though the OTP step
 *   "proves" possession of the phone, the column write is just a regular
 *   client SQL write — a malicious client (or anyone with the user's session
 *   token + curl) could skip the OTP entirely and set phone_verified = true.
 *   Since referral rewards depend on phone_verified, that bypass directly
 *   converts to free Pro and cash-equivalent rewards.
 *
 *   This function moves the verify+write behind the service role:
 *     1. Verify the caller's auth (must be a logged-in user)
 *     2. Verify the OTP token via supabase.auth.verifyOtp using the caller's
 *        access token — this proves the SMS actually arrived
 *     3. Only on success, use service-role to set phone_verified=true and
 *        store the canonical phone (subject to the unique constraint)
 *     4. Return any unique-constraint failure as a clear 409
 *
 * Caller posts: { phone: string, token: string } with Authorization: Bearer <jwt>
 * Returns 200 { ok: true } on success, 4xx with { error } otherwise.
 *
 * Companion DB change: REVOKE UPDATE (phone_verified) ON public.users FROM
 * authenticated. The client cannot write that column directly anymore — only
 * this Edge Function can (via service-role).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // 1. Authn: require a JWT from a logged-in user
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_auth" }, 401);

  // Use a per-request client bound to the caller's JWT — supabase.auth.getUser
  // will return their identity, supabase.auth.verifyOtp will run as them.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "invalid_session" }, 401);
  const userId = userData.user.id;

  // 2. Validate body
  let body: { phone?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const rawPhone = (body.phone ?? "").trim();
  const otp      = (body.token ?? "").trim();
  if (!rawPhone || !otp) return json({ error: "missing_fields" }, 400);

  // Canonicalize to strict E.164 BEFORE either OTP verification or DB write
  // so the unique-phone constraint catches "+14155551234" === "1-415-555-1234"
  // and the row stored in users.phone is always in one canonical shape.
  // Strip whitespace, dashes, parens, dots; preserve a leading + only.
  const stripped = rawPhone.replace(/[\s\-().]/g, "");
  const phone = stripped.startsWith("+") ? stripped : "+" + stripped;
  // E.164 = '+' then 1–15 digits, leading digit 1–9 (no leading 0 country code).
  if (!/^\+[1-9][0-9]{6,14}$/.test(phone)) {
    return json({ error: "bad_phone_format" }, 400);
  }

  // 3. Verify OTP — runs as the caller. If the SMS code is wrong, this
  //    fails and we return 401. The user's session learning that the phone
  //    is valid is a SIDE EFFECT of supabase.auth.verifyOtp succeeding;
  //    the column write below is what makes the verification durable in
  //    public.users.
  const { error: otpErr } = await userClient.auth.verifyOtp({
    phone,
    token: otp,
    type:  "phone_change",
  });
  if (otpErr) {
    return json({ error: "otp_invalid", detail: otpErr.message }, 401);
  }

  // 4. Trusted write via service role. Catches the unique-phone constraint
  //    error and surfaces it cleanly so the client can show the right copy.
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { error: writeErr } = await adminClient
    .from("users")
    .update({ phone_verified: true, phone })
    .eq("id", userId);

  if (writeErr) {
    if (/duplicate|unique/i.test(writeErr.message)) {
      return json({ error: "phone_in_use" }, 409);
    }
    return json({ error: "write_failed", detail: writeErr.message }, 500);
  }

  return json({ ok: true });
});
