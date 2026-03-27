import React from 'react';
import { getStatusTone } from '@/utils/workos';

interface WorkStatusBadgeProps {
  label: string;
  tone?: string | null;
}

const toneClasses: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  sky: 'bg-sky-50 text-sky-700 border-sky-100',
  cyan: 'bg-cyan-50 text-cyan-800 border-cyan-100',
  amber: 'bg-amber-50 text-amber-800 border-amber-100',
  rose: 'bg-rose-50 text-rose-700 border-rose-100',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

const WorkStatusBadge: React.FC<WorkStatusBadgeProps> = ({ label, tone }) => {
  const resolvedTone = toneClasses[tone ?? getStatusTone(label)] ?? toneClasses.slate;

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${resolvedTone}`}>{label}</span>;
};

export default WorkStatusBadge;
