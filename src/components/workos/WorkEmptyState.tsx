import React from 'react';
import { Inbox } from 'lucide-react';

interface WorkEmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

const WorkEmptyState: React.FC<WorkEmptyStateProps> = ({ title, description, action, icon }) => {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00CFFF]/10 text-[#071C3B]">
        {icon ?? <Inbox size={24} />}
      </div>
      <h3 className="mt-4 text-lg font-black text-[#071C3B]">{title}</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-slate-500">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
};

export default WorkEmptyState;
