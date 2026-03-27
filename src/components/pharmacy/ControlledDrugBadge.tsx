import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface ControlledDrugBadgeProps {
  controlled: boolean;
  schedule?: string | null;
}

const ControlledDrugBadge: React.FC<ControlledDrugBadgeProps> = ({ controlled, schedule }) => {
  if (!controlled) return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1 text-xs font-bold text-fuchsia-800"
      title={schedule ? `جدول الرقابة: ${schedule}` : 'دواء خاضع للرقابة'}
    >
      <ShieldAlert size={12} />
      {schedule ? `Controlled • ${schedule}` : 'Controlled'}
    </span>
  );
};

export default ControlledDrugBadge;
