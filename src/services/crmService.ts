/**
 * Single operational CRM data path for the NawwatOS frontend: Supabase `contacts` + pipeline fields.
 * (Backend `lead_tracking` / FastAPI CRM router is out of scope for this client path.)
 */
import { supabase } from '@/lib/supabase';
import type { CrmContactRow, CrmContactType, CrmPipelineStageId } from '@/types/crm';
import { CRM_CONTACT_LIST_COLUMNS } from '@/types/crm';

export async function fetchCrmContacts(tenantId: string): Promise<CrmContactRow[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select(CRM_CONTACT_LIST_COLUMNS)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CrmContactRow[];
}

export interface SaveCrmContactPayload {
  tenantId: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: CrmContactType;
}

export async function insertCrmContact(payload: SaveCrmContactPayload): Promise<void> {
  const { error } = await supabase.from('contacts').insert({
    tenant_id: payload.tenantId,
    name: payload.name.trim(),
    email: payload.email,
    phone: payload.phone,
    type: payload.type,
  });
  if (error) throw error;
}

export async function updateCrmContact(
  tenantId: string,
  contactId: string,
  payload: SaveCrmContactPayload
): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .update({
      name: payload.name.trim(),
      email: payload.email,
      phone: payload.phone,
      type: payload.type,
    })
    .eq('id', contactId)
    .eq('tenant_id', tenantId);
  if (error) throw error;
}

export interface InsertCrmLeadOpportunityPayload {
  tenantId: string;
  name: string;
  email: string | null;
  stage: CrmPipelineStageId;
  expectedValue: number | null;
}

export async function insertCrmLeadOpportunity(payload: InsertCrmLeadOpportunityPayload): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from('contacts').insert({
    tenant_id: payload.tenantId,
    name: payload.name.trim(),
    email: payload.email,
    type: 'lead',
    pipeline_stage: payload.stage,
    expected_value: payload.expectedValue,
    last_contact_at: now,
  });
  if (error) throw error;
}

export async function updateContactPipelineStage(
  tenantId: string,
  contactId: string,
  stage: CrmPipelineStageId
): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .update({
      pipeline_stage: stage,
      last_contact_at: new Date().toISOString(),
    })
    .eq('id', contactId)
    .eq('tenant_id', tenantId);
  if (error) throw error;
}

export async function deleteCrmContact(tenantId: string, contactId: string): Promise<void> {
  const { error } = await supabase.from('contacts').delete().eq('id', contactId).eq('tenant_id', tenantId);
  if (error) throw error;
}
