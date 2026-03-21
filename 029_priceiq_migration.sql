-- ============================================================
-- 029_priceiq_migration.sql
-- PriceIQ Integration Migration — NawwatOS v4.2
-- ============================================================

BEGIN;

-- Table 1: Market price snapshots (external prices from Amazon/Noon/Carrefour)
CREATE TABLE IF NOT EXISTS public.market_price_snapshots (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE INDEX IF NOT EXISTS idx_mps_tenant  ON public.market_price_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mps_item    ON public.market_price_snapshots(tenant_id, item_id);
CREATE INDEX IF NOT EXISTS idx_mps_queried ON public.market_price_snapshots(tenant_id, queried_at DESC);

ALTER TABLE public.market_price_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "market_price_snapshots: isolation"
    ON public.market_price_snapshots FOR ALL
    USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Table 2: Price alerts
CREATE TABLE IF NOT EXISTS public.market_price_alerts (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE INDEX IF NOT EXISTS idx_mpa_tenant ON public.market_price_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mpa_active ON public.market_price_alerts(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mpa_item   ON public.market_price_alerts(tenant_id, item_id);

ALTER TABLE public.market_price_alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "market_price_alerts: isolation"
    ON public.market_price_alerts FOR ALL
    USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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

COMMIT;
