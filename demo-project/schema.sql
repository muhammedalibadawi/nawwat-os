-- Tenants Table RLS (Master Admin Only)
CREATE POLICY "Master admins can read tenants"
ON public.tenants
FOR SELECT
USING (auth.jwt() -> 'app_metadata' ->> 'user_role' = 'master_admin');

-- POS Tables RLS (Tenant Isolation)
CREATE POLICY "Tenant-bound access for items"
ON public.items
FOR ALL
TO authenticated
USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

CREATE POLICY "Tenant-bound access for categories"
ON public.item_categories
FOR ALL
TO authenticated
USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
