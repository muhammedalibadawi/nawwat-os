export type PharmacyDispenseMode = 'prescription' | 'otc';

export type PharmacyPaymentMethod = 'cash' | 'card' | 'transfer';

export type PharmacyPrescriptionStatus =
  | 'draft'
  | 'verified'
  | 'partially_dispensed'
  | 'dispensed'
  | 'cancelled'
  | 'expired';

export type PharmacyPrescriptionItemStatus =
  | 'pending'
  | 'partially_dispensed'
  | 'dispensed'
  | 'cancelled';

export type PharmacyDispenseStatus = 'draft' | 'completed' | 'cancelled' | 'returned';

export type PharmacyPaymentStatus = 'pending' | 'paid' | 'partially_paid' | 'voided';

export type PharmacyBatchMovementType =
  | 'receive'
  | 'dispense'
  | 'return_customer'
  | 'return_supplier'
  | 'adjustment'
  | 'expire'
  | 'damage'
  | 'transfer_in'
  | 'transfer_out'
  | 'reserve'
  | 'release';

export interface PharmacyBranchOption {
  id: string;
  name: string;
  name_ar?: string | null;
}

export interface PharmacyPatientOption {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  policy_number?: string | null;
}

export interface PharmacySupplierOption {
  id: string;
  name: string;
}

export interface PharmacyProduct {
  id: string;
  tenant_id: string;
  item_id: string;
  sku?: string | null;
  item_barcode?: string | null;
  item_name?: string | null;
  item_name_ar?: string | null;
  generic_name?: string | null;
  brand_name?: string | null;
  strength?: string | null;
  dosage_form?: string | null;
  route?: string | null;
  manufacturer?: string | null;
  requires_prescription: boolean;
  controlled_drug: boolean;
  refrigerated: boolean;
  narcotic_schedule?: string | null;
  tax_profile_id?: string | null;
  is_otc: boolean;
  is_active: boolean;
  metadata?: Record<string, unknown>;
}

export interface PharmacyBatch {
  id: string;
  tenant_id: string;
  branch_id: string;
  branch_name?: string | null;
  product_id: string;
  item_id: string;
  sku?: string | null;
  item_barcode?: string | null;
  item_name?: string | null;
  item_name_ar?: string | null;
  brand_name?: string | null;
  generic_name?: string | null;
  strength?: string | null;
  dosage_form?: string | null;
  batch_number: string;
  barcode?: string | null;
  expiry_date: string;
  manufacture_date?: string | null;
  qty_on_hand: number;
  qty_reserved: number;
  qty_damaged: number;
  available_qty: number;
  purchase_cost: number;
  selling_price: number;
  supplier_id?: string | null;
  supplier_name?: string | null;
  received_at: string;
  is_active: boolean;
  is_expired: boolean;
  is_near_expiry: boolean;
  requires_prescription: boolean;
  controlled_drug: boolean;
  refrigerated: boolean;
  is_otc: boolean;
}

export interface PharmacyPrescriptionSummary {
  id: string;
  tenant_id: string;
  branch_id: string;
  prescription_number: string;
  patient_id: string;
  patient_name?: string | null;
  doctor_name?: string | null;
  doctor_license?: string | null;
  prescription_date: string;
  source_type: 'manual' | 'uploaded' | 'erx' | 'walk_in';
  status: PharmacyPrescriptionStatus;
  notes?: string | null;
  insurance_provider?: string | null;
  policy_number?: string | null;
  item_count: number;
  prescribed_qty_total: number;
  dispensed_qty_total: number;
  updated_at: string;
}

export interface PharmacyPrescriptionItem {
  id: string;
  tenant_id: string;
  prescription_id: string;
  product_id: string;
  prescribed_qty: number;
  dispensed_qty: number;
  dosage_instructions?: string | null;
  duration_text?: string | null;
  substitutions_allowed: boolean;
  status: PharmacyPrescriptionItemStatus;
  note?: string | null;
  product?: PharmacyProduct;
}

export interface PharmacyPrescriptionDetails extends PharmacyPrescriptionSummary {
  items: PharmacyPrescriptionItem[];
}

export interface PharmacyPaymentLine {
  method: PharmacyPaymentMethod;
  amount: number;
  transaction_ref?: string;
  note?: string;
}

export interface PharmacyCartLine {
  id: string;
  product_id: string;
  product_name: string;
  generic_name?: string | null;
  strength?: string | null;
  dosage_form?: string | null;
  requires_prescription: boolean;
  controlled_drug: boolean;
  batch_id?: string | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  available_qty?: number;
  unit_price: number;
  quantity: number;
  tax_amount: number;
  discount_amount: number;
  line_total: number;
  source_prescription_item_id?: string | null;
  note?: string;
}

export interface PharmacyPosSnapshot {
  branches: PharmacyBranchOption[];
  patients: PharmacyPatientOption[];
  suppliers: PharmacySupplierOption[];
  prescriptionQueue: PharmacyPrescriptionSummary[];
  featuredProducts: PharmacyBatch[];
  selectedBranchId?: string | null;
}

export interface PharmacyPrescriptionDraftItemInput {
  id?: string;
  product_id: string;
  prescribed_qty: number;
  dispensed_qty?: number;
  dosage_instructions?: string;
  duration_text?: string;
  substitutions_allowed?: boolean;
  status?: PharmacyPrescriptionItemStatus;
  note?: string;
}

export interface PharmacyPrescriptionDraftInput {
  id?: string;
  branch_id: string;
  patient_id: string;
  prescription_number?: string;
  doctor_name?: string;
  doctor_license?: string;
  prescription_date: string;
  source_type: 'manual' | 'uploaded' | 'erx' | 'walk_in';
  status?: PharmacyPrescriptionStatus;
  notes?: string;
  attachment_url?: string;
  insurance_provider?: string;
  policy_number?: string;
  items: PharmacyPrescriptionDraftItemInput[];
}

export interface PharmacyReceiveBatchLineInput {
  product_id: string;
  batch_number: string;
  expiry_date: string;
  manufacture_date?: string;
  quantity: number;
  purchase_cost: number;
  selling_price: number;
  supplier_id?: string;
  barcode?: string;
  note?: string;
}

export interface PharmacyAdjustBatchInput {
  batch_id: string;
  adjustment_qty: number;
  movement_type?: 'adjustment' | 'damage' | 'reserve' | 'release';
  note?: string;
}

export interface PharmacySupplierReturnLineInput {
  batch_id: string;
  quantity: number;
  reason?: string;
}

export interface PharmacySupplierReturnInput {
  branch_id: string;
  supplier_id: string;
  reason?: string;
  lines: PharmacySupplierReturnLineInput[];
}

export interface PharmacyDispensePrescriptionInput {
  prescription_id: string;
  branch_id: string;
  lines: Array<{
    prescription_item_id: string;
    quantity: number;
  }>;
  payments?: PharmacyPaymentLine[];
  notes?: string;
  controlled_note?: string;
}

export interface PharmacyOtcSaleInput {
  branch_id: string;
  patient_id?: string;
  lines: Array<{
    product_id: string;
    quantity: number;
  }>;
  payments?: PharmacyPaymentLine[];
  notes?: string;
  allow_rx_override?: boolean;
  controlled_note?: string;
}

export interface PharmacyMedicationHistoryEntry {
  id: string;
  tenant_id: string;
  patient_id: string;
  product_id: string;
  last_dispensed_at?: string | null;
  last_quantity?: number | null;
  dispense_count: number;
  notes?: string | null;
  product?: PharmacyProduct;
}

export interface PharmacyInsuranceClaim {
  id: string;
  tenant_id: string;
  branch_id: string;
  dispense_id: string;
  patient_id: string;
  insurer_name?: string | null;
  policy_number?: string | null;
  claim_number?: string | null;
  approved_amount: number;
  claimed_amount: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
  submission_payload: Record<string, unknown>;
  response_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PharmacyInventoryFilters {
  branch_id?: string;
  supplier_id?: string;
  product_id?: string;
  search?: string;
  expired?: boolean;
  near_expiry?: boolean;
  active_only?: boolean;
}

export interface PharmacyPrescriptionFilters {
  branch_id?: string;
  patient_id?: string;
  doctor?: string;
  status?: PharmacyPrescriptionStatus | 'all';
  date_from?: string;
  date_to?: string;
}

export interface PharmacyReportsFilters {
  branch_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface PharmacySalesPoint {
  key: string;
  label: string;
  total: number;
}

export interface PharmacyReportSnapshot {
  sales: PharmacySalesPoint[];
  topMedicines: Array<{ label: string; quantity: number; revenue: number }>;
  expiryRisk: PharmacyBatch[];
  grossMargin: Array<{ label: string; margin: number; revenue: number }>;
  supplierReturns: Array<{ label: string; total_amount: number }>;
  insuranceClaims: Array<{ status: string; count: number; claimed_amount: number }>;
  stockMovements: Array<{ date: string; movement_type: PharmacyBatchMovementType; quantity: number }>;
  controlledMovement: Array<{ label: string; quantity: number; batch_number: string; created_at: string }>;
}
