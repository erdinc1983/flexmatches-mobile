/**
 * admin-action Edge Function
 *
 * Server-side admin operations — never trust client-side is_admin flags.
 *
 * Flow:
 *   1. Verify JWT (caller must be authenticated)
 *   2. Check callers is_admin from DB via service-role client
 *   3. Execute the requested action using service-role client
 *   4. Return 403 if not admin
 *
 * Actions: ban | unban | promote | demote | make_pro | remove_pro | delete | edit
 *
 * Deploy:
 *   supabase functions deploy admin-action --project-ref bwnklngifvuqgkngelwr
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ActionType = "ban" | "unban" | "promote" | "demote" | "make_pro" | "remove_pro" | "delete" | "edit";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Verify caller identity ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // ── 2. Verify caller is actually admin (server-side check via service-role) ─
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: callerData } = await supabaseAdmin
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!callerData?.is_admin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 3. Parse request body ─────────────────────────────────────────────────
    const { userId, action, updates } = await req.json() as {
      userId: string;
      action: ActionType;
      updates?: Record<string, unknown>;
    };

    if (!userId || !action) {
      return new Response(JSON.stringify({ error: "Missing userId or action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-demotion or self-ban (safety guard)
    if (userId === user.id && (action === "demote" || action === "ban" || action === "delete")) {
      return new Response(JSON.stringify({ error: "Cannot perform this action on yourself" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 4. Execute action via service-role ───────────────────────────────────
    let payload: Record<string, unknown> = {};

    switch (action) {
      case "ban":        payload = { banned_at: new Date().toISOString() }; break;
      case "unban":      payload = { banned_at: null }; break;
      case "promote":    payload = { is_admin: true }; break;
      case "demote":     payload = { is_admin: false }; break;
      case "make_pro":   payload = { is_pro: true }; break;
      case "remove_pro": payload = { is_pro: false }; break;
      case "delete":     payload = { banned_at: new Date().toISOString() }; break; // soft-delete
      case "edit": {
        if (!updates || typeof updates !== "object") {
          return new Response(JSON.stringify({ error: "Missing updates for edit action" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Only allow editing these specific fields
        const allowed = ["full_name", "city", "fitness_level"];
        payload = Object.fromEntries(
          Object.entries(updates).filter(([k]) => allowed.includes(k))
        );
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update(payload)
      .eq("id", userId);

    if (updateError) throw updateError;

    console.log(`[admin-action] ${user.id} performed "${action}" on ${userId}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[admin-action]", err);
    return new Response(JSON.stringify({ error: err.message ?? "Unexpected error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
