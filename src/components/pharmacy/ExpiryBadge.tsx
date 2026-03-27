import React from 'react';
import { AlertTriangle, CheckCircle2, TimerReset } from 'lucide-react';
import { formatDate, getExpiryState, getExpiryStateLabel } from '@/utils/pharmacy';

interface ExpiryBadgeProps {
  expiryDate?: string | null;
  compact?: boolean;
}

const ExpiryBadge: React.FC<ExpiryBadgeProps> = ({ expiryDate, compact = false }) => {
  const state = getExpiryState(expiryDate);
  const label = getExpiryStateLabel(expiryDate);

  const styles =
    state === 'expired'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : state === 'near'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  const Icon = state === 'expired' ? AlertTriangle : state === 'near' ? TimerReset : CheckCircle2;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${styles}`}
      title={expiryDate ? `تاريخ الصلاحية: ${formatDate(expiryDate)}` : undefined}
    >
      <Icon size={12} />
      {compact ? label : `${label}${expiryDate ? ` • ${formatDate(expiryDate)}` : ''}`}
    </span>
  );
};

export default ExpiryBadge;
