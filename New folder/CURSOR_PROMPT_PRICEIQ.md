# CURSOR AI PROMPT — PriceIQ Integration into NawwatOS
# ============================================================
# انسخ الـ prompt ده كاملاً وحطه في Cursor AI
# ============================================================

## SYSTEM CONTEXT

You are working on **NawwatOS** — an Arabic-first Enterprise ERP SaaS for UAE/KSA markets.

**Tech Stack:**
- Frontend: React + TypeScript + Tailwind CSS (Arabic RTL)
- Backend: Supabase (PostgreSQL + Edge Functions + RLS)
- Deployment: Vercel
- External Service: PriceIQ microservice (FastAPI, runs on separate Docker container)

**Existing Schema:** The project has `nawwat_schema_v4_1_COMPLETE.sql` with 44 tables including:
- `tenants`, `branches`, `users`, `roles` (multi-tenant with RLS)
- `items` (products with `cost_price`, `selling_price`, `min_price`)
- `price_history` (internal price change ledger — NOT market prices)
- `notifications` (WhatsApp + in-app notification queue)
- `orders`, `invoices`, `payments` (full commerce flow)

**Critical Rule:** All RLS policies use the subquery pattern:
```sql
USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()))
```
NOT function calls. Never change this pattern.

---

## TASK: Implement PriceIQ Integration

### Step 1 — Run SQL Migration

Apply this migration to Supabase. It adds market intelligence tables WITHOUT touching existing tables:

```sql
-- ============================================================
-- PriceIQ Integration Migration — NawwatOS v4.2
-- Run AFTER nawwat_schema_v4_1_COMPLETE.sql
-- ============================================================

-- Table 1: Market price snapshots (external prices from Amazon/Noon/Carrefour)
-- DIFFERENT from price_history which tracks internal price changes
CREATE TABLE public.market_price_snapshots (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id               UUID          REFERENCES public.items(id) ON DELETE SET NULL,
  item_name             TEXT          NOT NULL,
  search_query          TEXT          NOT NULL,
  best_platform         TEXT,
  best_price_aed        NUMERIC(15,2),
  best_eta_minutes      INTEGER,
  nawwat_cost_price     NUMERIC(15,4),
  nawwat_selling_price  NUMERIC(15,2),
  market_vs_selling_pct NUMERIC(8,2) GENERATED ALWAYS AS (
    CASE
      WHEN nawwat_selling_price > 0 AND best_price_aed > 0
      THEN ROUND((nawwat_selling_price - best_price_aed) / best_price_aed * 100, 2)
      ELSE NULL
    END
  ) STORED,
  all_options           JSONB         DEFAULT '[]',
  country               TEXT          NOT NULL DEFAULT 'AE' CHECK (country IN ('AE','SA')),
  queried_by            UUID          REFERENCES public.users(id),
  queried_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  source_module         TEXT          CHECK (source_module IN ('procurement','inventory','pricing','manual'))
);

CREATE INDEX idx_mps_tenant  ON public.market_price_snapshots(tenant_id);
CREATE INDEX idx_mps_item    ON public.market_price_snapshots(tenant_id, item_id);
CREATE INDEX idx_mps_queried ON public.market_price_snapshots(tenant_id, queried_at DESC);

ALTER TABLE public.market_price_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_price_snapshots: isolation"
  ON public.market_price_snapshots FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

-- Table 2: Price alerts
CREATE TABLE public.market_price_alerts (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id           UUID          REFERENCES public.items(id) ON DELETE CASCADE,
  item_name         TEXT          NOT NULL,
  alert_type        TEXT          NOT NULL DEFAULT 'below_price'
                      CHECK (alert_type IN ('below_price','above_price','market_cheaper','competitor_drop')),
  target_price_aed  NUMERIC(15,2),
  threshold_pct     NUMERIC(5,2),
  platform_filter   TEXT,
  country           TEXT          NOT NULL DEFAULT 'AE',
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  triggered_at      TIMESTAMPTZ,
  triggered_price   NUMERIC(15,2),
  triggered_platform TEXT,
  notify_via        TEXT[]        DEFAULT ARRAY['in_app'],
  notified_at       TIMESTAMPTZ,
  created_by        UUID          REFERENCES public.users(id),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_mpa_tenant ON public.market_price_alerts(tenant_id);
CREATE INDEX idx_mpa_active ON public.market_price_alerts(tenant_id, is_active);
CREATE INDEX idx_mpa_item   ON public.market_price_alerts(tenant_id, item_id);

ALTER TABLE public.market_price_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_price_alerts: isolation"
  ON public.market_price_alerts FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

-- View: combines internal nawwat prices with market intelligence
CREATE OR REPLACE VIEW public.item_market_intelligence AS
SELECT
  i.id AS item_id, i.tenant_id, i.name, i.name_ar, i.sku,
  i.cost_price, i.selling_price, i.min_price,
  mps.id AS snapshot_id,
  mps.best_platform,
  mps.best_price_aed AS market_best_price,
  mps.best_eta_minutes,
  mps.market_vs_selling_pct,
  mps.queried_at AS market_last_checked,
  mps.all_options AS market_all_options,
  CASE
    WHEN mps.market_vs_selling_pct IS NULL THEN 'unchecked'
    WHEN mps.market_vs_selling_pct > 10    THEN 'overpriced'
    WHEN mps.market_vs_selling_pct < -10   THEN 'competitive'
    ELSE 'fair'
  END AS pricing_assessment,
  (SELECT COUNT(*) FROM public.market_price_alerts a
   WHERE a.item_id = i.id AND a.is_active = TRUE) AS active_alerts_count
FROM public.items i
LEFT JOIN LATERAL (
  SELECT * FROM public.market_price_snapshots s
  WHERE s.item_id = i.id AND s.tenant_id = i.tenant_id
  ORDER BY s.queried_at DESC LIMIT 1
) mps ON TRUE
WHERE i.deleted_at IS NULL;
```

---

### Step 2 — Create Supabase Edge Function

Create file: `supabase/functions/priceiq-query/index.ts`

```typescript
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

  const { item_id, item_name, tenant_id, user_id, country = "ae", source_module = "manual" } =
    await req.json();

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

  // Check active alerts
  const triggeredAlerts: any[] = [];
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
        await supabase.from("market_price_alerts").update({
          is_active: false,
          triggered_at: new Date().toISOString(),
          triggered_price: best.total_aed,
          triggered_platform: best.platform,
          notified_at: new Date().toISOString(),
        }).eq("id", alert.id);

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
```

---

### Step 3 — Create React Component

Create file: `src/components/priceiq/MarketPriceWidget.tsx`

```tsx
import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  itemId: string;
  itemName: string;
  tenantId: string;
  userId: string;
  currentSellingPrice: number;
  currency?: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  amazon_ae: "Amazon 🇦🇪",
  amazon_sa: "Amazon 🇸🇦",
  noon_ae: "Noon 🇦🇪",
  noon_sa: "Noon 🇸🇦",
  carrefour_ae: "Carrefour 🇦🇪",
  jumia_ae: "Jumia 🇦🇪",
};

export function MarketPriceWidget({
  itemId,
  itemName,
  tenantId,
  userId,
  currentSellingPrice,
  currency = "AED",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkMarketPrice() {
    setLoading(true);
    setError(null);

    const { data, error: fnError } = await supabase.functions.invoke("priceiq-query", {
      body: { item_id: itemId, item_name: itemName, tenant_id: tenantId, user_id: userId, country: "ae", source_module: "pricing" },
    });

    if (fnError) {
      setError("تعذّر الاتصال بمحرك المقارنة");
    } else {
      setSnapshot(data.snapshot);
    }
    setLoading(false);
  }

  const diff = snapshot?.market_vs_selling_pct;
  const assessment =
    diff === null || diff === undefined ? null
    : diff > 10  ? { label: `سعرك أعلى من السوق بـ ${Math.abs(diff).toFixed(1)}%`, color: "text-red-600",    bg: "bg-red-50",    icon: "📈" }
    : diff < -10 ? { label: `سعرك تنافسي جداً (أرخص ${Math.abs(diff).toFixed(1)}%)`, color: "text-green-600", bg: "bg-green-50",  icon: "✅" }
    :              { label: "سعرك عادل مقارنة بالسوق",  color: "text-yellow-600", bg: "bg-yellow-50", icon: "⚖️" };

  return (
    <div className="border border-gray-200 rounded-xl p-4 mt-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <span className="font-semibold text-sm text-gray-800">مقارنة أسعار السوق</span>
        </div>
        <button
          onClick={checkMarketPrice}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all font-medium"
        >
          {loading ? "⏳ جاري البحث..." : snapshot ? "🔄 تحديث" : "🔍 فحص السوق"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-600 text-center">
          {error}
        </div>
      )}

      {!snapshot && !loading && !error && (
        <div className="text-center py-4">
          <p className="text-xs text-gray-400">اضغط "فحص السوق" لمقارنة سعرك مع Amazon و Noon</p>
        </div>
      )}

      {snapshot && (
        <div className="space-y-2.5">
          {assessment && (
            <div className={`rounded-lg px-3 py-2.5 ${assessment.bg} flex items-center gap-2`}>
              <span>{assessment.icon}</span>
              <span className={`text-xs font-semibold ${assessment.color}`}>{assessment.label}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-50 rounded-lg p-2.5 text-center">
              <p className="text-xs text-blue-500 mb-1">أفضل سعر في السوق</p>
              <p className="text-base font-bold text-blue-800">
                {snapshot.best_price_aed?.toFixed(2)}
              </p>
              <p className="text-xs text-blue-400">
                {PLATFORM_LABELS[snapshot.best_platform] ?? snapshot.best_platform}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5 text-center">
              <p className="text-xs text-gray-500 mb-1">سعرك الحالي</p>
              <p className="text-base font-bold text-gray-800">
                {currentSellingPrice.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400">{currency}</p>
            </div>
          </div>

          {snapshot.best_eta_minutes && (
            <p className="text-xs text-gray-400 text-center">
              ⏱️ التوصيل: {snapshot.best_eta_minutes} دقيقة
            </p>
          )}

          {snapshot.all_options?.length > 1 && (
            <details className="cursor-pointer">
              <summary className="text-xs text-blue-500 hover:underline px-1">
                عرض كل المنصات ({snapshot.all_options.length})
              </summary>
              <div className="mt-2 space-y-1">
                {snapshot.all_options.map((opt: any, i: number) => (
                  <div key={i} className="flex justify-between items-center px-2 py-1.5 bg-gray-50 rounded text-xs">
                    <span className="text-gray-600">{PLATFORM_LABELS[opt.platform] ?? opt.platform}</span>
                    <span className="font-semibold text-gray-800">{opt.total_aed?.toFixed(2)} {currency}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          <p className="text-xs text-gray-300 text-left">
            آخر تحديث: {new Date(snapshot.queried_at).toLocaleString("ar-AE")}
          </p>
        </div>
      )}
    </div>
  );
}
```

---

### Step 4 — Add to Item Detail Screen

Find the item detail page in NawwatOS (likely `src/pages/items/[id].tsx` or similar).

Add the import and component:

```tsx
import { MarketPriceWidget } from "@/components/priceiq/MarketPriceWidget";

// Inside the item detail JSX, after the pricing section:
<MarketPriceWidget
  itemId={item.id}
  itemName={item.name}
  tenantId={currentTenant.id}
  userId={currentUser.id}
  currentSellingPrice={item.selling_price}
  currency={currentTenant.currency}
/>
```

---

### Step 5 — Environment Variables

In Supabase Dashboard → Settings → Edge Functions → Environment Variables, add:
```
PRICEIQ_URL = http://YOUR_SERVER_IP:8000
```

In `.env.local` for local development:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## IMPORTANT RULES FOR CURSOR

1. **Never modify existing tables** — only ADD new tables/columns
2. **Always use the RLS subquery pattern** — never use function calls in policies
3. **Arabic RTL** — all user-facing text must be Arabic, direction: rtl
4. **PriceIQ is external** — never try to embed PriceIQ code into NawwatOS directly
5. **Supabase Edge Functions** are the ONLY bridge between NawwatOS and PriceIQ
6. **TypeScript strict mode** — no `any` except where documented above
7. **Tailwind only** — no inline styles except for dynamic values
