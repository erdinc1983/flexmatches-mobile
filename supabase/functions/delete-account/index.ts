/**
 * delete-account Edge Function
 *
 * Fully removes a user's account:
 *   1. Verify JWT — only the owner can delete themselves
 *   2. Delete push tokens
 *   3. Delete profile row (cascades messages, matches, etc. via FK)
 *   4. Delete auth.users entry via auth.admin.deleteUser()
 *
 * Deploy:
 *   supabase functions deploy delete-account --no-verify-jwt
 *   (JWT is verified manually inside the function)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Verify caller identity ────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Client with caller's JWT — to identify who is making the request
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Service-role client for privileged operations ─────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Delete push tokens
    await supabaseAdmin.from("push_tokens").delete().eq("user_id", user.id);

    // 2. Delete profile row (FK cascades: matches, messages, workouts, etc.)
    const { error: profileError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", user.id);
    if (profileError) throw profileError;

    // 3. Delete auth user — must be last (invalidates all tokens)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (authError) throw authError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[delete-account]", err);
    return new Response(JSON.stringify({ error: err.message ?? "Unexpected error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
