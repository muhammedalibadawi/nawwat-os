-- Employee PIN for POS cashier gate (SHA-256(pin + salt))
BEGIN;

CREATE TABLE IF NOT EXISTS public.employee_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  salt text NOT NULL,
  pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_employee_pins_tenant ON public.employee_pins(tenant_id);

ALTER TABLE public.employee_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_pins: tenant isolation" ON public.employee_pins;
CREATE POLICY "employee_pins: tenant isolation" ON public.employee_pins
  FOR ALL
  USING (
    tenant_id = (SELECT u.tenant_id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    tenant_id = (SELECT u.tenant_id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1)
  );

COMMIT;
