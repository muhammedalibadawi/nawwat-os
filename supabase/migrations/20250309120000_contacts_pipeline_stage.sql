-- CRM Pipeline (Kanban) optional columns
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS pipeline_stage text DEFAULT 'new';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS expected_value numeric(15,2);
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_contact_at timestamptz;

COMMENT ON COLUMN public.contacts.pipeline_stage IS 'Kanban: new | qualified | proposal | negotiation | closed';
