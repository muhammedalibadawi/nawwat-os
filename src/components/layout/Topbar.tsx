import React from 'react';
import { useAppContext } from '../../store/AppContext';
import { Menu, Search, Bell, HelpCircle } from 'lucide-react';

export const Topbar: React.FC = () => {
    const { toggleSidebar, tenantName, branchName, isRTL, toggleRTL } = useAppContext();

    return (
        <div className="h-[var(--topbar-h)] bg-surface-card border-b border-border flex items-center pe-4 gap-0 shrink-0 relative z-50 shadow-xs">

            {/* Sidebar Toggle */}
            <button
                onClick={toggleSidebar}
                className="w-[var(--sidebar-mini)] h-full border-none bg-transparent flex items-center justify-center cursor-pointer text-content-3 shrink-0 transition-colors hover:bg-surface-bg hover:text-content border-e border-border"
            >
                <Menu size={18} strokeWidth={2.2} />
            </button>

            {/* Brand */}
            <div className="font-nunito font-black text-lg text-midnight px-4 whitespace-nowrap shrink-0">
                Nawwat<span className="text-cyan">OS</span>
            </div>

            <div className="w-px h-6 bg-border shrink-0" />

            {/* Breadcrumb / Branch Name */}
            <div className="flex items-center gap-1.5 px-4 text-xs text-content-3">
                <span className="opacity-40">{tenantName}</span>
                <span className="opacity-40">/</span>
                <span className="text-content font-semibold">{branchName}</span>
            </div>

            <div className="flex-1" />


            {/* Search */}
            <div className="hidden md:flex items-center bg-surface-bg border border-border rounded-[10px] px-3 py-1.5 gap-2 w-60 me-3 transition-colors focus-within:border-cyan/40 focus-within:bg-white focus-within:ring-2 focus-within:ring-cyan-dim">
                <Search size={14} className="text-content-4 shrink-0" />
                <input
                    type="text"
                    placeholder="Search modules, transactions…"
                    className="border-none bg-transparent outline-none text-[0.82rem] text-content w-full placeholder:text-content-4"
                />
            </div>

            {/* Status Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-success-dim border border-success/20 rounded-full text-[0.71rem] font-bold text-success me-3 whitespace-nowrap">
                <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                All Systems Online
            </div>

            {/* Action Icons */}
            <button className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer text-content-3 relative transition-colors hover:bg-surface-bg-2 hover:text-content me-1 bg-surface-bg border-none">
                <Bell size={16} strokeWidth={2} />
                <span className="absolute top-1.5 end-1.5 w-1.5 h-1.5 bg-danger rounded-full border border-white animate-pulse" />
            </button>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer text-content-3 relative transition-colors hover:bg-surface-bg-2 hover:text-content me-1 bg-surface-bg border-none">
                <HelpCircle size={16} strokeWidth={2} />
            </button>

            {/* Avatar & Tenant Info */}
            <div className="w-8 h-8 bg-gradient-to-br from-cyan to-blue-600 rounded-lg flex items-center justify-center font-nunito font-extrabold text-xs text-white cursor-pointer me-1 shrink-0 shadow-[0_2px_8px_rgba(0,229,255,0.3)]">
                AH
            </div>
            <div className="text-[0.7rem] text-content-3 font-semibold border-s border-border ps-3 ms-1 whitespace-nowrap">
                {tenantName || '—'}
            </div>

        </div>
    );
};
