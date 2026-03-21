-- NawwatOS v3.1 — purchase_receipt movement type + loyalty + assets + bank tables
BEGIN;

ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_movement_type_check;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_movement_type_check
  CHECK (movement_type IN (
    'purchase','purchase_receipt','sale','adjustment','transfer_in','transfer_out',
    'production_in','production_out','waste','return',
    'opening','expired_disposal'
  ));

CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  points_balance numeric(18,2) NOT NULL DEFAULT 0,
  total_earned numeric(18,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, customer_id)
);

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  loyalty_id uuid REFERENCES public.loyalty_points(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  type text NOT NULL,
  points numeric(18,2) NOT NULL,
  invoice_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_tenant ON public.loyalty_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON public.loyalty_transactions(customer_id);

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asset_name text NOT NULL,
  category text,
  purchase_date date,
  purchase_price numeric(18,2) NOT NULL DEFAULT 0,
  useful_life_years numeric(10,2) NOT NULL DEFAULT 1,
  salvage_value numeric(18,2) NOT NULL DEFAULT 0,
  accumulated_depreciation numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assets_tenant ON public.assets(tenant_id);

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_name text,
  bank_name text,
  iban text,
  currency text NOT NULL DEFAULT 'AED',
  current_balance numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_tenant ON public.bank_accounts(tenant_id);

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit','withdrawal')),
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_tx_account ON public.bank_transactions(bank_account_id);

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty_points: isolation" ON public.loyalty_points;
CREATE POLICY "loyalty_points: isolation" ON public.loyalty_points
  FOR ALL
  USING      (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "loyalty_transactions: isolation" ON public.loyalty_transactions;
CREATE POLICY "loyalty_transactions: isolation" ON public.loyalty_transactions
  FOR ALL
  USING      (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "assets: isolation" ON public.assets;
CREATE POLICY "assets: isolation" ON public.assets
  FOR ALL
  USING      (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "bank_accounts: isolation" ON public.bank_accounts;
CREATE POLICY "bank_accounts: isolation" ON public.bank_accounts
  FOR ALL
  USING      (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "bank_transactions: isolation" ON public.bank_transactions;
CREATE POLICY "bank_transactions: isolation" ON public.bank_transactions
  FOR ALL
  USING      (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

COMMIT;
