import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PRICEIQ_URL = Deno.env.get("PRICEIQ_URL") ?? "http://priceiq:8000";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ── SECURITY: get tenant_id from JWT, NOT from request body ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: corsHeaders }
    );
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Invalid token" }),
      { status: 401, headers: corsHeaders }
    );
  }
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("auth_id", user.id)
    .single();
  if (!profile?.tenant_id) {
    return new Response(
      JSON.stringify({ error: "User has no tenant" }),
      { status: 403, headers: corsHeaders }
    );
  }
  const tenant_id = profile.tenant_id; // ← verified from DB

  // ── INPUT VALIDATION ──
  const {
    item_id,
    item_name,
    user_id,
    country = "ae",
    source_module = "manual",
  } = await req.json();

  if (!item_id || !item_name || !user_id) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: item_id, item_name, user_id" }),
      { status: 400, headers: corsHeaders }
    );
  }

  // ── CACHE CHECK: return existing snapshot if < 1 hour old ──
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentSnapshot } = await supabase
    .from("market_price_snapshots")
    .select("*")
    .eq("item_id", item_id)
    .eq("tenant_id", tenant_id)
    .gt("queried_at", oneHourAgo)
    .order("queried_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentSnapshot) {
    return new Response(
      JSON.stringify({ snapshot: recentSnapshot, cached: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get current nawwat prices
  const { data: item } = await supabase
    .from("items")
    .select("cost_price, selling_price")
    .eq("id", item_id)
    .eq("tenant_id", tenant_id)
    .single();

  // ── CALL PRICEIQ ──
  let priceData: any = null;
  try {
    const priceiqRes = await fetch(`${PRICEIQ_URL}/api/v1/chat/inquiry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: item_name,
        country,
        sort_by: "landed",
      }),
    });

    // ── FIX: check ok before proceeding ──
    if (!priceiqRes.ok) {
      return new Response(
        JSON.stringify({ error: `PriceIQ returned ${priceiqRes.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    priceData = await priceiqRes.json();
  } catch (e) {
    console.error("PriceIQ error:", e);
    return new Response(
      JSON.stringify({ error: "PriceIQ unavailable" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const best = priceData?.best_option;

  // Save snapshot
  const { data: snapshot, error: snapshotError } = await supabase
    .from("market_price_snapshots")
    .insert({
      tenant_id,
      item_id,
      item_name,
      search_query: item_name,
      best_platform: best?.platform ?? null,
      best_price_aed: best?.total_aed ?? null,
      best_eta_minutes: best?.delivery_eta_min ?? null,
      nawwat_cost_price: item?.cost_price ?? null,
      nawwat_selling_price: item?.selling_price ?? null,
      all_options: priceData?.all_options ?? [],
      country: country.toUpperCase(),
      queried_by: user_id,
      source_module,
    })
    .select()
    .single();

  if (snapshotError) {
    return new Response(
      JSON.stringify({ error: snapshotError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check and trigger active alerts
  const triggeredAlerts: string[] = [];
  if (best && snapshot) {
    const { data: alerts } = await supabase
      .from("market_price_alerts")
      .select("*")
      .eq("item_id", item_id)
      .eq("is_active", true);

    for (const alert of alerts ?? []) {
      let shouldTrigger = false;
      if (alert.alert_type === "below_price" && alert.target_price_aed) {
        shouldTrigger = best.total_aed <= alert.target_price_aed;
      } else if (alert.alert_type === "market_cheaper" && alert.threshold_pct) {
        const diff = snapshot.market_vs_selling_pct;
        shouldTrigger = diff !== null && diff < -alert.threshold_pct;
      }

      if (shouldTrigger) {
        await supabase
          .from("market_price_alerts")
          .update({
            is_active: false,
            triggered_at: new Date().toISOString(),
            triggered_price: best.total_aed,
            triggered_platform: best.platform,
            notified_at: new Date().toISOString(),
          })
          .eq("id", alert.id);

        await supabase.from("notifications").insert({
          tenant_id,
          user_id: alert.created_by,
          type: "price_alert",
          title: `تنبيه سعر: ${item_name}`,
          body: `وصل لـ ${best.total_aed} AED على ${best.platform}`,
          data: { alert_id: alert.id, snapshot_id: snapshot.id },
        });

        triggeredAlerts.push(alert.id);
      }
    }
  }

  return new Response(
    JSON.stringify({ snapshot, triggered_alerts: triggeredAlerts }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
