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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employee_pins'
      AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.employee_pins
      ADD COLUMN tenant_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employee_pins'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.employee_pins
      ADD COLUMN user_id uuid;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employee_pins'
      AND column_name = 'employee_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.employee_pins ep
      SET user_id = NULLIF(ep.employee_id::text, '')::uuid
      WHERE ep.user_id IS NULL
        AND ep.employee_id IS NOT NULL
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employee_pins'
      AND column_name = 'tenant_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employee_pins'
      AND column_name = 'user_id'
  ) THEN
    UPDATE public.employee_pins ep
    SET tenant_id = u.tenant_id
    FROM public.users u
    WHERE ep.user_id = u.id
      AND ep.tenant_id IS NULL;

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_employee_pins_tenant ON public.employee_pins(tenant_id)';
  END IF;
END;
$$;

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
