import React from 'react';

interface ActionButtonProps {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    onClick?: () => void;
}

export const ActionButton: React.FC<ActionButtonProps> = ({ icon, title, subtitle, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-3 p-[13px] rounded-[11px] cursor-pointer transition-all duration-250 ease-spring border border-border bg-surface-card text-start w-full hover:border-cyan hover:bg-cyan-dim hover:-translate-y-px hover:shadow-md"
        >
            <div className="text-[1.4rem] shrink-0">
                {icon}
            </div>
            <div className="flex-1 overflow-hidden">
                <div className="text-[0.82rem] font-bold text-content truncate">{title}</div>
                <div className="text-[0.71rem] text-content-3 mt-[1px] truncate">{subtitle}</div>
            </div>
        </button>
    );
};
