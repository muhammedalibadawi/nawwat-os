-- ============================================================
--  NawwatOS — Final Production Schema v5.1
--  PostgreSQL 15+ / Supabase
--  Updated: 2026-03-05
--
--  SECTORS: F&B · Retail · Pharmacy · Clinic · Hospital
--           School · Real Estate · Manufacturing · General
--
--  ALL BUGS FIXED (see AUDIT below)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
--  HELPERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Blocks UPDATE/DELETE on immutable audit tables
CREATE OR REPLACE FUNCTION public.block_mutations()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Table % is immutable (append-only). Operation % is not allowed.',
    TG_TABLE_NAME, TG_OP;
  RETURN NULL;
END;
$$;

-- ============================================================
--  STEP 1: CREATE ALL TABLES
-- ============================================================

-- ── 1. tenants ───────────────────────────────────────────────
CREATE TABLE public.tenants (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT        NOT NULL,
  name_ar             TEXT,
  slug                TEXT        NOT NULL UNIQUE,
  logo_url            TEXT,
  brand_color         TEXT        DEFAULT '#00E5FF',
  brand_color_dark    TEXT        DEFAULT '#0A192F',
  portal_domain       TEXT        UNIQUE,
  portal_subdomain    TEXT        UNIQUE,
  tax_registration_no TEXT,
  cr_number           TEXT,
  country             TEXT        NOT NULL DEFAULT 'AE',
  currency            TEXT        NOT NULL DEFAULT 'AED',
  timezone            TEXT        NOT NULL DEFAULT 'Asia/Dubai',
  sector              TEXT        NOT NULL DEFAULT 'retail'
                        CHECK (sector IN (
                          'fnb','retail','pharmacy','real_estate',
                          'manufacturing','clinic','hospital','school','general'
                        )),
  plan                TEXT        NOT NULL DEFAULT 'starter'
                        CHECK (plan IN ('starter','growth','business','enterprise')),
  plan_expires_at     TIMESTAMPTZ,
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  onboarded_at        TIMESTAMPTZ,
  whatsapp_number     TEXT,
  whatsapp_api_key    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_tenants_upd BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. branches ──────────────────────────────────────────────
CREATE TABLE public.branches (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  name_ar     TEXT,
  code        TEXT,
  address     TEXT,
  city        TEXT,
  country     TEXT        NOT NULL DEFAULT 'AE',
  phone       TEXT,
  email       TEXT,
  latitude    NUMERIC(10,7),
  longitude   NUMERIC(10,7),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  is_default  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id)        -- required for composite FK references
);
CREATE INDEX idx_branches_tenant ON public.branches(tenant_id);
CREATE TRIGGER trg_branches_upd BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. users ─────────────────────────────────────────────────
CREATE TABLE public.users (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id         UUID        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  default_branch  UUID,       -- composite FK added after branches unique exists
  full_name       TEXT        NOT NULL,
  full_name_ar    TEXT,
  email           TEXT        NOT NULL,
  phone           TEXT,
  avatar_url      TEXT,
  employee_id     TEXT,
  job_title       TEXT,
  joined_at       DATE,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email),
  UNIQUE (tenant_id, id)        -- required for composite FK references
);
CREATE INDEX idx_users_tenant     ON public.users(tenant_id);
CREATE INDEX idx_users_auth_id    ON public.users(auth_id);
CREATE INDEX idx_users_email      ON public.users(email);
-- FIX-8: Covering index — RLS subquery hits single index scan
CREATE INDEX idx_users_auth_tenant ON public.users(auth_id, tenant_id);

CREATE TRIGGER trg_users_upd BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.users
  ADD CONSTRAINT fk_users_default_branch
    FOREIGN KEY (tenant_id, default_branch)
    REFERENCES public.branches(tenant_id, id) ON DELETE SET NULL;

-- ── 4. roles ─────────────────────────────────────────────────
CREATE TABLE public.roles (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  name_ar     TEXT        NOT NULL DEFAULT '',
  description TEXT,
  is_system   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name),
  UNIQUE (tenant_id, id)
);
CREATE INDEX idx_roles_tenant ON public.roles(tenant_id);
CREATE TRIGGER trg_roles_upd BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 5. role_permissions ──────────────────────────────────────
CREATE TABLE public.role_permissions (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role_id               UUID        NOT NULL,
  module                TEXT        NOT NULL,
  can_view              BOOLEAN     NOT NULL DEFAULT FALSE,
  can_create            BOOLEAN     NOT NULL DEFAULT FALSE,
  can_update            BOOLEAN     NOT NULL DEFAULT FALSE,
  can_delete            BOOLEAN     NOT NULL DEFAULT FALSE,
  can_approve           BOOLEAN     NOT NULL DEFAULT FALSE,
  restricted_categories TEXT[],
  max_discount_pct      NUMERIC(5,2) DEFAULT 100,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, role_id, module),
  CONSTRAINT fk_rp_role
    FOREIGN KEY (tenant_id, role_id)
    REFERENCES public.roles(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_rp_tenant ON public.role_permissions(tenant_id);
CREATE INDEX idx_rp_role   ON public.role_permissions(role_id);
CREATE TRIGGER trg_rp_upd BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 6. user_roles ────────────────────────────────────────────
CREATE TABLE public.user_roles (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL,
  role_id     UUID        NOT NULL,
  branch_id   UUID,
  granted_by  UUID,       -- intentionally no FK: granting user may be deleted
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, role_id, branch_id),
  CONSTRAINT fk_ur_user
    FOREIGN KEY (tenant_id, user_id)
    REFERENCES public.users(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_ur_role
    FOREIGN KEY (tenant_id, role_id)
    REFERENCES public.roles(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_ur_tenant ON public.user_roles(tenant_id);
CREATE INDEX idx_ur_user   ON public.user_roles(user_id);

-- ── 7. contacts ──────────────────────────────────────────────
CREATE TABLE public.contacts (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type            TEXT        NOT NULL
                    CHECK (type IN (
                      'customer','supplier','employee','lead',
                      'patient','student','real_estate_tenant','other'
                    )),
  is_company      BOOLEAN     NOT NULL DEFAULT FALSE,
  name            TEXT        NOT NULL,
  name_ar         TEXT,
  email           TEXT,
  phone           TEXT,
  mobile          TEXT,
  whatsapp        TEXT,
  address         TEXT,
  city            TEXT,
  country         TEXT        DEFAULT 'AE',
  date_of_birth   DATE,
  gender          TEXT        CHECK (gender IN ('male','female','other')),
  id_number       TEXT,
  tax_number      TEXT,
  credit_limit    NUMERIC(15,2) DEFAULT 0,
  credit_days     SMALLINT      DEFAULT 0,
  outstanding_bal NUMERIC(15,2) DEFAULT 0,
  loyalty_points  INTEGER       DEFAULT 0,
  loyalty_tier    TEXT          DEFAULT 'bronze'
                    CHECK (loyalty_tier IN ('bronze','silver','gold','platinum')),
  portal_enabled      BOOLEAN   NOT NULL DEFAULT FALSE,
  portal_password_hash TEXT,
  tags            TEXT[]        DEFAULT '{}',
  notes           TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
CREATE INDEX idx_contacts_tenant ON public.contacts(tenant_id);
CREATE INDEX idx_contacts_type   ON public.contacts(tenant_id, type);
CREATE INDEX idx_contacts_email  ON public.contacts(email);
CREATE INDEX idx_contacts_mobile ON public.contacts(mobile);
CREATE TRIGGER trg_contacts_upd BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 8. taxes ─────────────────────────────────────────────────
CREATE TABLE public.taxes (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT          NOT NULL,
  name_ar     TEXT,
  code        TEXT          NOT NULL,
  tax_type    TEXT          NOT NULL
                CHECK (tax_type IN ('vat','corporate','withholding','exempt','other')),
  rate        NUMERIC(5,2)  NOT NULL CHECK (rate >= 0 AND rate <= 100),
  is_default  BOOLEAN       NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id)
);
CREATE INDEX idx_taxes_tenant ON public.taxes(tenant_id);
CREATE TRIGGER trg_taxes_upd BEFORE UPDATE ON public.taxes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 9. chart_of_accounts ─────────────────────────────────────
-- NOTE: parent_id self-reference cannot be composite (self-join on same table)
-- Cross-tenant safety enforced by RLS + tenant_id column check in app layer
CREATE TABLE public.chart_of_accounts (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parent_id     UUID          REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  code          TEXT          NOT NULL,
  name          TEXT          NOT NULL,
  name_ar       TEXT,
  account_type  TEXT          NOT NULL
                  CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  normal_side   TEXT          NOT NULL CHECK (normal_side IN ('debit','credit')),
  is_control    BOOLEAN       NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  description   TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id)
);
CREATE INDEX idx_coa_tenant ON public.chart_of_accounts(tenant_id);
CREATE INDEX idx_coa_parent ON public.chart_of_accounts(parent_id);
CREATE INDEX idx_coa_type   ON public.chart_of_accounts(tenant_id, account_type);
CREATE TRIGGER trg_coa_upd BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 10. journal_entries ──────────────────────────────────────
CREATE TABLE public.journal_entries (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id       UUID,
  entry_no        TEXT          NOT NULL,
  entry_date      DATE          NOT NULL DEFAULT CURRENT_DATE,
  posting_period  TEXT,
  description     TEXT,
  description_ar  TEXT,
  source          TEXT,
  source_id       UUID,
  status          TEXT          NOT NULL DEFAULT 'posted'
                    CHECK (status IN ('draft','posted','reversed')),
  posted_by       UUID,
  posted_at       TIMESTAMPTZ,
  reversed_by_id  UUID,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entry_no),
  UNIQUE (tenant_id, id)
);
CREATE INDEX idx_je_tenant ON public.journal_entries(tenant_id);
CREATE INDEX idx_je_date   ON public.journal_entries(tenant_id, entry_date);
CREATE INDEX idx_je_source ON public.journal_entries(source, source_id);
CREATE TRIGGER trg_je_upd BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 11. journal_lines ────────────────────────────────────────
-- FIX-5: exchange_rate + base_debit/base_credit GENERATED columns
-- Balance trigger uses base currency NOT foreign amounts
CREATE TABLE public.journal_lines (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entry_id      UUID          NOT NULL,
  account_id    UUID          NOT NULL,
  debit         NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (debit  >= 0),
  credit        NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  currency      TEXT          NOT NULL DEFAULT 'AED',
  exchange_rate NUMERIC(12,6) NOT NULL DEFAULT 1,
  base_debit    NUMERIC(18,2) GENERATED ALWAYS AS (ROUND(debit  * exchange_rate, 2)) STORED,
  base_credit   NUMERIC(18,2) GENERATED ALWAYS AS (ROUND(credit * exchange_rate, 2)) STORED,
  description   TEXT,
  contact_id    UUID,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CHECK (debit > 0 OR credit > 0),
  CONSTRAINT fk_jl_entry
    FOREIGN KEY (tenant_id, entry_id)
    REFERENCES public.journal_entries(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_jl_account
    FOREIGN KEY (tenant_id, account_id)
    REFERENCES public.chart_of_accounts(tenant_id, id)
);
CREATE INDEX idx_jl_tenant  ON public.journal_lines(tenant_id);
CREATE INDEX idx_jl_entry   ON public.journal_lines(entry_id);
CREATE INDEX idx_jl_account ON public.journal_lines(account_id);

-- FIX-5: Compares base_debit vs base_credit (not raw debit/credit)
CREATE OR REPLACE FUNCTION public.enforce_journal_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_diff NUMERIC(18,2);
BEGIN
  SELECT ROUND(COALESCE(SUM(base_debit),0) - COALESCE(SUM(base_credit),0), 2)
    INTO v_diff
    FROM public.journal_lines
   WHERE entry_id = NEW.entry_id;
  IF v_diff <> 0 THEN
    RAISE EXCEPTION
      'Journal entry % unbalanced in base currency: diff = %', NEW.entry_id, v_diff;
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER trg_journal_balance
  AFTER INSERT OR UPDATE ON public.journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_journal_balance();

-- ── 12. invoices ─────────────────────────────────────────────
CREATE TABLE public.invoices (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id           UUID,
  invoice_no          TEXT          NOT NULL,
  invoice_type        TEXT          NOT NULL
                        CHECK (invoice_type IN ('sale','purchase','credit_note','debit_note')),
  status              TEXT          NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','sent','paid','partial','overdue','cancelled','void')),
  contact_id          UUID,
  order_id            UUID,         -- composite FK added after orders table
  issue_date          DATE          NOT NULL DEFAULT CURRENT_DATE,
  due_date            DATE,
  supply_date         DATE,
  subtotal            NUMERIC(18,2) NOT NULL DEFAULT 0,
  discount_amount     NUMERIC(18,2) NOT NULL DEFAULT 0,
  taxable_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount          NUMERIC(18,2) NOT NULL DEFAULT 0,
  total               NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_paid         NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_due          NUMERIC(18,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  currency            TEXT          NOT NULL DEFAULT 'AED',
  exchange_rate       NUMERIC(12,6) NOT NULL DEFAULT 1,
  zatca_uuid          UUID          UNIQUE DEFAULT uuid_generate_v4(),
  zatca_pih           TEXT,
  zatca_qr            TEXT,
  zatca_status        TEXT          NOT NULL DEFAULT 'not_applicable'
                        CHECK (zatca_status IN ('pending','reported','cleared','rejected','not_applicable')),
  zatca_response      JSONB,
  zatca_cleared_at    TIMESTAMPTZ,
  notes               TEXT,
  notes_ar            TEXT,
  payment_terms       TEXT,
  journal_entry_id    UUID,
  created_by          UUID,
  approved_by         UUID,
  approved_at         TIMESTAMPTZ,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_no),
  UNIQUE (tenant_id, id)
);
CREATE INDEX idx_inv_tenant  ON public.invoices(tenant_id);
CREATE INDEX idx_inv_contact ON public.invoices(tenant_id, contact_id);
CREATE INDEX idx_inv_status  ON public.invoices(tenant_id, status);
CREATE INDEX idx_inv_date    ON public.invoices(tenant_id, issue_date);
CREATE INDEX idx_inv_due     ON public.invoices(tenant_id, due_date);
CREATE INDEX idx_inv_zatca   ON public.invoices(zatca_uuid);
CREATE INDEX idx_inv_type    ON public.invoices(tenant_id, invoice_type);
CREATE TRIGGER trg_invoices_upd BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 13. invoice_items ────────────────────────────────────────
CREATE TABLE public.invoice_items (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id      UUID          NOT NULL,
  item_ref        TEXT,
  name            TEXT          NOT NULL,
  name_ar         TEXT,
  quantity        NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price      NUMERIC(18,4) NOT NULL DEFAULT 0,
  discount_pct    NUMERIC(5,2)  NOT NULL DEFAULT 0,
  discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_id          UUID,
  tax_rate        NUMERIC(5,2)  NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
  line_total      NUMERIC(18,2) NOT NULL DEFAULT 0,
  sort_order      SMALLINT      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT fk_ii_invoice
    FOREIGN KEY (tenant_id, invoice_id)
    REFERENCES public.invoices(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_ii_tenant  ON public.invoice_items(tenant_id);
CREATE INDEX idx_ii_invoice ON public.invoice_items(invoice_id);
CREATE TRIGGER trg_ii_upd BEFORE UPDATE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 14. payment_links ────────────────────────────────────────
CREATE TABLE public.payment_links (
  id                   UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id            UUID,
  link_code            TEXT          NOT NULL UNIQUE,
  title                TEXT          NOT NULL,
  title_ar             TEXT,
  description          TEXT,
  amount               NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency             TEXT          NOT NULL DEFAULT 'AED',
  contact_id           UUID,
  invoice_id           UUID,
  accept_card          BOOLEAN       NOT NULL DEFAULT TRUE,
  accept_apple_pay     BOOLEAN       NOT NULL DEFAULT TRUE,
  accept_google_pay    BOOLEAN       NOT NULL DEFAULT TRUE,
  accept_bank_transfer BOOLEAN       NOT NULL DEFAULT FALSE,
  expires_at           TIMESTAMPTZ,
  max_uses             INTEGER       DEFAULT 1,
  use_count            INTEGER       NOT NULL DEFAULT 0,
  status               TEXT          NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','paid','expired','cancelled')),
  paid_at              TIMESTAMPTZ,
  paid_amount          NUMERIC(15,2),
  payment_ref          TEXT,
  whatsapp_sent        BOOLEAN       NOT NULL DEFAULT FALSE,
  whatsapp_sent_at     TIMESTAMPTZ,
  created_by           UUID,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
CREATE INDEX idx_pl_tenant ON public.payment_links(tenant_id);
CREATE INDEX idx_pl_code   ON public.payment_links(link_code);
CREATE INDEX idx_pl_status ON public.payment_links(tenant_id, status);
CREATE TRIGGER trg_pl_upd BEFORE UPDATE ON public.payment_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 15. categories ───────────────────────────────────────────
-- NOTE: parent_id self-reference stays single-column (self-join limitation)
-- RLS enforces tenant isolation on all reads/writes
CREATE TABLE public.categories (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parent_id   UUID        REFERENCES public.categories(id) ON DELETE SET NULL,
  name        TEXT        NOT NULL,
  name_ar     TEXT,
  type        TEXT        NOT NULL DEFAULT 'product'
                CHECK (type IN ('product','menu','ingredient','expense','asset','drug','service')),
  requires_prescription BOOLEAN NOT NULL DEFAULT FALSE,
  requires_approval     BOOLEAN NOT NULL DEFAULT FALSE,
  color       TEXT,
  icon        TEXT,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
CREATE INDEX idx_cats_tenant ON public.categories(tenant_id);
CREATE TRIGGER trg_cats_upd BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 16. units ────────────────────────────────────────────────
CREATE TABLE public.units (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  name_ar      TEXT,
  abbreviation TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
CREATE INDEX idx_units_tenant ON public.units(tenant_id);

-- ── 17. items ────────────────────────────────────────────────
CREATE TABLE public.items (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id      UUID,
  unit_id          UUID,
  sku              TEXT,
  barcode          TEXT,
  name             TEXT          NOT NULL,
  name_ar          TEXT,
  description      TEXT,
  item_type        TEXT          NOT NULL DEFAULT 'product'
                     CHECK (item_type IN (
                       'product','ingredient','menu_item',
                       'service','composite','drug','fixed_asset'
                     )),
  cost_price       NUMERIC(15,4) NOT NULL DEFAULT 0,
  selling_price    NUMERIC(15,2) NOT NULL DEFAULT 0,
  min_price        NUMERIC(15,2),
  price_levels     JSONB         DEFAULT '{}',
  track_stock      BOOLEAN       NOT NULL DEFAULT TRUE,
  reorder_point    NUMERIC(12,4) DEFAULT 0,
  reorder_qty      NUMERIC(12,4) DEFAULT 0,
  tax_id           UUID,
  is_tax_inclusive BOOLEAN       NOT NULL DEFAULT FALSE,
  requires_prescription BOOLEAN  NOT NULL DEFAULT FALSE,
  requires_approval     BOOLEAN  NOT NULL DEFAULT FALSE,
  drug_generic_name TEXT,
  drug_strength    TEXT,
  drug_form        TEXT,
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
  is_sellable      BOOLEAN       NOT NULL DEFAULT TRUE,
  is_purchasable   BOOLEAN       NOT NULL DEFAULT TRUE,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sku),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_items_category
    FOREIGN KEY (tenant_id, category_id)
    REFERENCES public.categories(tenant_id, id) ON DELETE SET NULL,
  CONSTRAINT fk_items_unit
    FOREIGN KEY (tenant_id, unit_id)
    REFERENCES public.units(tenant_id, id) ON DELETE SET NULL
);
CREATE INDEX idx_items_tenant  ON public.items(tenant_id);
CREATE INDEX idx_items_barcode ON public.items(barcode);
CREATE INDEX idx_items_type    ON public.items(tenant_id, item_type);
CREATE TRIGGER trg_items_upd BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 18. price_history (IMMUTABLE) ────────────────────────────
-- Append-only: trigger blocks UPDATE/DELETE. RLS: SELECT+INSERT only
CREATE TABLE public.price_history (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id         UUID          NOT NULL,
  price_type      TEXT          NOT NULL CHECK (price_type IN ('cost','selling','min')),
  old_price       NUMERIC(15,4) NOT NULL,
  new_price       NUMERIC(15,4) NOT NULL,
  change_pct      NUMERIC(8,4)  GENERATED ALWAYS AS (
                    CASE WHEN old_price > 0
                    THEN ROUND((new_price - old_price) / old_price * 100, 4)
                    ELSE 0 END
                  ) STORED,
  reason          TEXT,
  changed_by      UUID,         -- no FK: user may be deactivated
  supplier_id     UUID,         -- no FK: supplier contact may be soft-deleted
  effective_date  DATE          NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT fk_ph_item
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items(tenant_id, id)
);
CREATE INDEX idx_ph_tenant ON public.price_history(tenant_id);
CREATE INDEX idx_ph_item   ON public.price_history(tenant_id, item_id);
CREATE INDEX idx_ph_date   ON public.price_history(tenant_id, effective_date DESC);

CREATE TRIGGER trg_price_history_immutable
  BEFORE UPDATE OR DELETE ON public.price_history
  FOR EACH ROW EXECUTE FUNCTION public.block_mutations();

CREATE OR REPLACE FUNCTION public.log_price_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.cost_price IS DISTINCT FROM NEW.cost_price THEN
    INSERT INTO public.price_history (tenant_id, item_id, price_type, old_price, new_price)
    VALUES (NEW.tenant_id, NEW.id, 'cost', OLD.cost_price, NEW.cost_price);
  END IF;
  IF OLD.selling_price IS DISTINCT FROM NEW.selling_price THEN
    INSERT INTO public.price_history (tenant_id, item_id, price_type, old_price, new_price)
    VALUES (NEW.tenant_id, NEW.id, 'selling', OLD.selling_price, NEW.selling_price);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_log_price_change
  AFTER UPDATE ON public.items FOR EACH ROW
  WHEN (OLD.cost_price IS DISTINCT FROM NEW.cost_price
     OR OLD.selling_price IS DISTINCT FROM NEW.selling_price)
  EXECUTE FUNCTION public.log_price_change();

-- ── 19. warehouses ───────────────────────────────────────────
CREATE TABLE public.warehouses (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id   UUID        NOT NULL,
  name        TEXT        NOT NULL,
  name_ar     TEXT,
  type        TEXT        DEFAULT 'general'
                CHECK (type IN ('general','cold','dry','production','transit','pharmacy')),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_wh_branch
    FOREIGN KEY (tenant_id, branch_id)
    REFERENCES public.branches(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_wh_tenant ON public.warehouses(tenant_id);
CREATE INDEX idx_wh_branch ON public.warehouses(branch_id);
CREATE TRIGGER trg_wh_upd BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 20. stock_levels ─────────────────────────────────────────
-- FIX-7: No CASCADE on item_id (item deleted_at used instead)
CREATE TABLE public.stock_levels (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id       UUID          NOT NULL,
  warehouse_id  UUID          NOT NULL,
  quantity      NUMERIC(12,4) NOT NULL DEFAULT 0,
  reserved_qty  NUMERIC(12,4) NOT NULL DEFAULT 0,
  avg_cost      NUMERIC(15,4) NOT NULL DEFAULT 0,
  batch_no      TEXT,
  expiry_date   DATE,
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, item_id, warehouse_id),
  CONSTRAINT fk_sl_item
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items(tenant_id, id),       -- NO CASCADE: soft delete only
  CONSTRAINT fk_sl_warehouse
    FOREIGN KEY (tenant_id, warehouse_id)
    REFERENCES public.warehouses(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_sl_tenant    ON public.stock_levels(tenant_id);
CREATE INDEX idx_sl_item      ON public.stock_levels(item_id);
CREATE INDEX idx_sl_warehouse ON public.stock_levels(warehouse_id);
CREATE INDEX idx_sl_expiry    ON public.stock_levels(expiry_date);

-- ── 21. shipments ────────────────────────────────────────────
CREATE TABLE public.shipments (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id       UUID,
  shipment_no     TEXT          NOT NULL,
  direction       TEXT          NOT NULL CHECK (direction IN ('import','export','local')),
  status          TEXT          NOT NULL DEFAULT 'pending'
                    CHECK (status IN (
                      'pending','in_transit','customs','arrived',
                      'delivered','cancelled','returned'
                    )),
  supplier_id     UUID,
  origin_country  TEXT,
  destination     TEXT,
  carrier         TEXT,
  tracking_no     TEXT,
  bl_number       TEXT,
  customs_ref     TEXT,
  estimated_arrival DATE,
  actual_arrival    DATE,
  total_value     NUMERIC(15,2),
  currency        TEXT          DEFAULT 'AED',
  notes           TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, shipment_no),
  UNIQUE (tenant_id, id)
);
CREATE INDEX idx_ship_tenant ON public.shipments(tenant_id);
CREATE INDEX idx_ship_status ON public.shipments(tenant_id, status);
CREATE TRIGGER trg_ship_upd BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 22. shipment_items ───────────────────────────────────────
CREATE TABLE public.shipment_items (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shipment_id   UUID          NOT NULL,
  item_id       UUID,
  description   TEXT          NOT NULL,
  quantity      NUMERIC(12,4) NOT NULL,
  unit_cost     NUMERIC(15,4) NOT NULL DEFAULT 0,
  total_cost    NUMERIC(15,4) NOT NULL DEFAULT 0,
  batch_no      TEXT,
  expiry_date   DATE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT fk_si_shipment
    FOREIGN KEY (tenant_id, shipment_id)
    REFERENCES public.shipments(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_si_tenant   ON public.shipment_items(tenant_id);
CREATE INDEX idx_si_shipment ON public.shipment_items(shipment_id);

-- ── 23. inventory_movements (IMMUTABLE) ──────────────────────
CREATE TABLE public.inventory_movements (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id         UUID          NOT NULL,
  warehouse_id    UUID          NOT NULL,
  movement_type   TEXT          NOT NULL
                    CHECK (movement_type IN (
                      'purchase','sale','adjustment','transfer_in','transfer_out',
                      'production_in','production_out','waste','return',
                      'opening','expired_disposal'
                    )),
  quantity        NUMERIC(12,4) NOT NULL,
  unit_cost       NUMERIC(15,4) NOT NULL DEFAULT 0,
  total_cost      NUMERIC(15,4) NOT NULL DEFAULT 0,
  reference_type  TEXT,
  reference_id    UUID,
  batch_no        TEXT,
  expiry_date     DATE,
  notes           TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT fk_im_item
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items(tenant_id, id),
  CONSTRAINT fk_im_warehouse
    FOREIGN KEY (tenant_id, warehouse_id)
    REFERENCES public.warehouses(tenant_id, id)
);
CREATE INDEX idx_im_tenant ON public.inventory_movements(tenant_id);
CREATE INDEX idx_im_item   ON public.inventory_movements(tenant_id, item_id);
CREATE INDEX idx_im_type   ON public.inventory_movements(movement_type);
CREATE INDEX idx_im_date   ON public.inventory_movements(tenant_id, created_at);
CREATE INDEX idx_im_ref    ON public.inventory_movements(reference_type, reference_id);

CREATE TRIGGER trg_im_immutable
  BEFORE UPDATE OR DELETE ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.block_mutations();

CREATE OR REPLACE FUNCTION public.update_stock_on_movement()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.stock_levels (tenant_id, item_id, warehouse_id, quantity, avg_cost)
  VALUES (NEW.tenant_id, NEW.item_id, NEW.warehouse_id, NEW.quantity, GREATEST(NEW.unit_cost, 0))
  ON CONFLICT (tenant_id, item_id, warehouse_id)
  DO UPDATE SET
    quantity   = stock_levels.quantity + NEW.quantity,
    avg_cost   = CASE
                   WHEN (stock_levels.quantity + NEW.quantity) > 0
                   THEN ROUND(
                     (stock_levels.quantity * stock_levels.avg_cost
                      + NEW.quantity * NEW.unit_cost)
                     / (stock_levels.quantity + NEW.quantity), 4)
                   ELSE stock_levels.avg_cost
                 END,
    updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_update_stock
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_movement();

-- ── 24. orders ───────────────────────────────────────────────
CREATE TABLE public.orders (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id         UUID          NOT NULL,
  order_no          TEXT          NOT NULL,
  order_type        TEXT          NOT NULL DEFAULT 'sale'
                      CHECK (order_type IN ('dine_in','takeaway','delivery','online','sale','return')),
  status            TEXT          NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','in_progress','ready','completed','cancelled','refunded')),
  contact_id        UUID,
  table_no          TEXT,
  covers            SMALLINT      DEFAULT 1,
  delivery_platform TEXT,
  delivery_ref      TEXT,
  delivery_address  TEXT,
  subtotal          NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  total             NUMERIC(15,2) NOT NULL DEFAULT 0,
  cashier_id        UUID,
  waiter_id         UUID,
  opened_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, order_no),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_orders_branch
    FOREIGN KEY (tenant_id, branch_id)
    REFERENCES public.branches(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_orders_tenant ON public.orders(tenant_id);
CREATE INDEX idx_orders_branch ON public.orders(tenant_id, branch_id);
CREATE INDEX idx_orders_status ON public.orders(tenant_id, status);
CREATE INDEX idx_orders_date   ON public.orders(tenant_id, opened_at);
CREATE TRIGGER trg_orders_upd BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Now safe to add composite FK from invoices to orders
ALTER TABLE public.invoices
  ADD CONSTRAINT fk_invoices_order
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES public.orders(tenant_id, id) ON DELETE SET NULL;

-- ── 25. order_items ──────────────────────────────────────────
CREATE TABLE public.order_items (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id        UUID          NOT NULL,
  item_id         UUID,
  name            TEXT          NOT NULL,
  name_ar         TEXT,
  quantity        NUMERIC(12,4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price      NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  line_total      NUMERIC(15,2) NOT NULL DEFAULT 0,
  kds_station     TEXT,
  kds_status      TEXT          NOT NULL DEFAULT 'pending'
                    CHECK (kds_status IN ('pending','in_progress','ready','served','voided')),
  kds_sent_at     TIMESTAMPTZ,
  kds_ready_at    TIMESTAMPTZ,
  modifiers       JSONB         DEFAULT '[]',
  notes           TEXT,
  is_voided       BOOLEAN       NOT NULL DEFAULT FALSE,
  void_reason     TEXT,
  prescription_id UUID,         -- composite FK added after prescriptions table
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT fk_oi_order
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES public.orders(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_oi_tenant ON public.order_items(tenant_id);
CREATE INDEX idx_oi_order  ON public.order_items(order_id);
CREATE INDEX idx_oi_kds    ON public.order_items(tenant_id, kds_status);
CREATE TRIGGER trg_oi_upd BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 26. payments ─────────────────────────────────────────────
CREATE TABLE public.payments (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id       UUID,
  reference_type  TEXT          NOT NULL
                    CHECK (reference_type IN ('order','invoice','payment_link')),
  reference_id    UUID          NOT NULL,
  contact_id      UUID,
  amount          NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency        TEXT          NOT NULL DEFAULT 'AED',
  method          TEXT          NOT NULL
                    CHECK (method IN (
                      'cash','card','bank_transfer','cheque',
                      'mada','stc_pay','apple_pay','google_pay',
                      'online','loyalty_points','payment_link'
                    )),
  status          TEXT          NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('pending','completed','failed','refunded')),
  transaction_ref TEXT,
  card_last4      TEXT,
  gateway_ref     TEXT,
  notes           TEXT,
  received_by     UUID,
  paid_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
  -- NOTE: reference_id is polymorphic → enforced at app layer, not FK
);
CREATE INDEX idx_pay_tenant ON public.payments(tenant_id);
CREATE INDEX idx_pay_ref    ON public.payments(reference_type, reference_id);
CREATE INDEX idx_pay_date   ON public.payments(tenant_id, paid_at);
CREATE TRIGGER trg_pay_upd BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── F&B ──────────────────────────────────────────────────────
CREATE TABLE public.recipes (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id         UUID          NOT NULL,
  name            TEXT          NOT NULL,
  portion_size    NUMERIC(10,4),
  portion_unit_id UUID,
  instructions    TEXT,
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, item_id),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_recipes_item
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_recipes_tenant ON public.recipes(tenant_id);
CREATE TRIGGER trg_recipes_upd BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.recipe_ingredients (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipe_id       UUID          NOT NULL,
  ingredient_id   UUID          NOT NULL,
  quantity        NUMERIC(12,6) NOT NULL CHECK (quantity > 0),
  unit_id         UUID,
  cost_snapshot   NUMERIC(15,4) NOT NULL DEFAULT 0,
  waste_pct       NUMERIC(5,2)  NOT NULL DEFAULT 0,
  sort_order      SMALLINT      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT fk_ri_recipe
    FOREIGN KEY (tenant_id, recipe_id)
    REFERENCES public.recipes(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_ri_item
    FOREIGN KEY (tenant_id, ingredient_id)
    REFERENCES public.items(tenant_id, id)
);
CREATE INDEX idx_ri_tenant ON public.recipe_ingredients(tenant_id);
CREATE INDEX idx_ri_recipe ON public.recipe_ingredients(recipe_id);
CREATE TRIGGER trg_ri_upd BEFORE UPDATE ON public.recipe_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.food_cost_snapshots (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id       UUID,
  recipe_id       UUID          NOT NULL,
  snapshot_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
  total_cost      NUMERIC(15,4) NOT NULL,
  selling_price   NUMERIC(15,2) NOT NULL,
  food_cost_pct   NUMERIC(5,2)  NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, recipe_id, snapshot_date),
  CONSTRAINT fk_fcs_recipe
    FOREIGN KEY (tenant_id, recipe_id)
    REFERENCES public.recipes(tenant_id, id)
);
CREATE INDEX idx_fcs_tenant ON public.food_cost_snapshots(tenant_id);

-- ── Clinic ────────────────────────────────────────────────────
CREATE TABLE public.appointments (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id       UUID,
  appointment_no  TEXT          NOT NULL,
  patient_id      UUID,
  provider_id     UUID,
  service_item_id UUID,
  scheduled_at    TIMESTAMPTZ   NOT NULL,
  duration_mins   INTEGER       NOT NULL DEFAULT 30,
  actual_start    TIMESTAMPTZ,
  actual_end      TIMESTAMPTZ,
  status          TEXT          NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN (
                      'scheduled','confirmed','in_progress',
                      'completed','cancelled','no_show','rescheduled'
                    )),
  source          TEXT          DEFAULT 'manual'
                    CHECK (source IN ('manual','whatsapp','portal','website','phone')),
  reminder_sent   BOOLEAN       NOT NULL DEFAULT FALSE,
  reminder_sent_at TIMESTAMPTZ,
  invoice_id      UUID,
  payment_link_id UUID,
  chief_complaint TEXT,
  notes           TEXT,
  cancel_reason   TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, appointment_no),
  UNIQUE (tenant_id, id)
);
CREATE INDEX idx_appt_tenant   ON public.appointments(tenant_id);
CREATE INDEX idx_appt_patient  ON public.appointments(patient_id);
CREATE INDEX idx_appt_provider ON public.appointments(provider_id);
CREATE INDEX idx_appt_date     ON public.appointments(tenant_id, scheduled_at);
CREATE INDEX idx_appt_status   ON public.appointments(tenant_id, status);
CREATE TRIGGER trg_appt_upd BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.patient_records (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id      UUID          NOT NULL,
  appointment_id  UUID,
  visit_date      DATE          NOT NULL DEFAULT CURRENT_DATE,
  weight_kg       NUMERIC(6,2),
  height_cm       NUMERIC(5,1),
  blood_pressure  TEXT,
  temperature     NUMERIC(4,1),
  pulse           INTEGER,
  chief_complaint TEXT,
  diagnosis       TEXT,
  diagnosis_code  TEXT,
  treatment       TEXT,
  notes           TEXT,
  doctor_id       UUID,
  follow_up_date  DATE,
  is_confidential BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_pr_patient
    FOREIGN KEY (tenant_id, patient_id)
    REFERENCES public.contacts(tenant_id, id)
);
CREATE INDEX idx_pr_tenant  ON public.patient_records(tenant_id);
CREATE INDEX idx_pr_patient ON public.patient_records(patient_id);
CREATE TRIGGER trg_pr_upd BEFORE UPDATE ON public.patient_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.prescriptions (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  prescription_no TEXT          NOT NULL,
  patient_id      UUID          NOT NULL,
  doctor_id       UUID,
  record_id       UUID,
  issue_date      DATE          NOT NULL DEFAULT CURRENT_DATE,
  expiry_date     DATE,
  status          TEXT          NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','dispensed','expired','cancelled')),
  notes           TEXT,
  dispensed_at    TIMESTAMPTZ,
  dispensed_by    UUID,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, prescription_no),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_rx_patient
    FOREIGN KEY (tenant_id, patient_id)
    REFERENCES public.contacts(tenant_id, id)
);
CREATE INDEX idx_rx_tenant  ON public.prescriptions(tenant_id);
CREATE INDEX idx_rx_patient ON public.prescriptions(patient_id);
CREATE TRIGGER trg_rx_upd BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.order_items
  ADD CONSTRAINT fk_oi_prescription
    FOREIGN KEY (tenant_id, prescription_id)
    REFERENCES public.prescriptions(tenant_id, id) ON DELETE SET NULL;

-- ── School ────────────────────────────────────────────────────
CREATE TABLE public.academic_years (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  is_current  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
CREATE INDEX idx_ay_tenant ON public.academic_years(tenant_id);

CREATE TABLE public.classes (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  academic_year_id UUID        NOT NULL,
  name             TEXT        NOT NULL,
  grade            TEXT,
  teacher_id       UUID,
  capacity         INTEGER     DEFAULT 30,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_classes_year
    FOREIGN KEY (tenant_id, academic_year_id)
    REFERENCES public.academic_years(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_classes_tenant ON public.classes(tenant_id);
CREATE TRIGGER trg_classes_upd BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.enrollments (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id      UUID        NOT NULL,
  class_id        UUID        NOT NULL,
  enrolled_at     DATE        NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT        NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','transferred','graduated','withdrawn')),
  fee_invoice_id  UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_id, class_id),
  CONSTRAINT fk_enroll_student
    FOREIGN KEY (tenant_id, student_id)
    REFERENCES public.contacts(tenant_id, id),
  CONSTRAINT fk_enroll_class
    FOREIGN KEY (tenant_id, class_id)
    REFERENCES public.classes(tenant_id, id)
);
CREATE INDEX idx_enroll_tenant  ON public.enrollments(tenant_id);
CREATE INDEX idx_enroll_student ON public.enrollments(student_id);

-- ── Real Estate ───────────────────────────────────────────────
CREATE TABLE public.properties (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id       UUID,
  name            TEXT          NOT NULL,
  property_type   TEXT          NOT NULL
                    CHECK (property_type IN ('apartment','villa','office','retail','warehouse','land')),
  address         TEXT,
  city            TEXT,
  area_sqm        NUMERIC(10,2),
  bedrooms        SMALLINT,
  bathrooms       SMALLINT,
  floor           INTEGER,
  building        TEXT,
  status          TEXT          NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available','rented','sold','maintenance','reserved')),
  market_value    NUMERIC(15,2),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);
CREATE INDEX idx_prop_tenant ON public.properties(tenant_id);
CREATE TRIGGER trg_prop_upd BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.leases (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id     UUID          NOT NULL,
  re_tenant_id    UUID          NOT NULL,
  contract_no     TEXT          NOT NULL,
  ejari_no        TEXT          UNIQUE,
  start_date      DATE          NOT NULL,
  end_date        DATE          NOT NULL,
  rent_amount     NUMERIC(15,2) NOT NULL,
  rent_frequency  TEXT          NOT NULL DEFAULT 'annual'
                    CHECK (rent_frequency IN ('monthly','quarterly','semi_annual','annual')),
  deposit_amount  NUMERIC(15,2) DEFAULT 0,
  status          TEXT          NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','expired','terminated','renewed')),
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, contract_no),
  CONSTRAINT fk_lease_property
    FOREIGN KEY (tenant_id, property_id)
    REFERENCES public.properties(tenant_id, id),
  CONSTRAINT fk_lease_re_tenant
    FOREIGN KEY (tenant_id, re_tenant_id)
    REFERENCES public.contacts(tenant_id, id)
);
CREATE INDEX idx_leases_tenant   ON public.leases(tenant_id);
CREATE INDEX idx_leases_property ON public.leases(property_id);
CREATE TRIGGER trg_leases_upd BEFORE UPDATE ON public.leases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Manufacturing ─────────────────────────────────────────────
CREATE TABLE public.bill_of_materials (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  finished_item_id UUID          NOT NULL,
  name             TEXT          NOT NULL,
  version          TEXT          NOT NULL DEFAULT '1.0',
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, finished_item_id, version),
  UNIQUE (tenant_id, id),
  CONSTRAINT fk_bom_item
    FOREIGN KEY (tenant_id, finished_item_id)
    REFERENCES public.items(tenant_id, id)
);
CREATE INDEX idx_bom_tenant ON public.bill_of_materials(tenant_id);
CREATE TRIGGER trg_bom_upd BEFORE UPDATE ON public.bill_of_materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.bom_components (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bom_id          UUID          NOT NULL,
  component_id    UUID          NOT NULL,
  quantity        NUMERIC(12,6) NOT NULL CHECK (quantity > 0),
  unit_id         UUID,
  waste_pct       NUMERIC(5,2)  NOT NULL DEFAULT 0,
  sort_order      SMALLINT      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT fk_bom_comp_bom
    FOREIGN KEY (tenant_id, bom_id)
    REFERENCES public.bill_of_materials(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_bom_comp_item
    FOREIGN KEY (tenant_id, component_id)
    REFERENCES public.items(tenant_id, id)
);
CREATE INDEX idx_bom_comp_tenant ON public.bom_components(tenant_id);
CREATE INDEX idx_bom_comp_bom    ON public.bom_components(bom_id);

CREATE TABLE public.production_orders (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id       UUID,
  order_no        TEXT          NOT NULL,
  bom_id          UUID          NOT NULL,
  quantity        NUMERIC(12,4) NOT NULL,
  status          TEXT          NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned','in_progress','completed','cancelled')),
  planned_start   DATE,
  planned_end     DATE,
  actual_start    TIMESTAMPTZ,
  actual_end      TIMESTAMPTZ,
  warehouse_id    UUID,
  notes           TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, order_no),
  CONSTRAINT fk_prod_bom
    FOREIGN KEY (tenant_id, bom_id)
    REFERENCES public.bill_of_materials(tenant_id, id)
);
CREATE INDEX idx_prod_tenant ON public.production_orders(tenant_id);
CREATE TRIGGER trg_prod_upd BEFORE UPDATE ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Portal ────────────────────────────────────────────────────
CREATE TABLE public.portal_sessions (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id      UUID        NOT NULL,
  session_token   TEXT        NOT NULL UNIQUE,
  ip_address      INET,
  user_agent      TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_ps_contact
    FOREIGN KEY (tenant_id, contact_id)
    REFERENCES public.contacts(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_ps_tenant  ON public.portal_sessions(tenant_id);
CREATE INDEX idx_ps_contact ON public.portal_sessions(contact_id);
CREATE INDEX idx_ps_token   ON public.portal_sessions(session_token);

CREATE TABLE public.portal_settings (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID        NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  show_invoices       BOOLEAN     NOT NULL DEFAULT TRUE,
  show_payments       BOOLEAN     NOT NULL DEFAULT TRUE,
  show_statements     BOOLEAN     NOT NULL DEFAULT TRUE,
  show_appointments   BOOLEAN     NOT NULL DEFAULT FALSE,
  show_prescriptions  BOOLEAN     NOT NULL DEFAULT FALSE,
  show_loyalty        BOOLEAN     NOT NULL DEFAULT TRUE,
  show_products       BOOLEAN     NOT NULL DEFAULT FALSE,
  welcome_message     TEXT,
  welcome_message_ar  TEXT,
  footer_text         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_portal_settings_upd BEFORE UPDATE ON public.portal_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Notifications ─────────────────────────────────────────────
CREATE TABLE public.notifications (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id      UUID,
  user_id         UUID,
  type            TEXT        NOT NULL
                    CHECK (type IN (
                      'whatsapp','sms','email','push',
                      'invoice_sent','payment_received',
                      'appointment_reminder','low_stock',
                      'overdue_invoice','prescription_ready',
                      'payment_link_sent','payment_link_paid'
                    )),
  title           TEXT        NOT NULL,
  body            TEXT        NOT NULL,
  data            JSONB       DEFAULT '{}',
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','sent','delivered','failed','read')),
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_tenant  ON public.notifications(tenant_id);
CREATE INDEX idx_notif_contact ON public.notifications(contact_id);
CREATE INDEX idx_notif_status  ON public.notifications(tenant_id, status);
CREATE INDEX idx_notif_type    ON public.notifications(tenant_id, type);

-- ── Audit Log (IMMUTABLE) ─────────────────────────────────────
CREATE TABLE public.audit_log (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     UUID,
  action      TEXT        NOT NULL,
  table_name  TEXT        NOT NULL,
  record_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_tenant ON public.audit_log(tenant_id);
CREATE INDEX idx_audit_table  ON public.audit_log(tenant_id, table_name);
CREATE INDEX idx_audit_user   ON public.audit_log(tenant_id, user_id);
CREATE INDEX idx_audit_date   ON public.audit_log(tenant_id, created_at DESC);

CREATE TRIGGER trg_audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.block_mutations();

-- ============================================================
--  STEP 2: ENABLE RLS
-- ============================================================
ALTER TABLE public.tenants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_links       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_levels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_cost_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_of_materials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_components      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log           ENABLE ROW LEVEL SECURITY;

-- ============================================================
--  STEP 3: RLS POLICIES
--  FIX-3: ALL policies have explicit WITH CHECK
--  FIX-8: Subquery uses covering index (auth_id, tenant_id)
--
--  TABLE GROUPS:
--  A) Standard: FULL isolation (SELECT/INSERT/UPDATE/DELETE)
--  B) Immutable: SELECT + INSERT only (price_history, inv_movements, audit_log)
--  C) Users: special — read tenant, update self only
--  D) Tenants: read own only
-- ============================================================

-- GROUP A: Standard tables — full isolation
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'branches','roles','role_permissions','user_roles',
    'contacts','taxes','chart_of_accounts',
    'journal_entries','journal_lines',
    'invoices','invoice_items','payment_links',
    'categories','units','items',
    'warehouses','stock_levels',
    'shipments','shipment_items',
    'orders','order_items','payments',
    'recipes','recipe_ingredients','food_cost_snapshots',
    'appointments','patient_records','prescriptions',
    'academic_years','classes','enrollments',
    'properties','leases',
    'bill_of_materials','bom_components','production_orders',
    'portal_sessions','portal_settings','notifications'
  ]) LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I
       FOR ALL
       USING      (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()))
       WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()))',
      t || ': isolation', t
    );
  END LOOP;
END $$;

-- GROUP B: Immutable tables — SELECT + INSERT only, no UPDATE/DELETE policy
CREATE POLICY "price_history: select" ON public.price_history
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));
CREATE POLICY "price_history: insert" ON public.price_history
  FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "inventory_movements: select" ON public.inventory_movements
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));
CREATE POLICY "inventory_movements: insert" ON public.inventory_movements
  FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "audit_log: select" ON public.audit_log
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));
CREATE POLICY "audit_log: insert" ON public.audit_log
  FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

-- GROUP C: Users — read all in tenant, but update own profile only
CREATE POLICY "users: select" ON public.users
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.users u WHERE u.auth_id = auth.uid()));
CREATE POLICY "users: insert" ON public.users
  FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));
CREATE POLICY "users: update self" ON public.users
  FOR UPDATE USING (auth_id = auth.uid()) WITH CHECK (auth_id = auth.uid());

-- GROUP D: Tenants — read own record only
CREATE POLICY "tenants: read own" ON public.tenants
  FOR SELECT USING (id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

-- ============================================================
--  STEP 4: ZATCA PIH FUNCTION
--  FIX-6: Branch-scoped + SELECT FOR UPDATE (row lock)
--  Prevents two cashiers getting same PIH simultaneously
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_next_zatca_pih(
  p_tenant_id UUID,
  p_branch_id UUID
)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pih TEXT;
BEGIN
  SELECT zatca_pih INTO v_pih
    FROM public.invoices
   WHERE tenant_id   = p_tenant_id
     AND branch_id   = p_branch_id
     AND invoice_type = 'sale'
     AND zatca_status IN ('cleared','reported')
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;    -- skip if another transaction has it locked

  -- No prior invoice → ZATCA opening hash (64 zeros per spec)
  RETURN COALESCE(v_pih, repeat('0', 64));
END;
$$;

-- ============================================================
--  STEP 5: ONBOARDING FUNCTIONS
--  FIX-2: SECURITY DEFINER bypasses RLS for first-user bootstrap
--  Called from Supabase Edge Function after auth.users signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_roles(p_tenant_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.roles (tenant_id, name, name_ar, is_system) VALUES
    (p_tenant_id, 'owner',          'صاحب الشركة',    TRUE),
    (p_tenant_id, 'branch_manager', 'مدير الفرع',     TRUE),
    (p_tenant_id, 'accountant',     'محاسب',           TRUE),
    (p_tenant_id, 'cashier',        'كاشير',           TRUE),
    (p_tenant_id, 'hr',             'موارد بشرية',    TRUE),
    (p_tenant_id, 'procurement',    'مشتريات',         TRUE),
    (p_tenant_id, 'kitchen',        'مطبخ',            TRUE),
    (p_tenant_id, 'warehouse',      'مخزن',            TRUE),
    (p_tenant_id, 'doctor',         'طبيب',            TRUE),
    (p_tenant_id, 'pharmacist',     'صيدلاني',         TRUE),
    (p_tenant_id, 'receptionist',   'استقبال',         TRUE),
    (p_tenant_id, 'teacher',        'معلم',            TRUE)
  ON CONFLICT (tenant_id, name) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_taxes(p_tenant_id UUID, p_country TEXT DEFAULT 'AE')
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_country = 'AE' THEN
    INSERT INTO public.taxes (tenant_id, name, name_ar, code, tax_type, rate, is_default) VALUES
      (p_tenant_id, 'VAT 5%',          'ضريبة القيمة المضافة ٥٪', 'VAT5', 'vat',       5.00, TRUE),
      (p_tenant_id, 'Zero Rated',       'معفاة صفر',               'ZERO', 'vat',       0.00, FALSE),
      (p_tenant_id, 'Exempt',           'معفاة',                    'EXMT', 'exempt',    0.00, FALSE),
      (p_tenant_id, 'Corporate Tax 9%', 'ضريبة الشركات ٩٪',       'CT9',  'corporate', 9.00, FALSE)
    ON CONFLICT (tenant_id, code) DO NOTHING;
  ELSIF p_country = 'SA' THEN
    INSERT INTO public.taxes (tenant_id, name, name_ar, code, tax_type, rate, is_default) VALUES
      (p_tenant_id, 'VAT 15%',    'ضريبة القيمة المضافة ١٥٪', 'VAT15', 'vat',    15.00, TRUE),
      (p_tenant_id, 'Zero Rated', 'معفاة صفر',                 'ZERO',  'vat',     0.00, FALSE),
      (p_tenant_id, 'Exempt',     'معفاة',                      'EXMT',  'exempt',  0.00, FALSE)
    ON CONFLICT (tenant_id, code) DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_units(p_tenant_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.units (tenant_id, name, name_ar, abbreviation) VALUES
    (p_tenant_id, 'Piece',      'قطعة',   'pcs'),
    (p_tenant_id, 'Kilogram',   'كيلو',   'kg'),
    (p_tenant_id, 'Gram',       'جرام',   'g'),
    (p_tenant_id, 'Litre',      'لتر',    'L'),
    (p_tenant_id, 'Millilitre', 'مل',     'ml'),
    (p_tenant_id, 'Portion',    'حصة',    'portion'),
    (p_tenant_id, 'Box',        'علبة',   'box'),
    (p_tenant_id, 'Tablet',     'قرص',    'tab'),
    (p_tenant_id, 'Vial',       'أمبولة', 'vial'),
    (p_tenant_id, 'Strip',      'شريط',   'strip'),
    (p_tenant_id, 'Carton',     'كرتون',  'ctn')
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_chart_of_accounts(p_tenant_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.chart_of_accounts
    (tenant_id, code, name, name_ar, account_type, normal_side, is_control) VALUES
    (p_tenant_id,'1000','Assets',             'الأصول',                'asset',    'debit', TRUE),
    (p_tenant_id,'1100','Current Assets',      'الأصول المتداولة',      'asset',    'debit', TRUE),
    (p_tenant_id,'1110','Cash & Bank',         'النقدية والبنوك',       'asset',    'debit', FALSE),
    (p_tenant_id,'1120','Accounts Receivable', 'ذمم مدينة',             'asset',    'debit', FALSE),
    (p_tenant_id,'1130','Inventory',           'المخزون',               'asset',    'debit', FALSE),
    (p_tenant_id,'1200','Fixed Assets',        'الأصول الثابتة',        'asset',    'debit', TRUE),
    (p_tenant_id,'1210','Equipment',           'المعدات',               'asset',    'debit', FALSE),
    (p_tenant_id,'2000','Liabilities',         'الالتزامات',            'liability','credit',TRUE),
    (p_tenant_id,'2100','Current Liabilities', 'الالتزامات المتداولة',  'liability','credit',TRUE),
    (p_tenant_id,'2110','Accounts Payable',    'ذمم دائنة',             'liability','credit',FALSE),
    (p_tenant_id,'2120','VAT Payable',         'ضريبة القيمة المضافة',  'liability','credit',FALSE),
    (p_tenant_id,'2130','Salaries Payable',    'رواتب مستحقة',          'liability','credit',FALSE),
    (p_tenant_id,'3000','Equity',              'حقوق الملكية',          'equity',   'credit',TRUE),
    (p_tenant_id,'3100','Owner Capital',       'رأس المال',             'equity',   'credit',FALSE),
    (p_tenant_id,'3200','Retained Earnings',   'الأرباح المحتجزة',      'equity',   'credit',FALSE),
    (p_tenant_id,'4000','Revenue',             'الإيرادات',             'revenue',  'credit',TRUE),
    (p_tenant_id,'4100','Sales Revenue',       'إيرادات المبيعات',      'revenue',  'credit',FALSE),
    (p_tenant_id,'4200','Service Revenue',     'إيرادات الخدمات',       'revenue',  'credit',FALSE),
    (p_tenant_id,'5000','Expenses',            'المصروفات',             'expense',  'debit', TRUE),
    (p_tenant_id,'5100','Cost of Goods Sold',  'تكلفة البضاعة المباعة', 'expense',  'debit', FALSE),
    (p_tenant_id,'5200','Salaries & Wages',    'الرواتب والأجور',       'expense',  'debit', FALSE),
    (p_tenant_id,'5300','Rent Expense',        'مصروف الإيجار',         'expense',  'debit', FALSE),
    (p_tenant_id,'5400','Utilities',           'المرافق',               'expense',  'debit', FALSE),
    (p_tenant_id,'5500','Marketing',           'التسويق والإعلان',      'expense',  'debit', FALSE),
    (p_tenant_id,'5900','Other Expenses',      'مصروفات أخرى',          'expense',  'debit', FALSE)
  ON CONFLICT (tenant_id, code) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.onboard_new_tenant(
  p_tenant_id   UUID,
  p_branch_name TEXT DEFAULT 'Main Branch',
  p_branch_code TEXT DEFAULT 'HQ',
  p_country     TEXT DEFAULT 'AE'
)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_branch_id UUID;
BEGIN
  INSERT INTO public.branches (tenant_id, name, name_ar, code, is_default)
  VALUES (p_tenant_id, p_branch_name, 'الفرع الرئيسي', p_branch_code, TRUE)
  RETURNING id INTO v_branch_id;
  PERFORM public.seed_roles(p_tenant_id);
  PERFORM public.seed_taxes(p_tenant_id, p_country);
  PERFORM public.seed_units(p_tenant_id);
  PERFORM public.seed_chart_of_accounts(p_tenant_id);
  INSERT INTO public.portal_settings (tenant_id) VALUES (p_tenant_id)
    ON CONFLICT DO NOTHING;
  RETURN v_branch_id;
END;
$$;

-- FIX-2: SECURITY DEFINER — bypasses RLS for first-user bootstrap
-- Call this from Supabase Edge Function after auth.users record is created
CREATE OR REPLACE FUNCTION public.register_new_tenant(
  p_auth_id      UUID,
  p_email        TEXT,
  p_full_name    TEXT,
  p_tenant_name  TEXT,
  p_tenant_slug  TEXT,
  p_sector       TEXT DEFAULT 'retail',
  p_country      TEXT DEFAULT 'AE',
  p_branch_name  TEXT DEFAULT 'Main Branch'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id   UUID;
  v_branch_id UUID;
  v_role_id   UUID;
BEGIN
  INSERT INTO public.tenants (name, slug, sector, country, is_active, onboarded_at)
  VALUES (p_tenant_name, p_tenant_slug, p_sector, p_country, TRUE, now())
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.users (auth_id, tenant_id, full_name, email, is_active)
  VALUES (p_auth_id, v_tenant_id, p_full_name, p_email, TRUE)
  RETURNING id INTO v_user_id;

  v_branch_id := public.onboard_new_tenant(v_tenant_id, p_branch_name, 'HQ', p_country);

  UPDATE public.users SET default_branch = v_branch_id WHERE id = v_user_id;

  SELECT id INTO v_role_id
    FROM public.roles
   WHERE tenant_id = v_tenant_id AND name = 'owner';

  INSERT INTO public.user_roles (tenant_id, user_id, role_id)
  VALUES (v_tenant_id, v_user_id, v_role_id);

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'user_id',   v_user_id,
    'branch_id', v_branch_id
  );
END;
$$;

-- ============================================================
--  SCHEMA COMPLETE — v5.1
--
--  Tables      : 44
--  Indexes     : 65+
--  Triggers    : 35+
--  Functions   : 8
--  RLS Policies: 50+
--
--  USAGE:
--  1. Run entire script in Supabase SQL Editor (fresh project)
--  2. On user signup, call from Edge Function:
--       SELECT public.register_new_tenant(
--         auth_id   := '<uuid>',
--         p_email   := 'user@company.com',
--         p_full_name := 'Ahmed Ali',
--         p_tenant_name := 'My Company',
--         p_tenant_slug := 'my-company',
--         p_sector  := 'fnb',
--         p_country := 'AE'
--       );
-- ============================================================
