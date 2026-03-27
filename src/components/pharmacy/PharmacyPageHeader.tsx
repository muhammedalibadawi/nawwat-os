import React from 'react';

interface PharmacyPageHeaderProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}

const PharmacyPageHeader: React.FC<PharmacyPageHeaderProps> = ({ title, subtitle, actions }) => {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-gradient-to-l from-[#071C3B] via-[#0E2B57] to-[#123E74] p-6 text-white shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/75">{subtitle}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </div>
  );
};

export default PharmacyPageHeader;
