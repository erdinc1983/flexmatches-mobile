/**
 * verify-iap Edge Function
 *
 * Validates an Apple App Store receipt and activates Pro for the user.
 *
 * Flow:
 *   1. Verify JWT — only the owner can activate their own Pro
 *   2. Send receipt to Apple's verifyReceipt API (sandbox first, then production)
 *   3. If valid and productId matches, set users.is_pro = true
 *
 * Env vars required (set via Supabase dashboard → Edge Functions → Secrets):
 *   APPLE_SHARED_SECRET — App Store Connect → My Apps → In-App Purchases → Shared Secret
 *
 * Deploy:
 *   supabase functions deploy verify-iap --project-ref bwnklngifvuqgkngelwr
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APPLE_SANDBOX_URL    = "https://sandbox.itunes.apple.com/verifyReceipt";
const APPLE_PRODUCTION_URL = "https://buy.itunes.apple.com/verifyReceipt";

const PRO_PRODUCT_IDS = [
  "com.flexmatches.app.pro_monthly",
  "com.flexmatches.app.pro_yearly",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function verifyReceipt(receipt: string, sandbox: boolean): Promise<any> {
  const url = sandbox ? APPLE_SANDBOX_URL : APPLE_PRODUCTION_URL;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "receipt-data": receipt,
      "password": Deno.env.get("APPLE_SHARED_SECRET") ?? "",
      "exclude-old-transactions": true,
    }),
  });
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Verify caller identity ─────────────────────────────────────────────
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

    const { receipt, productId } = await req.json();
    if (!receipt || !productId) {
      return new Response(JSON.stringify({ error: "Missing receipt or productId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!PRO_PRODUCT_IDS.includes(productId)) {
      return new Response(JSON.stringify({ error: "Unknown productId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validate with Apple — try production first, fall back to sandbox ──
    let appleResponse = await verifyReceipt(receipt, false);

    // Status 21007 means receipt is from sandbox — retry against sandbox endpoint
    if (appleResponse.status === 21007) {
      appleResponse = await verifyReceipt(receipt, true);
    }

    if (appleResponse.status !== 0) {
      console.error("[verify-iap] Apple status:", appleResponse.status);
      return new Response(JSON.stringify({ error: "Receipt validation failed", appleStatus: appleResponse.status }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Check that the receipt contains a valid active subscription ────────
    const latestReceipts: any[] = appleResponse.latest_receipt_info ?? [];
    const now = Date.now();
    const activeSubscription = latestReceipts.find((r: any) => {
      const expires = parseInt(r.expires_date_ms ?? "0", 10);
      return PRO_PRODUCT_IDS.includes(r.product_id) && expires > now;
    });

    if (!activeSubscription) {
      return new Response(JSON.stringify({ error: "No active subscription found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Activate Pro via service-role client ──────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ is_pro: true })
      .eq("id", user.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[verify-iap]", err);
    return new Response(JSON.stringify({ error: err.message ?? "Unexpected error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
