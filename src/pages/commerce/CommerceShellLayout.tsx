import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const shellLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-xl px-4 py-2 text-xs font-black transition ${
    isActive
      ? 'bg-white/15 text-white ring-1 ring-cyan-400/40'
      : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
  }`;

/**
 * CommerceOS — unified shell for channel integrations + Channel Revenue layer.
 * Nested routes render via <Outlet /> (index = technical integrations, foundation/* = economics/contracts).
 */
const CommerceShellLayout: React.FC = () => {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col gap-4 px-4 pb-10 animate-fade-in" dir="rtl">
      <header className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-cyan-300/90">CommerceOS</p>
          <h1 className="text-xl font-black text-white tracking-tight">طبقة إيراد القنوات</h1>
          <p className="mt-1 max-w-2xl text-[0.8rem] font-bold leading-relaxed text-content-3">
            داخل NawwatOS: اقتصاديات القنوات والربحية والتشغيل — بدون storefront. يرتبط لاحقًا بـ CRM وWorkOS.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2">
          <NavLink to="/commerce" end className={shellLinkClass}>
            تكامل القنوات
          </NavLink>
          <NavLink to="/commerce/foundation" end={false} className={shellLinkClass}>
            اقتصاديات وعقود
          </NavLink>
        </nav>
      </header>
      <Outlet />
    </div>
  );
};

export default CommerceShellLayout;
