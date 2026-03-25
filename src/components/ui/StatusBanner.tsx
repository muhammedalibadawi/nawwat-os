import React from 'react';

export type StatusBannerVariant = 'success' | 'error' | 'warning' | 'info';
export type StatusBannerTone = 'light' | 'dark';

const variantClasses: Record<StatusBannerVariant, string> = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    error: 'border-rose-200 bg-rose-50 text-rose-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    info: 'border-cyan-100 bg-cyan-50/70 text-cyan-900',
};

const darkVariantClasses: Record<StatusBannerVariant, string> = {
    success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    error: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
    warning: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    info: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
};

export function StatusBanner({
    variant,
    children,
    tone = 'light',
    className = '',
}: {
    variant: StatusBannerVariant;
    children: React.ReactNode;
    tone?: StatusBannerTone;
    className?: string;
}) {
    return (
        <div
            className={`rounded-[18px] border px-4 py-3 text-sm font-bold leading-relaxed ${
                tone === 'dark' ? darkVariantClasses[variant] : variantClasses[variant]
            } ${className}`}
        >
            {children}
        </div>
    );
}

