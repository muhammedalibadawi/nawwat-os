/**
 * CRM domain types aligned with the current `contacts` table + pipeline columns.
 * Future first-class entities (accounts, deals) should extend this file, not scatter ad-hoc types in screens.
 */

export type CrmContactType = 'customer' | 'supplier' | 'lead' | 'employee' | 'other';

/** Kanban stage ids — must match DB convention in contacts.pipeline_stage (see migration comment). */
export type CrmPipelineStageId = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'closed';

export interface CrmContactRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: CrmContactType;
  notes: string | null;
  created_at: string;
  tenant_id: string;
  pipeline_stage?: string | null;
  expected_value?: number | null;
  last_contact_at?: string | null;
}

/** View-model: a lead row participating in the sales pipeline (stored as contacts.type === 'lead'). */
export type CrmPipelineLeadRow = CrmContactRow & { type: 'lead' };

export const CRM_CONTACT_LIST_COLUMNS =
  'id,name,email,phone,type,created_at,notes,tenant_id,pipeline_stage,expected_value,last_contact_at' as const;

export const DEFAULT_PIPELINE_STAGES: readonly { id: CrmPipelineStageId; label: string }[] = [
  { id: 'new', label: 'جديد' },
  { id: 'qualified', label: 'مؤهل' },
  { id: 'proposal', label: 'عرض سعر' },
  { id: 'negotiation', label: 'تفاوض' },
  { id: 'closed', label: 'مغلق' },
] as const;
