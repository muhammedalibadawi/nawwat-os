-- NawwatOS v3.2 — Gulf compliance: tenant finance columns, fx_rates, cheques, writeoffs, invoice tax_amount_local
BEGIN;

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'UAE';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS default_currency TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC(5,2);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 5;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS vat_no TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address TEXT;

UPDATE public.tenants SET default_currency = COALESCE(default_currency, currency) WHERE default_currency IS NULL;
UPDATE public.tenants SET default_tax_rate = COALESCE(default_tax_rate, vat_rate, 5) WHERE default_tax_rate IS NULL;
UPDATE public.tenants SET country_code = COALESCE(NULLIF(TRIM(country_code), ''), 'UAE') WHERE country_code IS NULL;

CREATE TABLE IF NOT EXISTS public.fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate numeric(18,6) NOT NULL,
  rate_date date NOT NULL DEFAULT CURRENT_DATE,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, from_currency, to_currency, rate_date)
);
CREATE INDEX IF NOT EXISTS idx_fx_tenant ON public.fx_rates(tenant_id);

CREATE TABLE IF NOT EXISTS public.cheques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('received','issued')),
  cheque_no text,
  bank_name text,
  cheque_date date,
  due_date date,
  amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'AED',
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','deposited','cleared','bounced','cancelled','legal')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cheques_tenant ON public.cheques(tenant_id);

CREATE TABLE IF NOT EXISTS public.inventory_writeoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id uuid NOT NULL,
  warehouse_id uuid,
  quantity numeric(14,4) NOT NULL,
  unit_cost numeric(15,4) NOT NULL DEFAULT 0,
  reason text NOT NULL,
  reason_detail text,
  notes text,
  receipt_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_iw_tenant ON public.inventory_writeoffs(tenant_id);

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_amount_local numeric(18,2);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS currency_code text;

UPDATE public.invoices SET currency_code = COALESCE(currency_code, currency) WHERE currency_code IS NULL;

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_writeoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fx_rates: isolation" ON public.fx_rates;
CREATE POLICY "fx_rates: isolation" ON public.fx_rates FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "cheques: isolation" ON public.cheques;
CREATE POLICY "cheques: isolation" ON public.cheques FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "inventory_writeoffs: isolation" ON public.inventory_writeoffs;
CREATE POLICY "inventory_writeoffs: isolation" ON public.inventory_writeoffs FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

COMMIT;
