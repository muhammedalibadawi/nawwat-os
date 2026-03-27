import { supabase } from '@/lib/supabase';
import type {
  PharmacyAdjustBatchInput,
  PharmacyBatch,
  PharmacyBranchOption,
  PharmacyDispensePrescriptionInput,
  PharmacyInsuranceClaim,
  PharmacyInventoryFilters,
  PharmacyMedicationHistoryEntry,
  PharmacyOtcSaleInput,
  PharmacyPatientOption,
  PharmacyPosSnapshot,
  PharmacyPrescriptionDetails,
  PharmacyPrescriptionDraftInput,
  PharmacyPrescriptionFilters,
  PharmacyPrescriptionItem,
  PharmacyPrescriptionSummary,
  PharmacyReceiveBatchLineInput,
  PharmacyReportSnapshot,
  PharmacyReportsFilters,
  PharmacySupplierOption,
  PharmacySupplierReturnInput,
} from '@/types/pharmacy';
import { groupAmountByMonth, normalizePharmacyError, safeNumber } from '@/utils/pharmacy';

type UnknownRow = Record<string, unknown>;

function asRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord(value: unknown): UnknownRow {
  return typeof value === 'object' && value !== null ? (value as UnknownRow) : {};
}

function valueString(row: UnknownRow, key: string): string | undefined {
  const value = row[key];
  return typeof value === 'string' ? value : undefined;
}

function valueBoolean(row: UnknownRow, key: string, fallback = false): boolean {
  const value = row[key];
  return typeof value === 'boolean' ? value : fallback;
}

function valueNumber(row: UnknownRow, key: string, fallback = 0): number {
  return safeNumber(row[key], fallback);
}

function parseBranch(row: UnknownRow): PharmacyBranchOption {
  return {
    id: valueString(row, 'id') ?? '',
    name: valueString(row, 'name') ?? 'فرع',
    name_ar: valueString(row, 'name_ar') ?? null,
  };
}

function parsePatient(row: UnknownRow): PharmacyPatientOption {
  return {
    id: valueString(row, 'id') ?? '',
    name: valueString(row, 'name') ?? 'مريض',
    email: valueString(row, 'email') ?? null,
    phone: valueString(row, 'phone') ?? valueString(row, 'mobile') ?? null,
    policy_number: valueString(row, 'policy_number') ?? null,
  };
}

function parseSupplier(row: UnknownRow): PharmacySupplierOption {
  return {
    id: valueString(row, 'id') ?? '',
    name: valueString(row, 'name') ?? 'مورد',
  };
}

/**
 * مسار موحّد لتحميل `pharma_products` مع حقول العرض من `items`.
 *
 * ممنوع في أي استعلام: `select('*, items:item_id(...)')` أو أي تضمين متداخل يعتمد
 * على عمود `item_id` فقط — لأن الـ FK مركّب `(tenant_id, item_id) -> items`.
 *
 * الصحيح دائمًا: `from('pharma_products').select('*')` ثم استدعاء هذه الدالة.
 */
const ITEMS_SELECT_FOR_PHARMACY = 'id, sku, barcode, name, name_ar';

async function hydratePharmaProductsWithItems(
  tenantId: string,
  productRows: UnknownRow[]
): Promise<Array<ReturnType<typeof parseProduct>>> {
  const itemIds = Array.from(
    new Set(productRows.map((row) => valueString(row, 'item_id') ?? '').filter(Boolean))
  );
  const itemsById = new Map<string, UnknownRow>();
  if (itemIds.length > 0) {
    const { data, error } = await supabase
      .from('items')
      .select(ITEMS_SELECT_FOR_PHARMACY)
      .eq('tenant_id', tenantId)
      .in('id', itemIds);
    if (error) throw error;
    asRows<UnknownRow>(data).forEach((itemRow) => {
      const id = valueString(itemRow, 'id');
      if (id) itemsById.set(id, itemRow);
    });
  }
  return productRows.map((row) => {
    const itemId = valueString(row, 'item_id') ?? '';
    const itemRow = itemsById.get(itemId) ?? {};
    return parseProduct({
      ...row,
      sku: valueString(itemRow, 'sku') ?? valueString(row, 'sku'),
      item_barcode: valueString(itemRow, 'barcode'),
      item_name: valueString(itemRow, 'name'),
      item_name_ar: valueString(itemRow, 'name_ar'),
    });
  });
}

function parseProduct(row: UnknownRow) {
  return {
    id: valueString(row, 'id') ?? '',
    tenant_id: valueString(row, 'tenant_id') ?? '',
    item_id: valueString(row, 'item_id') ?? '',
    sku: valueString(row, 'sku') ?? null,
    item_barcode: valueString(row, 'item_barcode') ?? null,
    item_name: valueString(row, 'item_name') ?? null,
    item_name_ar: valueString(row, 'item_name_ar') ?? null,
    generic_name: valueString(row, 'generic_name') ?? null,
    brand_name: valueString(row, 'brand_name') ?? null,
    strength: valueString(row, 'strength') ?? null,
    dosage_form: valueString(row, 'dosage_form') ?? null,
    route: valueString(row, 'route') ?? null,
    manufacturer: valueString(row, 'manufacturer') ?? null,
    requires_prescription: valueBoolean(row, 'requires_prescription'),
    controlled_drug: valueBoolean(row, 'controlled_drug'),
    refrigerated: valueBoolean(row, 'refrigerated'),
    narcotic_schedule: valueString(row, 'narcotic_schedule') ?? null,
    tax_profile_id: valueString(row, 'tax_profile_id') ?? null,
    is_otc: valueBoolean(row, 'is_otc'),
    is_active: valueBoolean(row, 'is_active', true),
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? {},
  };
}

function parseBatch(row: UnknownRow): PharmacyBatch {
  return {
    id: valueString(row, 'id') ?? '',
    tenant_id: valueString(row, 'tenant_id') ?? '',
    branch_id: valueString(row, 'branch_id') ?? '',
    branch_name: valueString(row, 'branch_name') ?? null,
    product_id: valueString(row, 'product_id') ?? '',
    item_id: valueString(row, 'item_id') ?? '',
    sku: valueString(row, 'sku') ?? null,
    item_barcode: valueString(row, 'item_barcode') ?? null,
    item_name: valueString(row, 'item_name') ?? null,
    item_name_ar: valueString(row, 'item_name_ar') ?? null,
    brand_name: valueString(row, 'brand_name') ?? null,
    generic_name: valueString(row, 'generic_name') ?? null,
    strength: valueString(row, 'strength') ?? null,
    dosage_form: valueString(row, 'dosage_form') ?? null,
    batch_number: valueString(row, 'batch_number') ?? '',
    barcode: valueString(row, 'barcode') ?? null,
    expiry_date: valueString(row, 'expiry_date') ?? '',
    manufacture_date: valueString(row, 'manufacture_date') ?? null,
    qty_on_hand: valueNumber(row, 'qty_on_hand'),
    qty_reserved: valueNumber(row, 'qty_reserved'),
    qty_damaged: valueNumber(row, 'qty_damaged'),
    available_qty: valueNumber(row, 'available_qty'),
    purchase_cost: valueNumber(row, 'purchase_cost'),
    selling_price: valueNumber(row, 'selling_price'),
    supplier_id: valueString(row, 'supplier_id') ?? null,
    supplier_name: valueString(row, 'supplier_name') ?? null,
    received_at: valueString(row, 'received_at') ?? '',
    is_active: valueBoolean(row, 'is_active', true),
    is_expired: valueBoolean(row, 'is_expired'),
    is_near_expiry: valueBoolean(row, 'is_near_expiry'),
    requires_prescription: valueBoolean(row, 'requires_prescription'),
    controlled_drug: valueBoolean(row, 'controlled_drug'),
    refrigerated: valueBoolean(row, 'refrigerated'),
    is_otc: valueBoolean(row, 'is_otc'),
  };
}

function parsePrescriptionSummary(row: UnknownRow): PharmacyPrescriptionSummary {
  return {
    id: valueString(row, 'id') ?? '',
    tenant_id: valueString(row, 'tenant_id') ?? '',
    branch_id: valueString(row, 'branch_id') ?? '',
    prescription_number: valueString(row, 'prescription_number') ?? '',
    patient_id: valueString(row, 'patient_id') ?? '',
    patient_name: valueString(row, 'patient_name') ?? null,
    doctor_name: valueString(row, 'doctor_name') ?? null,
    doctor_license: valueString(row, 'doctor_license') ?? null,
    prescription_date: valueString(row, 'prescription_date') ?? '',
    source_type: (valueString(row, 'source_type') ?? 'manual') as PharmacyPrescriptionSummary['source_type'],
    status: (valueString(row, 'status') ?? 'draft') as PharmacyPrescriptionSummary['status'],
    notes: valueString(row, 'notes') ?? null,
    insurance_provider: valueString(row, 'insurance_provider') ?? null,
    policy_number: valueString(row, 'policy_number') ?? null,
    item_count: valueNumber(row, 'item_count'),
    prescribed_qty_total: valueNumber(row, 'prescribed_qty_total'),
    dispensed_qty_total: valueNumber(row, 'dispensed_qty_total'),
    updated_at: valueString(row, 'updated_at') ?? '',
  };
}

function parsePrescriptionItem(row: UnknownRow, productsById: Map<string, ReturnType<typeof parseProduct>>): PharmacyPrescriptionItem {
  const productId = valueString(row, 'product_id') ?? '';
  return {
    id: valueString(row, 'id') ?? '',
    tenant_id: valueString(row, 'tenant_id') ?? '',
    prescription_id: valueString(row, 'prescription_id') ?? '',
    product_id: productId,
    prescribed_qty: valueNumber(row, 'prescribed_qty'),
    dispensed_qty: valueNumber(row, 'dispensed_qty'),
    dosage_instructions: valueString(row, 'dosage_instructions') ?? null,
    duration_text: valueString(row, 'duration_text') ?? null,
    substitutions_allowed: valueBoolean(row, 'substitutions_allowed'),
    status: (valueString(row, 'status') ?? 'pending') as PharmacyPrescriptionItem['status'],
    note: valueString(row, 'note') ?? null,
    product: productsById.get(productId),
  };
}

function parseMedicationHistory(row: UnknownRow, productsById: Map<string, ReturnType<typeof parseProduct>>): PharmacyMedicationHistoryEntry {
  const productId = valueString(row, 'product_id') ?? '';
  return {
    id: valueString(row, 'id') ?? '',
    tenant_id: valueString(row, 'tenant_id') ?? '',
    patient_id: valueString(row, 'patient_id') ?? '',
    product_id: productId,
    last_dispensed_at: valueString(row, 'last_dispensed_at') ?? null,
    last_quantity: row.last_quantity == null ? null : valueNumber(row, 'last_quantity'),
    dispense_count: valueNumber(row, 'dispense_count'),
    notes: valueString(row, 'notes') ?? null,
    product: productsById.get(productId),
  };
}

async function fetchProductsByIds(tenantId: string, ids: string[]) {
  if (!ids.length) return new Map<string, ReturnType<typeof parseProduct>>();
  const { data, error } = await supabase
    .from('pharma_products')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('id', ids);

  if (error) throw error;

  const rows = asRows<UnknownRow>(data);
  const products = await hydratePharmaProductsWithItems(tenantId, rows);
  const map = new Map<string, ReturnType<typeof parseProduct>>();
  products.forEach((product) => map.set(product.id, product));
  return map;
}

async function createDocumentNumber(docType: string, tenantId: string, branchId?: string) {
  const { data, error } = await supabase.rpc('pharmacy_next_document_number', {
    p_doc_type: docType,
    p_tenant_id: tenantId,
    p_branch_id: branchId ?? null,
  });

  if (error || typeof data !== 'string') {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${docType}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${suffix}`;
  }

  return data;
}

export async function loadPharmacyPosSnapshot(
  tenantId: string,
  branchId?: string
): Promise<PharmacyPosSnapshot> {
  try {
    const [branchesRes, patientsRes, suppliersRes, queueRes, featuredProductsRes] = await Promise.all([
      supabase.from('branches').select('id, name, name_ar').eq('tenant_id', tenantId).order('name'),
      supabase
        .from('contacts')
        .select('id, name, email, phone, mobile')
        .eq('tenant_id', tenantId)
        .in('type', ['patient', 'customer'])
        .eq('is_active', true)
        .order('name')
        .limit(24),
      supabase
        .from('contacts')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('type', 'supplier')
        .eq('is_active', true)
        .order('name')
        .limit(24),
      branchId
        ? supabase
            .from('pharma_prescription_queue_v')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('branch_id', branchId)
            .in('status', ['verified', 'partially_dispensed', 'draft'])
            .order('prescription_date', { ascending: false })
            .limit(12)
        : Promise.resolve({ data: [], error: null }),
      branchId
        ? supabase
            .from('pharma_batch_availability_v')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('branch_id', branchId)
            .eq('is_active', true)
            .gt('available_qty', 0)
            .order('is_near_expiry', { ascending: false })
            .order('received_at', { ascending: false })
            .limit(12)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (branchesRes.error) throw branchesRes.error;
    if (patientsRes.error) throw patientsRes.error;
    if (suppliersRes.error) throw suppliersRes.error;
    if (queueRes.error) throw queueRes.error;
    if (featuredProductsRes.error) throw featuredProductsRes.error;

    return {
      branches: asRows<UnknownRow>(branchesRes.data).map(parseBranch),
      patients: asRows<UnknownRow>(patientsRes.data).map(parsePatient),
      suppliers: asRows<UnknownRow>(suppliersRes.data).map(parseSupplier),
      prescriptionQueue: asRows<UnknownRow>(queueRes.data).map(parsePrescriptionSummary),
      featuredProducts: asRows<UnknownRow>(featuredProductsRes.data).map(parseBatch),
      selectedBranchId: branchId ?? null,
    };
  } catch (error) {
    throw new Error(normalizePharmacyError(error, 'تعذر تحميل لقطة تشغيل الصيدلية.'));
  }
}

export async function searchPharmacyProducts(
  tenantId: string,
  branchId: string,
  query: string
): Promise<PharmacyBatch[]> {
  try {
    let builder = supabase
      .from('pharma_batch_availability_v')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .gt('available_qty', 0);

    const trimmed = query.trim();
    if (trimmed) {
      const escaped = trimmed.replace(/,/g, ' ');
      builder = builder.or(
        [
          `brand_name.ilike.%${escaped}%`,
          `generic_name.ilike.%${escaped}%`,
          `item_name.ilike.%${escaped}%`,
          `sku.ilike.%${escaped}%`,
          `barcode.ilike.%${escaped}%`,
          `item_barcode.ilike.%${escaped}%`,
          `batch_number.ilike.%${escaped}%`,
        ].join(',')
      );
    }

    const { data, error } = await builder.order('expiry_date', { ascending: true }).limit(48);
    if (error) throw error;
    return asRows<UnknownRow>(data).map(parseBatch);
  } catch (error) {
    throw new Error(normalizePharmacyError(error, 'تعذر البحث في أصناف الصيدلية.'));
  }
}

export async function loadPrescriptionQueue(
  tenantId: string,
  filters: PharmacyPrescriptionFilters = {}
): Promise<PharmacyPrescriptionSummary[]> {
  try {
    let builder = supabase
      .from('pharma_prescription_queue_v')
      .select('*')
      .eq('tenant_id', tenantId);

    if (filters.branch_id) builder = builder.eq('branch_id', filters.branch_id);
    if (filters.patient_id) builder = builder.eq('patient_id', filters.patient_id);
    if (filters.status && filters.status !== 'all') builder = builder.eq('status', filters.status);
    if (filters.doctor) builder = builder.ilike('doctor_name', `%${filters.doctor}%`);
    if (filters.date_from) builder = builder.gte('prescription_date', filters.date_from);
    if (filters.date_to) builder = builder.lte('prescription_date', filters.date_to);

    const { data, error } = await builder.order('prescription_date', { ascending: false }).limit(120);
    if (error) throw error;
    return asRows<UnknownRow>(data).map(parsePrescriptionSummary);
  } catch (error) {
    throw new Error(normalizePharmacyError(error, 'تعذر تحميل قائمة الوصفات.'));
  }
}

export async function loadPrescriptionDetails(
  tenantId: string,
  prescriptionId: string
): Promise<PharmacyPrescriptionDetails> {
  try {
    const [summaryRes, itemsRes] = await Promise.all([
      supabase.from('pharma_prescription_queue_v').select('*').eq('tenant_id', tenantId).eq('id', prescriptionId).single(),
      supabase
        .from('pharma_prescription_items')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('prescription_id', prescriptionId)
        .order('created_at'),
    ]);

    if (summaryRes.error) throw summaryRes.error;
    if (itemsRes.error) throw itemsRes.error;

    const summary = parsePrescriptionSummary(asRecord(summaryRes.data));
    const itemRows = asRows<UnknownRow>(itemsRes.data);
    const productIds = Array.from(new Set(itemRows.map((row) => valueString(row, 'product_id') ?? '').filter(Boolean)));
    const productsById = await fetchProductsByIds(tenantId, productIds);

    return {
      ...summary,
      items: itemRows.map((row) => parsePrescriptionItem(row, productsById)),
    };
  } catch (error) {
    throw new Error(normalizePharmacyError(error, 'تعذر تحميل تفاصيل الوصفة.'));
  }
}

async function upsertPrescriptionItems(
  tenantId: string,
  prescriptionId: string,
  items: PharmacyPrescriptionDraftInput['items']
) {
  const payload = items.map((item) => ({
    id: item.id,
    tenant_id: tenantId,
    prescription_id: prescriptionId,
    product_id: item.product_id,
    prescribed_qty: item.prescribed_qty,
    dispensed_qty: item.dispensed_qty ?? 0,
    dosage_instructions: item.dosage_instructions ?? null,
    duration_text: item.duration_text ?? null,
    substitutions_allowed: item.substitutions_allowed ?? false,
    status: item.status ?? 'pending',
    note: item.note ?? null,
  }));

  if (!payload.length) return;

  const keepIds = payload.map((item) => item.id).filter(Boolean) as string[];
  const { data: existingRows, error: existingError } = await supabase
    .from('pharma_prescription_items')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('prescription_id', prescriptionId);
  if (existingError) throw existingError;

  const existingIds = asRows<UnknownRow>(existingRows).map((row) => valueString(row, 'id') ?? '').filter(Boolean);
  const deleteIds = existingIds.filter((id) => !keepIds.includes(id));
  if (deleteIds.length) {
    const { error: deleteMissingError } = await supabase
      .from('pharma_prescription_items')
      .delete()
      .eq('tenant_id', tenantId)
      .in('id', deleteIds);
    if (deleteMissingError) throw deleteMissingError;
  }

  const { error } = await supabase.from('pharma_prescription_items').upsert(payload);
  if (error) throw error;
}

export async function createPrescriptionDraft(
  tenantId: string,
  input: PharmacyPrescriptionDraftInput
): Promise<string> {
  try {
    const prescriptionNumber = input.prescription_number || (await createDocumentNumber('RX', tenantId, input.branch_id));
    const { data, error } = await supabase
      .from('pharma_prescriptions')
      .insert({
        tenant_id: tenantId,
        branch_id: input.branch_id,
        prescription_number: prescriptionNumber,
        patient_id: input.patient_id,
        doctor_name: input.doctor_name ?? null,
        doctor_license: input.doctor_license ?? null,
        prescription_date: input.prescription_date,
        source_type: input.source_type,
        status: input.status ?? 'draft',
        notes: input.notes ?? null,
        attachment_url: input.attachment_url ?? null,
        insurance_provider: input.insurance_provider ?? null,
        policy_number: input.policy_number ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;
    const prescriptionId = valueString(asRecord(data), 'id') ?? '';
    await upsertPrescriptionItems(tenantId, prescriptionId, input.items);
    return prescriptionId;
  } catch (error) {
    throw new Error(normalizePharmacyError(error, 'تعذر إنشاء مسودة الوصفة.'));
  }
}

export async function updatePrescriptionDraft(
  tenantId: string,
  input: PharmacyPrescriptionDraftInput
): Promise<string> {
  if (!input.id) throw new Error('معرّف الوصفة مطلوب للتحديث.');

  try {
    const { error } = await supabase
      .from('pharma_prescriptions')
      .update({
        branch_id: input.branch_id,
        patient_id: input.patient_id,
        doctor_name: input.doctor_name ?? null,
        doctor_license: input.doctor_license ?? null,
        prescription_date: input.prescription_date,
        source_type: input.source_type,
        status: input.status ?? 'draft',
        notes: input.notes ?? null,
        attachment_url: input.attachment_url ?? null,
        insurance_provider: input.insurance_provider ?? null,
        policy_number: input.policy_number ?? null,
      })
      .eq('tenant_id', tenantId)
      .eq('id', input.id);

    if (error) throw error;
    await upsertPrescriptionItems(tenantId, input.id, input.items);
    return input.id;
  } catch (error) {
    throw new Error(normalizePharmacyError(error, 'تعذر تحديث مسودة الوصفة.'));
  }
}

export async function dispensePrescription(input: PharmacyDispensePrescriptionInput) {
  const { data, error } = await supabase.rpc('pharmacy_dispense_prescription', {
    p_prescription_id: input.prescription_id,
    p_branch_id: input.branch_id,
    p_lines: input.lines,
    p_payments: input.payments ?? [],
    p_notes: input.notes ?? null,
    p_controlled_note: input.controlled_note ?? null,
  });

  if (error) throw new Error(normalizePharmacyError(error, 'تعذر صرف الوصفة.'));
  return asRecord(data);
}

export async function completeOtcSale(input: PharmacyOtcSaleInput) {
  const { data, error } = await supabase.rpc('pharmacy_complete_otc_sale', {
    p_branch_id: input.branch_id,
    p_lines: input.lines,
    p_payments: input.payments ?? [],
    p_patient_id: input.patient_id ?? null,
    p_notes: input.notes ?? null,
    p_allow_rx_override: input.allow_rx_override ?? false,
    p_controlled_note: input.controlled_note ?? null,
  });

  if (error) throw new Error(normalizePharmacyError(error, 'تعذر إتمام بيع OTC.'));
  return asRecord(data);
}

export async function loadBatches(
  tenantId: string,
  filters: PharmacyInventoryFilters = {}
): Promise<PharmacyBatch[]> {
  try {
    let builder = supabase
      .from('pharma_batch_availability_v')
      .select('*')
      .eq('tenant_id', tenantId);

    if (filters.branch_id) builder = builder.eq('branch_id', filters.branch_id);
    if (filters.supplier_id) builder = builder.eq('supplier_id', filters.supplier_id);
    if (filters.product_id) builder = builder.eq('product_id', filters.product_id);
    if (filters.expired) builder = builder.eq('is_expired', true);
    if (filters.near_expiry) builder = builder.eq('is_near_expiry', true);
    if (filters.active_only) builder = builder.eq('is_active', true);
    if (filters.search) {
      const search = filters.search.replace(/,/g, ' ');
      builder = builder.or(
        [
          `brand_name.ilike.%${search}%`,
          `generic_name.ilike.%${search}%`,
          `item_name.ilike.%${search}%`,
          `sku.ilike.%${search}%`,
          `barcode.ilike.%${search}%`,
          `item_barcode.ilike.%${search}%`,
          `batch_number.ilike.%${search}%`,
        ].join(',')
      );
    }

    const { data, error } = await builder.order('expiry_date', { ascending: true }).limit(400);
    if (error) throw error;
    return asRows<UnknownRow>(data).map(parseBatch);
  } catch (error) {
    throw new Error(normalizePharmacyError(error, 'تعذر تحميل دفعات الصيدلية.'));
  }
}

export async function receivePharmacyBatches(branchId: string, lines: PharmacyReceiveBatchLineInput[], supplierId?: string, note?: string) {
  const { data, error } = await supabase.rpc('pharmacy_receive_batches', {
    p_branch_id: branchId,
    p_lines: lines,
    p_supplier_id: supplierId ?? null,
    p_note: note ?? null,
  });

  if (error) throw new Error(normalizePharmacyError(error, 'تعذر استلام دفعات الصيدلية.'));
  return asRecord(data);
}

export async function adjustBatchStock(input: PharmacyAdjustBatchInput) {
  const { data, error } = await supabase.rpc('pharmacy_adjust_batch_stock', {
    p_batch_id: input.batch_id,
    p_adjustment_qty: input.adjustment_qty,
    p_movement_type: input.movement_type ?? 'adjustment',
    p_note: input.note ?? null,
  });

  if (error) throw new Error(normalizePharmacyError(error, 'تعذر تعديل مخزون الدفعة.'));
  return asRecord(data);
}

export async function createSupplierReturn(input: PharmacySupplierReturnInput) {
  const { data, error } = await supabase.rpc('pharmacy_return_to_supplier', {
    p_branch_id: input.branch_id,
    p_supplier_id: input.supplier_id,
    p_lines: input.lines,
    p_reason: input.reason ?? null,
  });

  if (error) throw new Error(normalizePharmacyError(error, 'تعذر إنشاء مرتجع المورد.'));
  return asRecord(data);
}

export async function markBatchExpired(batchId: string, quantity?: number, note?: string) {
  const { data, error } = await supabase.rpc('pharmacy_mark_batch_expired', {
    p_batch_id: batchId,
    p_quantity: quantity ?? null,
    p_note: note ?? null,
  });

  if (error) throw new Error(normalizePharmacyError(error, 'تعذر تعليم الدفعة كمنتهية.'));
  return asRecord(data);
}

export async function submitInsuranceClaim(
  dispenseId: string,
  insurerName: string,
  policyNumber: string,
  claimedAmount: number,
  submissionPayload: Record<string, unknown>
) {
  const { data, error } = await supabase.rpc('pharmacy_submit_insurance_claim', {
    p_dispense_id: dispenseId,
    p_insurer_name: insurerName,
    p_policy_number: policyNumber,
    p_claimed_amount: claimedAmount,
    p_submission_payload: submissionPayload,
  });

  if (error) throw new Error(normalizePharmacyError(error, 'تعذر إنشاء مطالبة التأمين.'));
  return asRecord(data);
}

export async function loadPatientMedicationHistory(
  tenantId: string,
  patientId: string
): Promise<PharmacyMedicationHistoryEntry[]> {
  try {
    const { data, error } = await supabase
      .from('pharma_patient_med_history')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('patient_id', patientId)
      .order('last_dispensed_at', { ascending: false });

    if (error) throw error;
    const rows = asRows<UnknownRow>(data);
    const productIds = Array.from(new Set(rows.map((row) => valueString(row, 'product_id') ?? '').filter(Boolean)));
    const productsById = await fetchProductsByIds(tenantId, productIds);
    return rows.map((row) => parseMedicationHistory(row, productsById));
  } catch (error) {
    throw new Error(normalizePharmacyError(error, 'تعذر تحميل التاريخ الدوائي للمريض.'));
  }
}

export async function loadInsuranceClaims(tenantId: string, branchId?: string): Promise<PharmacyInsuranceClaim[]> {
  try {
    let builder = supabase.from('pharma_insurance_claims').select('*').eq('tenant_id', tenantId);
    if (branchId) builder = builder.eq('branch_id', branchId);
    const { data, error } = await builder.order('created_at', { ascending: false }).limit(100);
    if (error) throw error;

    return asRows<UnknownRow>(data).map((row) => ({
      id: valueString(row, 'id') ?? '',
      tenant_id: valueString(row, 'tenant_id') ?? '',
      branch_id: valueString(row, 'branch_id') ?? '',
      dispense_id: valueString(row, 'dispense_id') ?? '',
      patient_id: valueString(row, 'patient_id') ?? '',
      insurer_name: valueString(row, 'insurer_name') ?? null,
      policy_number: valueString(row, 'policy_number') ?? null,
      claim_number: valueString(row, 'claim_number') ?? null,
      approved_amount: valueNumber(row, 'approved_amount'),
      claimed_amount: valueNumber(row, 'claimed_amount'),
      status: (valueString(row, 'status') ?? 'draft') as PharmacyInsuranceClaim['status'],
      submission_payload: (row.submission_payload as Record<string, unknown> | undefined) ?? {},
      response_payload: (row.response_payload as Record<string, unknown> | undefined) ?? {},
      created_at: valueString(row, 'created_at') ?? '',
      updated_at: valueString(row, 'updated_at') ?? '',
    }));
  } catch (error) {
    throw new Error(normalizePharmacyError(error, 'تعذر تحميل مطالبات التأمين.'));
  }
}

export async function loadPharmacyCatalog(tenantId: string, search?: string) {
  try {
    let builder = supabase
      .from('pharma_products')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(100);

    if (search?.trim()) {
      const trimmed = search.trim().replace(/,/g, ' ');
      builder = builder.or(
        [
          `brand_name.ilike.%${trimmed}%`,
          `generic_name.ilike.%${trimmed}%`,
          `strength.ilike.%${trimmed}%`,
          `dosage_form.ilike.%${trimmed}%`,
        ].join(',')
      );
    }

    const { data, error } = await builder;
    if (error) throw error;

    return hydratePharmaProductsWithItems(tenantId, asRows<UnknownRow>(data));
  } catch (error) {
    throw new Error(normalizePharmacyError(error, 'تعذر تحميل كتالوج الصيدلية.'));
  }
}

export async function loadPharmacyReports(
  tenantId: string,
  filters: PharmacyReportsFilters = {}
): Promise<PharmacyReportSnapshot> {
  try {
    const [dispenseRes, batchRes, returnsRes, claimsRes, movementRes, dispenseItemsRes] = await Promise.all([
      (() => {
        let builder = supabase
          .from('pharma_dispense_history_v')
          .select('*')
          .eq('tenant_id', tenantId)
          .gte('created_at', filters.date_from ?? '1900-01-01')
          .lte('created_at', filters.date_to ? `${filters.date_to}T23:59:59.999Z` : new Date().toISOString());
        if (filters.branch_id) builder = builder.eq('branch_id', filters.branch_id);
        return builder.order('created_at', { ascending: false });
      })(),
      (() => {
        let builder = supabase.from('pharma_batch_availability_v').select('*').eq('tenant_id', tenantId);
        if (filters.branch_id) builder = builder.eq('branch_id', filters.branch_id);
        return builder.order('expiry_date', { ascending: true });
      })(),
      (() => {
        let builder = supabase.from('pharma_supplier_returns').select('id, return_number, total_amount, created_at').eq('tenant_id', tenantId);
        if (filters.branch_id) builder = builder.eq('branch_id', filters.branch_id);
        return builder.order('created_at', { ascending: false });
      })(),
      (() => {
        let builder = supabase.from('pharma_insurance_claims').select('status, claimed_amount').eq('tenant_id', tenantId);
        if (filters.branch_id) builder = builder.eq('branch_id', filters.branch_id);
        return builder;
      })(),
      (() => {
        let builder = supabase
          .from('pharma_stock_movements')
          .select('movement_type, quantity, created_at, product_id, batch_id')
          .eq('tenant_id', tenantId);
        if (filters.branch_id) builder = builder.eq('branch_id', filters.branch_id);
        return builder.order('created_at', { ascending: false }).limit(200);
      })(),
      supabase
        .from('pharma_dispense_items')
        .select('product_id, batch_id, quantity, line_total, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(300),
    ]);

    if (dispenseRes.error) throw dispenseRes.error;
    if (batchRes.error) throw batchRes.error;
    if (returnsRes.error) throw returnsRes.error;
    if (claimsRes.error) throw claimsRes.error;
    if (movementRes.error) throw movementRes.error;
    if (dispenseItemsRes.error) throw dispenseItemsRes.error;

    const dispenses = asRows<UnknownRow>(dispenseRes.data);
    const batches = asRows<UnknownRow>(batchRes.data).map(parseBatch);
    const returnsRows = asRows<UnknownRow>(returnsRes.data);
    const claimsRows = asRows<UnknownRow>(claimsRes.data);
    const movementRows = asRows<UnknownRow>(movementRes.data);
    const dispenseItems = asRows<UnknownRow>(dispenseItemsRes.data);
    const productIds = Array.from(new Set(dispenseItems.map((row) => valueString(row, 'product_id') ?? '').filter(Boolean)));
    const productsById = await fetchProductsByIds(tenantId, productIds);

    const sales = groupAmountByMonth(dispenses, (row) => valueString(asRecord(row), 'created_at'), (row) => safeNumber(asRecord(row).total_amount));

    const topMap = new Map<string, { label: string; quantity: number; revenue: number }>();
    dispenseItems.forEach((row) => {
      const productId = valueString(row, 'product_id') ?? '';
      const product = productsById.get(productId);
      const label = product?.brand_name || product?.item_name || 'دواء';
      const current = topMap.get(productId) ?? { label, quantity: 0, revenue: 0 };
      current.quantity += valueNumber(row, 'quantity');
      current.revenue += valueNumber(row, 'line_total');
      topMap.set(productId, current);
    });

    const grossMargin = Array.from(topMap.entries()).map(([productId, stats]) => {
      const matchingBatches = batches.filter((batch) => batch.product_id === productId);
      const avgCost =
        matchingBatches.reduce((sum, batch) => sum + batch.purchase_cost, 0) / Math.max(matchingBatches.length, 1);
      const revenue = stats.revenue;
      const cost = stats.quantity * avgCost;
      const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
      return { label: stats.label, margin, revenue };
    });

    const insuranceByStatus = new Map<string, { status: string; count: number; claimed_amount: number }>();
    claimsRows.forEach((row) => {
      const status = valueString(row, 'status') ?? 'draft';
      const current = insuranceByStatus.get(status) ?? { status, count: 0, claimed_amount: 0 };
      current.count += 1;
      current.claimed_amount += valueNumber(row, 'claimed_amount');
      insuranceByStatus.set(status, current);
    });

    const controlledMovement = movementRows
      .filter((row) => {
        const product = productsById.get(valueString(row, 'product_id') ?? '');
        return Boolean(product?.controlled_drug);
      })
      .map((row) => {
        const product = productsById.get(valueString(row, 'product_id') ?? '');
        return {
          label: product?.brand_name || product?.item_name || 'دواء خاضع للرقابة',
          quantity: valueNumber(row, 'quantity'),
          batch_number: valueString(row, 'batch_id') ?? '',
          created_at: valueString(row, 'created_at') ?? '',
        };
      });

    return {
      sales,
      topMedicines: Array.from(topMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 10),
      expiryRisk: batches.filter((batch) => batch.is_expired || batch.is_near_expiry).slice(0, 20),
      grossMargin: grossMargin.sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      supplierReturns: returnsRows.map((row) => ({
        label: valueString(row, 'return_number') ?? 'مرتجع',
        total_amount: valueNumber(row, 'total_amount'),
      })),
      insuranceClaims: Array.from(insuranceByStatus.values()),
      stockMovements: movementRows.map((row) => ({
        date: valueString(row, 'created_at') ?? '',
        movement_type: (valueString(row, 'movement_type') ?? 'adjustment') as PharmacyReportSnapshot['stockMovements'][number]['movement_type'],
        quantity: valueNumber(row, 'quantity'),
      })),
      controlledMovement,
    };
  } catch (error) {
    throw new Error(normalizePharmacyError(error, 'تعذر تحميل تقارير الصيدلية.'));
  }
}
