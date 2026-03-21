// supabase/functions/priceiq-query/index.ts
// Deploy with: supabase functions deploy priceiq-query

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PRICEIQ_URL = Deno.env.get("PRICEIQ_URL") ?? "http://priceiq:8000";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const {
    item_id,
    item_name,
    tenant_id,
    user_id,
    country = "ae",
    source_module = "manual",
  } = await req.json();

  // Get current nawwat prices
  const { data: item } = await supabase
    .from("items")
    .select("cost_price, selling_price")
    .eq("id", item_id)
    .eq("tenant_id", tenant_id)
    .single();

  // Call PriceIQ
  let priceData: any = null;
  try {
    const priceiqRes = await fetch(`${PRICEIQ_URL}/api/v1/chat/inquiry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: item_name,
        customer_phone: "+971000000000",
        country,
        sort_by: "landed",
      }),
    });
    if (priceiqRes.ok) priceData = await priceiqRes.json();
  } catch (e) {
    console.error("PriceIQ error:", e);
    return new Response(JSON.stringify({ error: "PriceIQ unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
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
    return new Response(JSON.stringify({ error: snapshotError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
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
    { headers: { "Content-Type": "application/json" } }
  );
});
