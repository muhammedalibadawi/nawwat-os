import React from 'react';

export type BadgeVariant = 'cyan' | 'green' | 'red' | 'warn' | 'indigo' | 'purple' | 'gray' | 'midnight' | 'orange';

interface StatusBadgeProps {
    text: string;
    variant?: BadgeVariant;
    className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
    cyan: "bg-cyan-dim text-[#007a94]",
    green: "bg-success/10 text-[#03a07a]",
    red: "bg-danger/10 text-danger",
    warn: "bg-warning/12 text-[#9a6600]",
    indigo: "bg-indigo/10 text-indigo",
    purple: "bg-purple/10 text-purple",
    gray: "bg-midnight/5 text-content-2",
    midnight: "bg-midnight text-white/70",
    orange: "bg-orange/10 text-orange",
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ text, variant = 'gray', className = '' }) => {
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.69rem] font-bold whitespace-nowrap ${variantStyles[variant]} ${className}`}>
      {text}
    </span>
  );
};
