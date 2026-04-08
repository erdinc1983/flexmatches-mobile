/**
 * notify-admin-report Edge Function
 *
 * Called after a bug/report is submitted.
 * Finds all admin users with push tokens and sends Expo push notifications.
 *
 * Deploy:
 *   supabase functions deploy notify-admin-report --project-ref bwnklngifvuqgkngelwr
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin       = createClient(supabaseUrl, serviceKey);

  // Parse report payload
  const { reportId, message, reporterEmail } = await req.json();

  // Get all admin users with expo push tokens
  const { data: admins } = await admin
    .from("users")
    .select("expo_push_token, full_name")
    .eq("is_admin", true)
    .not("expo_push_token", "is", null);

  if (!admins || admins.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tokens = admins
    .map((u: any) => u.expo_push_token)
    .filter((t: string) => t?.startsWith("ExponentPushToken[") || t?.startsWith("ExpoPushToken["));

  if (tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: "no valid tokens" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const messages = tokens.map((token: string) => ({
    to:    token,
    title: "🐛 New Bug Report",
    body:  message ? message.substring(0, 120) : "A new report was submitted",
    data:  { type: "admin_report", reportId, reporterEmail },
    sound: "default",
  }));

  await fetch(EXPO_PUSH_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(messages),
  });

  return new Response(JSON.stringify({ sent: tokens.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
