/**
 * CommerceOS - Channel Revenue service layer.
 */
import { supabase } from '@/lib/supabase';
import {
  normalizeCommercialContractTermConfigForPersist,
  normalizeCommercialContractTermConfigForRead,
} from '@/lib/commerceContractTermConfig';
import { buildPricingSimulatorPreview } from '@/services/commerceExpectedPayout';
import type {
  ChannelAccountRecord,
  ChannelPriceBook,
  ChannelPriceBookDetail,
  ChannelPriceBookLine,
  ChannelPriceBookLineRow,
  ChannelPricingRule,
  ChannelPricingRuleRow,
  ChannelPriceBookRow,
  CommercialContractListItem,
  CommercialContractRow,
  CommercialContractVersionRow,
  CommercialContractVersionTermRow,
  CommercialContractVersionWithTerms,
  CreateCommercialContractInput,
  CreateCommercialContractVersionInput,
  PricingSimulatorContext,
  PricingSimulatorInput,
  PricingSimulatorPreview,
} from '@/types/commerceFoundation';

async function loadCommercialContractVersionTerms(
  tenantId: string,
  versionIds: string[]
): Promise<Map<string, CommercialContractVersionTermRow[]>> {
  if (versionIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('commercial_contract_version_terms')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('contract_version_id', versionIds)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;

  const byVersionId = new Map<string, CommercialContractVersionTermRow[]>();
  for (const row of (data ?? []) as CommercialContractVersionTermRow[]) {
    const existing = byVersionId.get(row.contract_version_id) ?? [];
    existing.push({
      ...row,
      term_config: normalizeCommercialContractTermConfigForRead(row.term_group, row.term_config),
    });
    byVersionId.set(row.contract_version_id, existing);
  }

  return byVersionId;
}

async function hydrateCommercialContractVersions(
  tenantId: string,
  versions: CommercialContractVersionRow[]
): Promise<CommercialContractVersionWithTerms[]> {
  const versionIds = versions.map((version) => version.id);
  const termsByVersionId = await loadCommercialContractVersionTerms(tenantId, versionIds);

  return versions.map((version) => ({
    ...version,
    terms: termsByVersionId.get(version.id) ?? [],
  }));
}

/** Rows for `commercial_contract_version_create_and_set_current.p_terms` (JSON array). */
function normalizeVersionTermsForRpcPayload(input: CreateCommercialContractVersionInput['terms']) {
  return (input ?? []).map((term, index) => {
    const label = term.label.trim();
    if (!label) {
      throw new Error('Commercial contract term label is required.');
    }

    const rawCode = term.term_code.trim();
    const termCode = rawCode || `${term.term_group}_${index + 1}`;

    return {
      term_group: term.term_group,
      term_code: termCode,
      label,
      summary: term.summary?.trim() || null,
      term_config: normalizeCommercialContractTermConfigForPersist(term.term_group, term.term_config ?? {}),
      sort_order: Math.max(0, term.sort_order ?? index),
      is_active: term.is_active ?? true,
    };
  });
}

async function loadChannelAccountNames(
  tenantId: string,
  channelAccountIds: string[]
): Promise<Map<string, string>> {
  if (channelAccountIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('channel_accounts')
    .select('id,channel_name')
    .eq('tenant_id', tenantId)
    .in('id', channelAccountIds);
  if (error) throw error;

  return new Map(
    ((data ?? []) as Array<{ id: string; channel_name: string }>).map((row) => [row.id, row.channel_name])
  );
}

async function hydrateChannelPriceBookLines(
  tenantId: string,
  lineRows: ChannelPriceBookLineRow[]
): Promise<ChannelPriceBookLine[]> {
  if (lineRows.length === 0) {
    return [];
  }

  const canonicalSkuIds = Array.from(new Set(lineRows.map((line) => line.canonical_sku_id)));
  const { data: canonicalRows, error: canonicalErr } = await supabase
    .from('canonical_skus')
    .select('id,item_id,sku')
    .eq('tenant_id', tenantId)
    .in('id', canonicalSkuIds);
  if (canonicalErr) throw canonicalErr;

  const canonicalById = new Map(
    ((canonicalRows ?? []) as Array<{ id: string; item_id: string; sku: string }>).map((row) => [row.id, row])
  );

  const itemIds = Array.from(new Set((canonicalRows ?? []).map((row) => row.item_id as string).filter(Boolean)));
  let itemById = new Map<
    string,
    { id: string; name: string | null; name_ar: string | null; selling_price: number | null; cost_price: number | null; sku: string | null }
  >();

  if (itemIds.length > 0) {
    const { data: itemRows, error: itemErr } = await supabase
      .from('items')
      .select('id,name,name_ar,selling_price,cost_price,sku')
      .eq('tenant_id', tenantId)
      .in('id', itemIds);
    if (itemErr) throw itemErr;

    itemById = new Map(
      (
        (itemRows ?? []) as Array<{
          id: string;
          name: string | null;
          name_ar: string | null;
          selling_price: number | null;
          cost_price: number | null;
          sku: string | null;
        }>
      ).map((row) => [row.id, row])
    );
  }

  return lineRows.map((line) => {
    const canonical = canonicalById.get(line.canonical_sku_id);
    const item = canonical?.item_id ? itemById.get(canonical.item_id) : undefined;

    return {
      ...line,
      item_id: canonical?.item_id ?? null,
      sku: canonical?.sku ?? item?.sku ?? null,
      item_name: item?.name ?? null,
      item_name_ar: item?.name_ar ?? null,
      base_selling_price: item?.selling_price ?? null,
      base_cost_price: item?.cost_price ?? null,
    };
  });
}

async function hydrateChannelPricingRules(
  tenantId: string,
  ruleRows: ChannelPricingRuleRow[]
): Promise<ChannelPricingRule[]> {
  if (ruleRows.length === 0) {
    return [];
  }

  const canonicalSkuIds = Array.from(
    new Set(ruleRows.map((rule) => rule.canonical_sku_id).filter((id): id is string => Boolean(id)))
  );

  let canonicalById = new Map<string, { id: string; item_id: string; sku: string }>();
  let itemById = new Map<string, { id: string; name: string | null; name_ar: string | null }>();

  if (canonicalSkuIds.length > 0) {
    const { data: canonicalRows, error: canonicalErr } = await supabase
      .from('canonical_skus')
      .select('id,item_id,sku')
      .eq('tenant_id', tenantId)
      .in('id', canonicalSkuIds);
    if (canonicalErr) throw canonicalErr;

    canonicalById = new Map(
      ((canonicalRows ?? []) as Array<{ id: string; item_id: string; sku: string }>).map((row) => [row.id, row])
    );

    const itemIds = Array.from(new Set((canonicalRows ?? []).map((row) => row.item_id as string).filter(Boolean)));
    if (itemIds.length > 0) {
      const { data: itemRows, error: itemErr } = await supabase
        .from('items')
        .select('id,name,name_ar')
        .eq('tenant_id', tenantId)
        .in('id', itemIds);
      if (itemErr) throw itemErr;

      itemById = new Map(
        ((itemRows ?? []) as Array<{ id: string; name: string | null; name_ar: string | null }>).map((row) => [row.id, row])
      );
    }
  }

  return ruleRows.map((rule) => {
    const canonical = rule.canonical_sku_id ? canonicalById.get(rule.canonical_sku_id) : undefined;
    const item = canonical?.item_id ? itemById.get(canonical.item_id) : undefined;

    return {
      ...rule,
      scope: rule.canonical_sku_id ? 'sku' : 'price_book',
      sku: canonical?.sku ?? null,
      item_id: canonical?.item_id ?? null,
      item_name: item?.name ?? null,
      item_name_ar: item?.name_ar ?? null,
    };
  });
}

async function listChannelAccountsForTenant(tenantId?: string): Promise<ChannelAccountRecord[]> {
  let query = supabase.from('channel_accounts').select('*').is('deleted_at', null);
  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChannelAccountRecord[];
}

export async function listChannelAccounts(): Promise<ChannelAccountRecord[]> {
  return listChannelAccountsForTenant();
}

export async function loadPricingSimulatorContext(tenantId: string): Promise<PricingSimulatorContext> {
  const [channel_accounts, contracts, price_books] = await Promise.all([
    listChannelAccountsForTenant(tenantId),
    listCommercialContracts(tenantId),
    listChannelPriceBooks(tenantId),
  ]);

  return {
    channel_accounts,
    contracts,
    price_books,
  };
}

export async function listCommercialContracts(tenantId: string): Promise<CommercialContractListItem[]> {
  const { data: contracts, error: cErr } = await supabase
    .from('commercial_contracts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (cErr) throw cErr;

  const rows = (contracts ?? []) as CommercialContractRow[];
  const versionIds = rows.map((row) => row.current_version_id).filter((id): id is string => Boolean(id));
  if (versionIds.length === 0) {
    return rows.map((row) => ({ ...row, current_version: null }));
  }

  const { data: versions, error: vErr } = await supabase
    .from('commercial_contract_versions')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('id', versionIds);
  if (vErr) throw vErr;

  const hydratedVersions = await hydrateCommercialContractVersions(tenantId, (versions ?? []) as CommercialContractVersionRow[]);
  const byId = new Map(hydratedVersions.map((version) => [version.id, version]));

  return rows.map((row) => ({
    ...row,
    current_version: row.current_version_id ? byId.get(row.current_version_id) ?? null : null,
  }));
}

export async function getCommercialContractById(
  tenantId: string,
  contractId: string
): Promise<{ contract: CommercialContractRow; versions: CommercialContractVersionWithTerms[] } | null> {
  const { data: contract, error: cErr } = await supabase
    .from('commercial_contracts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', contractId)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!contract) return null;

  const { data: versions, error: vErr } = await supabase
    .from('commercial_contract_versions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('contract_id', contractId)
    .order('version_number', { ascending: true });
  if (vErr) throw vErr;

  return {
    contract: contract as CommercialContractRow,
    versions: await hydrateCommercialContractVersions(tenantId, (versions ?? []) as CommercialContractVersionRow[]),
  };
}

export async function createCommercialContract(
  tenantId: string,
  input: CreateCommercialContractInput
): Promise<{ id: string }> {
  const payload = {
    tenant_id: tenantId,
    contract_code: input.contract_code.trim(),
    name: input.name.trim(),
    channel_account_id: input.channel_account_id ?? null,
    counterparty_contact_id: input.counterparty_contact_id ?? null,
    status: input.status ?? 'draft',
    effective_from: input.effective_from ?? null,
    effective_to: input.effective_to ?? null,
    summary: input.summary?.trim() || null,
    notes: input.notes?.trim() || null,
  };

  const { data, error } = await supabase.from('commercial_contracts').insert(payload).select('id').single();
  if (error) throw error;
  return { id: (data as { id: string }).id };
}

export async function createCommercialContractVersion(
  _tenantId: string,
  input: CreateCommercialContractVersionInput
): Promise<{ id: string }> {
  if (input.set_as_current) {
    const p_terms = normalizeVersionTermsForRpcPayload(input.terms);
    const { data: rpcVersionId, error: rpcErr } = await supabase.rpc(
      'commercial_contract_version_create_and_set_current',
      {
        p_contract_id: input.contract_id,
        p_promote_version_id: null,
        p_version_number: input.version_number ?? null,
        p_commission_summary: input.commission_summary?.trim() ?? null,
        p_payment_fee_summary: input.payment_fee_summary?.trim() ?? null,
        p_shipping_responsibility_summary: input.shipping_responsibility_summary?.trim() ?? null,
        p_return_expiry_summary: input.return_expiry_summary?.trim() ?? null,
        p_settlement_terms_summary: input.settlement_terms_summary?.trim() ?? null,
        p_terms,
      }
    );
    if (rpcErr) throw rpcErr;

    return { id: rpcVersionId as string };
  }

  const p_terms = normalizeVersionTermsForRpcPayload(input.terms);
  const { data: draftVersionId, error: draftErr } = await supabase.rpc(
    'commercial_contract_version_create_draft_with_terms',
    {
      p_contract_id: input.contract_id,
      p_version_number: input.version_number ?? null,
      p_commission_summary: input.commission_summary?.trim() ?? null,
      p_payment_fee_summary: input.payment_fee_summary?.trim() ?? null,
      p_shipping_responsibility_summary: input.shipping_responsibility_summary?.trim() ?? null,
      p_return_expiry_summary: input.return_expiry_summary?.trim() ?? null,
      p_settlement_terms_summary: input.settlement_terms_summary?.trim() ?? null,
      p_terms,
    }
  );
  if (draftErr) throw draftErr;

  return { id: draftVersionId as string };
}

/**
 * Marks an existing version as the contract’s current version (atomic DB path).
 * Tenant + role are enforced inside `commercial_contract_version_create_and_set_current` via JWT.
 */
export async function promoteCommercialContractVersionToCurrent(
  contractId: string,
  versionId: string
): Promise<{ id: string }> {
  const { data: rpcVersionId, error: rpcErr } = await supabase.rpc(
    'commercial_contract_version_create_and_set_current',
    {
      p_contract_id: contractId,
      p_promote_version_id: versionId,
      p_version_number: null,
      p_commission_summary: null,
      p_payment_fee_summary: null,
      p_shipping_responsibility_summary: null,
      p_return_expiry_summary: null,
      p_settlement_terms_summary: null,
      p_terms: [],
    }
  );
  if (rpcErr) throw rpcErr;
  return { id: rpcVersionId as string };
}

export async function listChannelPriceBooks(_tenantId: string): Promise<ChannelPriceBook[]> {
  const { data: books, error: bookErr } = await supabase
    .from('channel_price_books')
    .select('*')
    .eq('tenant_id', _tenantId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (bookErr) throw bookErr;

  const rows = (books ?? []) as ChannelPriceBookRow[];
  const bookIds = rows.map((row) => row.id);
  const channelNames = await loadChannelAccountNames(
    _tenantId,
    Array.from(new Set(rows.map((row) => row.channel_account_id)))
  );

  let lineCountByBookId = new Map<string, number>();
  if (bookIds.length > 0) {
    const { data: lineRows, error: lineErr } = await supabase
      .from('channel_price_book_lines')
      .select('price_book_id')
      .eq('tenant_id', _tenantId)
      .in('price_book_id', bookIds);
    if (lineErr) throw lineErr;

    lineCountByBookId = new Map<string, number>();
    for (const row of (lineRows ?? []) as Array<{ price_book_id: string }>) {
      lineCountByBookId.set(row.price_book_id, (lineCountByBookId.get(row.price_book_id) ?? 0) + 1);
    }
  }

  return rows.map((row) => ({
    ...row,
    channel_name: channelNames.get(row.channel_account_id) ?? null,
    line_count: lineCountByBookId.get(row.id) ?? 0,
  }));
}

export async function getChannelPriceBookById(
  tenantId: string,
  priceBookId: string
): Promise<ChannelPriceBookDetail | null> {
  const { data: book, error: bookErr } = await supabase
    .from('channel_price_books')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', priceBookId)
    .maybeSingle();
  if (bookErr) throw bookErr;
  if (!book) return null;

  const { data: lineRows, error: lineErr } = await supabase
    .from('channel_price_book_lines')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('price_book_id', priceBookId)
    .order('created_at', { ascending: true });
  if (lineErr) throw lineErr;

  const lines = await hydrateChannelPriceBookLines(tenantId, (lineRows ?? []) as ChannelPriceBookLineRow[]);
  const channelNames = await loadChannelAccountNames(tenantId, [(book as ChannelPriceBookRow).channel_account_id]);

  return {
    ...(book as ChannelPriceBookRow),
    channel_name: channelNames.get((book as ChannelPriceBookRow).channel_account_id) ?? null,
    line_count: lines.length,
    lines,
  };
}

export async function listChannelPricingRules(tenantId: string): Promise<ChannelPricingRule[]> {
  const { data, error } = await supabase
    .from('channel_pricing_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('price_book_id', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;

  return hydrateChannelPricingRules(tenantId, (data ?? []) as ChannelPricingRuleRow[]);
}

export async function getChannelPricingRulesByPriceBook(
  tenantId: string,
  priceBookId: string
): Promise<ChannelPricingRule[]> {
  const { data, error } = await supabase
    .from('channel_pricing_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('price_book_id', priceBookId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;

  return hydrateChannelPricingRules(tenantId, (data ?? []) as ChannelPricingRuleRow[]);
}

export async function getPricingSimulatorPreview(
  tenantId: string,
  input: PricingSimulatorInput
): Promise<PricingSimulatorPreview | null> {
  if (!input.contract_id || !input.price_book_id || !input.canonical_sku_id) {
    return null;
  }

  const [contracts, priceBook, pricingRules] = await Promise.all([
    listCommercialContracts(tenantId),
    getChannelPriceBookById(tenantId, input.price_book_id),
    getChannelPricingRulesByPriceBook(tenantId, input.price_book_id),
  ]);

  const contract = contracts.find((row) => row.id === input.contract_id) ?? null;
  const currentVersion = contract?.current_version ?? null;
  const line = priceBook?.lines.find((row) => row.canonical_sku_id === input.canonical_sku_id) ?? null;

  if (!contract || !currentVersion || !priceBook || !line) {
    return null;
  }

  return buildPricingSimulatorPreview({
    contract,
    currentVersion,
    priceBook,
    line,
    pricingRules,
    input,
  });

}

export function describeMarginEngineStatus(): { ready: boolean; note: string } {
  return {
    ready: false,
    note: 'دفاتر الأسعار وقواعد التسعير أصبحت طبقة بيانات فعلية، ويوجد الآن simulator scaffold للقراءة والمعاينة فقط دون engine نهائي.',
  };
}
