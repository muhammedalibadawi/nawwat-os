BEGIN;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'user_role', '');
$$;

CREATE OR REPLACE FUNCTION public.current_jwt_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.current_employee_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id
  FROM public.users u
  WHERE u.auth_id = auth.uid()
    AND u.tenant_id = public.current_jwt_tenant_id()
    AND u.is_active IS TRUE
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_employee_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_employee_user_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_employee_profile_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_employee_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'employees'
  ) THEN
    EXECUTE $sql$
      SELECT e.id
      FROM public.employees e
      WHERE e.auth_id = auth.uid()
        AND e.tenant_id = public.current_jwt_tenant_id()
      LIMIT 1
    $sql$
    INTO v_employee_id;
  END IF;

  RETURN v_employee_id;
END;
$$;

REVOKE ALL ON FUNCTION public.current_employee_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_employee_profile_id() TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'employees'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'employees'
        AND column_name = 'auth_id'
    ) THEN
      ALTER TABLE public.employees
        ADD COLUMN auth_id UUID UNIQUE REFERENCES auth.users(id);
    END IF;

    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_employees_auth_tenant
        ON public.employees(auth_id, tenant_id)
        WHERE auth_id IS NOT NULL
    ';
  END IF;
END;
$$;

DROP POLICY IF EXISTS "users: select" ON public.users;
CREATE POLICY "users: select" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    (
      public.current_app_role() = 'employee'
      AND tenant_id = public.current_jwt_tenant_id()
      AND auth_id = auth.uid()
    )
    OR (
      COALESCE(public.current_app_role(), '') <> 'employee'
      AND tenant_id = (
        SELECT u.tenant_id
        FROM public.users u
        WHERE u.auth_id = auth.uid()
        LIMIT 1
      )
    )
  );

ALTER TABLE IF EXISTS public.salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.employees ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'employees'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "employees: employee read own profile" ON public.employees';
    EXECUTE $policy$
      CREATE POLICY "employees: employee read own profile" ON public.employees
        FOR SELECT
        TO authenticated
        USING (
          public.current_app_role() = 'employee'
          AND tenant_id = public.current_jwt_tenant_id()
          AND auth_id = auth.uid()
        )
    $policy$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'salary_structures'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "salary_structures: employee read own" ON public.salary_structures';

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'salary_structures'
        AND column_name = 'user_id'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY "salary_structures: employee read own" ON public.salary_structures
          FOR SELECT
          TO authenticated
          USING (
            public.current_app_role() = 'employee'
            AND tenant_id = public.current_jwt_tenant_id()
            AND user_id = public.current_employee_user_id()
          )
      $policy$;
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'salary_structures'
        AND column_name = 'employee_id'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY "salary_structures: employee read own" ON public.salary_structures
          FOR SELECT
          TO authenticated
          USING (
            public.current_app_role() = 'employee'
            AND tenant_id = public.current_jwt_tenant_id()
            AND employee_id = public.current_employee_profile_id()
          )
      $policy$;
    END IF;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'payslips'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "payslips: employee read own" ON public.payslips';

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'payslips'
        AND column_name = 'user_id'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY "payslips: employee read own" ON public.payslips
          FOR SELECT
          TO authenticated
          USING (
            public.current_app_role() = 'employee'
            AND tenant_id = public.current_jwt_tenant_id()
            AND user_id = public.current_employee_user_id()
          )
      $policy$;
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'payslips'
        AND column_name = 'employee_id'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY "payslips: employee read own" ON public.payslips
          FOR SELECT
          TO authenticated
          USING (
            public.current_app_role() = 'employee'
            AND tenant_id = public.current_jwt_tenant_id()
            AND employee_id = public.current_employee_profile_id()
          )
      $policy$;
    END IF;
  END IF;
END;
$$;

DO $$
DECLARE
  v_payslips_has_user_id BOOLEAN;
  v_payslips_has_employee_id BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'payroll_runs'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'payslips'
  ) THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'payslips'
        AND column_name = 'user_id'
    )
    INTO v_payslips_has_user_id;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'payslips'
        AND column_name = 'employee_id'
    )
    INTO v_payslips_has_employee_id;

    EXECUTE 'DROP POLICY IF EXISTS "payroll_runs: employee read own" ON public.payroll_runs';

    IF v_payslips_has_user_id THEN
      EXECUTE $policy$
        CREATE POLICY "payroll_runs: employee read own" ON public.payroll_runs
          FOR SELECT
          TO authenticated
          USING (
            public.current_app_role() = 'employee'
            AND tenant_id = public.current_jwt_tenant_id()
            AND EXISTS (
              SELECT 1
              FROM public.payslips p
              WHERE p.tenant_id = payroll_runs.tenant_id
                AND p.payroll_run_id = payroll_runs.id
                AND p.user_id = public.current_employee_user_id()
            )
          )
      $policy$;
    ELSIF v_payslips_has_employee_id THEN
      EXECUTE $policy$
        CREATE POLICY "payroll_runs: employee read own" ON public.payroll_runs
          FOR SELECT
          TO authenticated
          USING (
            public.current_app_role() = 'employee'
            AND tenant_id = public.current_jwt_tenant_id()
            AND EXISTS (
              SELECT 1
              FROM public.payslips p
              WHERE p.tenant_id = payroll_runs.tenant_id
                AND p.payroll_run_id = payroll_runs.id
                AND p.employee_id = public.current_employee_profile_id()
            )
          )
      $policy$;
    END IF;
  END IF;
END;
$$;

COMMIT;
