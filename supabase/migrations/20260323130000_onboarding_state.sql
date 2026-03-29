BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS setup_state TEXT NOT NULL DEFAULT 'company_profile';

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

UPDATE public.tenants
SET setup_state = CASE
  WHEN onboarded_at IS NOT NULL THEN 'completed'
  WHEN COALESCE(NULLIF(setup_state, ''), 'company_profile') = 'completed' THEN 'completed'
  ELSE COALESCE(NULLIF(setup_state, ''), 'company_profile')
END;

COMMIT;
