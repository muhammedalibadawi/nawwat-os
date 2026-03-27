import type { AppRole } from '@/context/AuthContext';
import type {
  WorkActivity,
  WorkChannelType,
  WorkDocBlock,
  WorkDocStatus,
  WorkDocType,
  WorkObjectType,
  WorkProjectPriority,
  WorkProjectStatus,
  WorkRelationType,
  WorkSavedViewScopeType,
  WorkTaskStatus,
  WorkTaskType,
  WorkThreadType,
  WorkVisibility,
} from '@/types/workos';

const PROJECT_STATUS_LABELS: Record<WorkProjectStatus, string> = {
  planning: 'تخطيط',
  active: 'نشط',
  on_hold: 'متوقف',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  archived: 'مؤرشف',
};

const TASK_STATUS_LABELS: Record<WorkTaskStatus, string> = {
  backlog: 'متراكم',
  todo: 'للعمل',
  in_progress: 'قيد التنفيذ',
  blocked: 'متعثر',
  in_review: 'قيد المراجعة',
  done: 'منجز',
  cancelled: 'ملغي',
  archived: 'مؤرشف',
};

const DOC_STATUS_LABELS: Record<WorkDocStatus, string> = {
  draft: 'مسودة',
  published: 'منشور',
  archived: 'مؤرشف',
};

const PRIORITY_LABELS: Record<WorkProjectPriority, string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'مرتفعة',
  urgent: 'عاجلة',
};

const RELATION_LABELS: Record<WorkRelationType, string> = {
  created_from: 'أُنشئ من',
  discussed_in: 'نوقش في',
  references: 'يشير إلى',
  belongs_to: 'يتبع',
  fulfills: 'يحقق',
};

const OBJECT_LABELS: Record<WorkObjectType, string> = {
  team_space: 'مساحة فريق',
  project: 'مشروع',
  task: 'مهمة',
  doc: 'مستند',
  channel: 'قناة',
  thread: 'نقاش',
  message: 'رسالة',
  saved_view: 'عرض محفوظ',
};

function workOsErrorRawMessage(error: unknown): string {
  const parts: string[] = [];
  const add = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) parts.push(value.trim());
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
      const row = err as Record<string, unknown>;
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

export function normalizeWorkOsError(error: unknown, fallback = 'تعذر تنفيذ عملية WorkOS الآن.') {
  const raw = workOsErrorRawMessage(error);
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  if (/permission denied|row-level security|\brls\b|jwt expired|invalid jwt/i.test(lower)) {
    return 'لا يمكن إظهار بيانات WorkOS بسبب الصلاحيات أو الجلسة الحالية. حدّث الصفحة أو أعد تسجيل الدخول.';
  }
  if (/schema cache|could not find a relationship|pgrst\d+|relation .+ does not exist|function .+ does not exist/i.test(lower)) {
    return 'خدمة WorkOS على الخادم غير متزامنة حاليًا مع الواجهة. حدّث الصفحة، وإن استمر الوضع راجع مسؤول النظام.';
  }
  if (raw.length > 220) return fallback;
  return raw;
}

export function formatWorkDate(value?: string | null, withTime = false) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('ar-AE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

export function formatRelativeTime(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat('ar-AE', { numeric: 'auto' });

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, 'day');
}

export function getProjectStatusLabel(status: WorkProjectStatus) {
  return PROJECT_STATUS_LABELS[status] ?? status;
}

export function getTaskStatusLabel(status: WorkTaskStatus) {
  return TASK_STATUS_LABELS[status] ?? status;
}

export function getDocStatusLabel(status: WorkDocStatus) {
  return DOC_STATUS_LABELS[status] ?? status;
}

export function getPriorityLabel(priority: WorkProjectPriority) {
  return PRIORITY_LABELS[priority] ?? priority;
}

export function getRelationLabel(type: WorkRelationType) {
  return RELATION_LABELS[type] ?? type;
}

export function getObjectLabel(type?: WorkObjectType | null) {
  if (!type) return 'عنصر';
  return OBJECT_LABELS[type] ?? type;
}

export function getStatusTone(status?: string | null) {
  switch (status) {
    case 'active':
    case 'published':
    case 'done':
    case 'completed':
      return 'emerald';
    case 'planning':
    case 'todo':
    case 'draft':
    case 'open':
      return 'sky';
    case 'in_progress':
    case 'in_review':
    case 'resolved':
      return 'cyan';
    case 'blocked':
    case 'on_hold':
      return 'amber';
    case 'cancelled':
    case 'archived':
      return 'slate';
    default:
      return 'slate';
  }
}

export function getPriorityTone(priority?: string | null) {
  switch (priority) {
    case 'urgent':
      return 'rose';
    case 'high':
      return 'amber';
    case 'medium':
      return 'cyan';
    case 'low':
      return 'slate';
    default:
      return 'slate';
  }
}

export function buildWorkSearchHref(kind: WorkSearchResultKind, id: string) {
  switch (kind) {
    case 'project':
      return `/work/projects/${id}`;
    case 'doc':
      return `/work/docs?doc=${id}`;
    case 'task':
      return `/work/projects?task=${id}`;
    case 'channel':
      return `/work/channels?channel=${id}`;
    default:
      return '/work';
  }
}

type WorkSearchResultKind = 'project' | 'doc' | 'task' | 'channel';

export function isWorkAdminRole(role?: AppRole | null) {
  return role === 'owner' || role === 'master_admin' || role === 'branch_manager';
}

export function getQuickWorkLinks() {
  return [
    {
      label: 'عملي اليوم',
      description: 'قائمة المهام المرتبطة بك مع الأولويات الحالية.',
      href: '/work',
    },
    {
      label: 'المشاريع',
      description: 'متابعة المشاريع والمهام والوثائق المرتبطة بها.',
      href: '/work/projects',
    },
    {
      label: 'البريد الداخلي',
      description: 'التنبيهات والأنشطة التي تحتاج متابعة سريعة.',
      href: '/work/inbox',
    },
    {
      label: 'البحث',
      description: 'بحث سريع في المشاريع والمستندات والقنوات والمهام.',
      href: '/work/search',
    },
  ];
}

export const WORK_VISIBILITY_OPTIONS: Array<{ value: WorkVisibility; label: string }> = [
  { value: 'internal', label: 'داخلية' },
  { value: 'private', label: 'خاصة' },
];

export const WORK_PROJECT_STATUS_OPTIONS: Array<{ value: WorkProjectStatus; label: string }> = [
  { value: 'planning', label: getProjectStatusLabel('planning') },
  { value: 'active', label: getProjectStatusLabel('active') },
  { value: 'on_hold', label: getProjectStatusLabel('on_hold') },
  { value: 'completed', label: getProjectStatusLabel('completed') },
  { value: 'cancelled', label: getProjectStatusLabel('cancelled') },
];

export const WORK_TASK_STATUS_OPTIONS: Array<{ value: WorkTaskStatus; label: string }> = [
  { value: 'backlog', label: getTaskStatusLabel('backlog') },
  { value: 'todo', label: getTaskStatusLabel('todo') },
  { value: 'in_progress', label: getTaskStatusLabel('in_progress') },
  { value: 'blocked', label: getTaskStatusLabel('blocked') },
  { value: 'in_review', label: getTaskStatusLabel('in_review') },
  { value: 'done', label: getTaskStatusLabel('done') },
  { value: 'cancelled', label: getTaskStatusLabel('cancelled') },
];

export const WORK_PRIORITY_OPTIONS: Array<{ value: WorkProjectPriority; label: string }> = [
  { value: 'low', label: getPriorityLabel('low') },
  { value: 'medium', label: getPriorityLabel('medium') },
  { value: 'high', label: getPriorityLabel('high') },
  { value: 'urgent', label: getPriorityLabel('urgent') },
];

export const WORK_DOC_TYPE_OPTIONS: Array<{ value: WorkDocType; label: string }> = [
  { value: 'page', label: 'صفحة' },
  { value: 'spec', label: 'مواصفة' },
  { value: 'meeting_note', label: 'محضر اجتماع' },
  { value: 'decision', label: 'قرار' },
  { value: 'runbook', label: 'دليل تشغيل' },
  { value: 'wiki', label: 'ويكي' },
];

export const WORK_DOC_STATUS_OPTIONS: Array<{ value: WorkDocStatus; label: string }> = [
  { value: 'draft', label: getDocStatusLabel('draft') },
  { value: 'published', label: getDocStatusLabel('published') },
  { value: 'archived', label: getDocStatusLabel('archived') },
];

export const WORK_CHANNEL_TYPE_OPTIONS: Array<{ value: WorkChannelType; label: string }> = [
  { value: 'team', label: 'فريق' },
  { value: 'project', label: 'مشروع' },
  { value: 'announcement', label: 'إعلان' },
  { value: 'topic', label: 'موضوع' },
  { value: 'dm', label: 'مباشرة' },
];

export const WORK_THREAD_TYPE_OPTIONS: Array<{ value: WorkThreadType; label: string }> = [
  { value: 'discussion', label: getThreadTypeLabel('discussion') },
  { value: 'decision', label: getThreadTypeLabel('decision') },
  { value: 'incident', label: getThreadTypeLabel('incident') },
  { value: 'question', label: getThreadTypeLabel('question') },
  { value: 'action', label: getThreadTypeLabel('action') },
];

export const WORK_TASK_TYPE_OPTIONS: Array<{ value: WorkTaskType; label: string }> = [
  { value: 'task', label: 'مهمة' },
  { value: 'bug', label: 'خلل' },
  { value: 'request', label: 'طلب' },
  { value: 'note', label: 'ملاحظة' },
  { value: 'action', label: 'إجراء' },
];

export function canContributeWorkRole(role?: AppRole | null) {
  if (!role) return false;
  return role !== 'viewer';
}

export function buildWorkSlug(input: string, prefix = 'work') {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (normalized) return normalized;
  return `${prefix}-${Date.now().toString(36)}`;
}

export function toNullableText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function toNullableDate(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function toNullableUuid(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function getThreadTypeLabel(type: WorkThreadType) {
  switch (type) {
    case 'decision':
      return 'قرار';
    case 'incident':
      return 'حادثة';
    case 'question':
      return 'سؤال';
    case 'action':
      return 'إجراء';
    default:
      return 'نقاش';
  }
}

export function getSavedViewScopeLabel(scope: WorkSavedViewScopeType) {
  switch (scope) {
    case 'team_space':
      return 'على مستوى المساحة';
    case 'project':
      return 'على مستوى المشروع';
    case 'tenant':
      return 'على مستوى التينانت';
    default:
      return 'شخصي';
  }
}

export function getActivityTypeLabel(activityType: string) {
  const normalized = activityType.trim().toLowerCase();
  const labels: Record<string, string> = {
    team_space_created: 'إنشاء مساحة',
    team_space_updated: 'تحديث مساحة',
    project_created: 'إنشاء مشروع',
    project_updated: 'تحديث مشروع',
    task_created: 'إنشاء مهمة',
    task_updated: 'تحديث مهمة',
    task_quick_updated: 'تحديث سريع لمهمة',
    task_created_from_thread: 'تحويل نقاش إلى مهمة',
    task_created_from_doc: 'تحويل مستند إلى مهمة',
    doc_created: 'إنشاء مستند',
    doc_updated: 'تحديث مستند',
    doc_block_added: 'إضافة كتلة',
    channel_created: 'إنشاء قناة',
    channel_updated: 'تحديث قناة',
    thread_created: 'إنشاء نقاش',
    message_created: 'إضافة رسالة',
    object_linked: 'ربط عناصر',
    object_archived: 'أرشفة',
    saved_view_created: 'حفظ عرض',
    saved_view_updated: 'تحديث عرض محفوظ',
  };

  return labels[normalized] ?? normalized.replace(/_/g, ' ');
}

export function groupActivitiesByDay(activities: WorkActivity[]) {
  const formatter = new Intl.DateTimeFormat('ar-AE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return activities.reduce<Array<{ key: string; label: string; items: WorkActivity[] }>>((groups, activity) => {
    const date = new Date(activity.created_at);
    const key = Number.isNaN(date.getTime()) ? activity.created_at : date.toISOString().slice(0, 10);
    const label = Number.isNaN(date.getTime()) ? 'غير معروف' : formatter.format(date);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup?.key === key) {
      lastGroup.items.push(activity);
      return groups;
    }

    groups.push({ key, label, items: [activity] });
    return groups;
  }, []);
}

export function getDocBlockText(block: WorkDocBlock) {
  const content = block.content ?? {};
  const text = typeof content.text === 'string' ? content.text.trim() : '';
  if (text) return text;

  const title = typeof content.title === 'string' ? content.title.trim() : '';
  if (title) return title;

  const label = typeof content.label === 'string' ? content.label.trim() : '';
  if (label) return label;

  if (block.block_type === 'divider') return 'فاصل';
  return 'لا توجد محتويات نصية لهذه الكتلة بعد.';
}

export function getDocBlockLabel(block: WorkDocBlock) {
  switch (block.block_type) {
    case 'heading':
      return 'عنوان';
    case 'checklist_item':
    case 'todo':
      return 'عنصر إجراء';
    case 'quote':
      return 'اقتباس';
    case 'code':
      return 'كود';
    case 'callout':
      return 'تنبيه';
    case 'divider':
      return 'فاصل';
    default:
      return 'فقرة';
  }
}
