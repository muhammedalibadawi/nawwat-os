import type { PharmacyBatch, PharmacyCartLine, PharmacySalesPoint } from '@/types/pharmacy';

export const PHARMACY_PRIMARY = '#071C3B';
export const PHARMACY_ACCENT = '#00CFFF';

export type PharmacyExpiryState = 'expired' | 'near' | 'healthy';

export function safeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatCurrency(amount: number, currency = 'AED'): string {
  return new Intl.NumberFormat('ar-AE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-AE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

export function daysUntil(dateValue?: string | null): number | null {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return Math.round((parsed.getTime() - today.getTime()) / 86400000);
}

export function getExpiryState(dateValue?: string | null): PharmacyExpiryState {
  const days = daysUntil(dateValue);
  if (days === null) return 'healthy';
  if (days < 0) return 'expired';
  if (days <= 60) return 'near';
  return 'healthy';
}

export function getExpiryStateLabel(dateValue?: string | null): string {
  const state = getExpiryState(dateValue);
  if (state === 'expired') return 'منتهي';
  if (state === 'near') return 'قريب الانتهاء';
  return 'ساري';
}

function pharmacyErrorRawMessage(error: unknown): string {
  const parts: string[] = [];
  const add = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) parts.push(v.trim());
  };

  const walk = (err: unknown, depth: number): void => {
    if (err == null || depth > 5) return;
    if (typeof err === 'string') {
      add(err);
      return;
    }
    if (err instanceof Error) {
      add(err.message);
      walk((err as Error & { cause?: unknown }).cause, depth + 1);
      return;
    }
    if (typeof err === 'object') {
      const o = err as Record<string, unknown>;
      add(o.message);
      add(o.details);
      add(o.hint);
      add(o.code);
      if (o.error != null) walk(o.error, depth + 1);
    }
  };

  walk(error, 0);
  return parts.join(' — ');
}

/** يخفّي أخطاء Postgres/PostgREST الخام ويُرجع نصًا عربيًا مفهومًا للمستخدم. */
export function normalizePharmacyError(error: unknown, fallback = 'حدث خطأ غير متوقع. حاول مرة أخرى.'): string {
  const raw = pharmacyErrorRawMessage(error);
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  if (/permission denied|row-level security|\brls\b|jwt expired|invalid jwt|violates foreign key|duplicate key|null value in column/i.test(raw)) {
    return 'تعذر إكمال العملية. تحقق من الصلاحيات أو من اكتمال البيانات المطلوبة.';
  }
  if (
    /pharma_products/i.test(lower) &&
    (/could not find|relationship|schema cache|item_id|pgrst/i.test(lower) || /pgrst\d+/i.test(raw))
  ) {
    return 'تعذر تحميل بيانات الدواء: الربط بين «منتجات الصيدلية» و«الأصناف» غير مدعوم كتضمين تلقائي في واجهة الـ API. استخدم تحديث الواجهة (إعادة بناء المشروع) أو حدّث الصفحة. إن استمر الخطأ، راجع مسؤول النظام.';
  }
  if (/relation .+ does not exist|function .+ does not exist|schema cache|could not find a relationship|pgrst204|pgrst\d+/i.test(lower)) {
    return 'إعداد الصيدلية على الخادم غير مكتمل أو غير متزامن مع الواجهة. راجع مسؤول النظام أو حدّث الصفحة.';
  }
  if (raw.length > 220) return fallback;
  return raw;
}

export function getMedicineDisplayName(batchOrProduct: Partial<PharmacyBatch>): string {
  return (
    batchOrProduct.brand_name ||
    batchOrProduct.item_name ||
    batchOrProduct.generic_name ||
    'دواء غير مسمى'
  );
}

export function getMedicineSecondaryName(batchOrProduct: Partial<PharmacyBatch>): string {
  const parts = [batchOrProduct.generic_name, batchOrProduct.strength, batchOrProduct.dosage_form].filter(Boolean);
  return parts.join(' • ');
}

export function calculateCartTotals(lines: PharmacyCartLine[]) {
  return lines.reduce(
    (acc, line) => {
      acc.subtotal += line.unit_price * line.quantity;
      acc.tax += line.tax_amount;
      acc.discount += line.discount_amount;
      acc.total += line.line_total;
      return acc;
    },
    { subtotal: 0, tax: 0, discount: 0, total: 0 }
  );
}

export function batchCanDispense(batch: PharmacyBatch): boolean {
  return batch.is_active && !batch.is_expired && safeNumber(batch.available_qty) > 0;
}

export function groupAmountByMonth<T>(
  rows: T[],
  getDate: (row: T) => string | null | undefined,
  getAmount: (row: T) => number
): PharmacySalesPoint[] {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const value = getDate(row);
    if (!value) return;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return;
    const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) ?? 0) + getAmount(row));
  });

  return Array.from(map.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, total]) => ({
      key,
      total,
      label: new Intl.DateTimeFormat('ar-AE', { year: 'numeric', month: 'short' }).format(new Date(`${key}-01`)),
    }));
}

export function makeCartLineKey(prefix: string, seed: string): string {
  return `${prefix}:${seed}:${Math.random().toString(36).slice(2, 8)}`;
}
