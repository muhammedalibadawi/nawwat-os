export type RuntimeLoadClassification =
  | 'no_data'
  | 'filtered_out'
  | 'branch_mismatch'
  | 'tenant_mismatch'
  | 'access_denied'
  | 'rls_denied'
  | 'unknown_error';

function runtimeErrorRaw(error: unknown): string {
  const parts: string[] = [];
  const add = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) parts.push(value.trim());
  };
  const walk = (value: unknown, depth: number): void => {
    if (value == null || depth > 5) return;
    if (typeof value === 'string') {
      add(value);
      return;
    }
    if (value instanceof Error) {
      add(value.message);
      walk((value as Error & { cause?: unknown }).cause, depth + 1);
      return;
    }
    if (typeof value === 'object') {
      const row = value as Record<string, unknown>;
      add(row.message);
      add(row.details);
      add(row.hint);
      add(row.code);
      if (row.error != null) walk(row.error, depth + 1);
    }
  };
  walk(error, 0);
  return parts.join(' — ');
}

export function classifyRuntimeError(error: unknown): RuntimeLoadClassification {
  const raw = runtimeErrorRaw(error).toLowerCase();
  if (!raw) return 'unknown_error';

  if (/\brls\b|row-level security|policy/i.test(raw)) return 'rls_denied';
  if (/access denied|forbidden|not authorized|not allowed|insufficient privilege|permission denied/i.test(raw)) {
    return 'access_denied';
  }
  if (/tenant|workspace|cross-tenant|different tenant|tenant_id/i.test(raw)) return 'tenant_mismatch';
  if (/branch|branch_id|wrong branch|different branch|invalid branch/i.test(raw)) return 'branch_mismatch';
  return 'unknown_error';
}

export function classifyRuntimeEmptyState(input: {
  hasFilters?: boolean;
  branchMismatch?: boolean;
  tenantMismatch?: boolean;
}): RuntimeLoadClassification {
  if (input.tenantMismatch) return 'tenant_mismatch';
  if (input.branchMismatch) return 'branch_mismatch';
  if (input.hasFilters) return 'filtered_out';
  return 'no_data';
}

export function getRuntimeClassificationMessage(kind: RuntimeLoadClassification, fallback: string): string {
  switch (kind) {
    case 'access_denied':
      return 'السبب: تم رفض الوصول إلى هذه البيانات حسب الدور الحالي. استخدم حسابًا بصلاحيات أعلى أو تواصل مع المسؤول.';
    case 'rls_denied':
      return 'السبب: تعارض صلاحيات RLS مع سياق الجلسة الحالي (tenant/role). حدّث الجلسة أو استخدم حسابًا مخوّلًا.';
    case 'tenant_mismatch':
      return 'السبب: البيانات المطلوبة مرتبطة بـ tenant مختلف عن tenant الجلسة الحالية.';
    case 'branch_mismatch':
      return 'السبب: البيانات المطلوبة مرتبطة بفرع مختلف عن الفرع المحدد حاليًا.';
    default:
      return fallback;
  }
}
