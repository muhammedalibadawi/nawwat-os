import React from 'react';
import { LucideIcon, ArrowUp, ArrowDown, Minus, AlertCircle } from 'lucide-react';

export type KpiTrend = 'up' | 'down' | 'warn' | 'neutral';

interface KpiCardProps {
    title: string;
    value: string;
    delta: string;
    trend: KpiTrend;
    colorHex: string; // e.g., '#00E5FF' 
    icon: React.ReactNode;
}

const trendStyles: Record<KpiTrend, { text: string; Icon: LucideIcon }> = {
    up: { text: "text-success", Icon: ArrowUp },
    down: { text: "text-danger", Icon: ArrowDown },
    warn: { text: "text-warning", Icon: AlertCircle },
    neutral: { text: "text-content-3", Icon: Minus },
};

export const KpiCard: React.FC<KpiCardProps> = ({ title, value, delta, trend, colorHex, icon }) => {
    const { text: trendColorClass, Icon: TrendIcon } = trendStyles[trend];

    return (
    <div 
      className="bg-surface-card rounded-[var(--radius)] p-[18px] shadow-sm relative overflow-hidden transition-all duration-250 ease-spring border border-transparent hover:-translate-y-0.5 hover:shadow-md group cursor-default"
    >
      {/* Top Animated Border Line */}
      <div 
        className="absolute top-0 start-0 end-0 h-[3px] opacity-0 transition-opacity duration-250 ease-spring group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, ${colorHex}, transparent)` }}
      />
      
      {/* Icon */}
      <div 
        className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center mb-3.5 text-[1.2rem]"
        style={{ backgroundColor: `${colorHex}15`, color: colorHex }}
      >
        {icon}
      </div>

      <div className="text-[0.71rem] font-bold text-content-3 tracking-[0.4px] uppercase whitespace-nowrap overflow-hidden text-ellipsis text-start">
        {title}
      </div>
      
      <div className="font-nunito text-[1.65rem] font-black text-midnight my-[3px] leading-[1.1] text-start">
        {value}
      </div>

      <div className={`inline-flex items-center gap-[3px] text-[0.72rem] font-bold ${trendColorClass}`}>
        <TrendIcon size={12} strokeWidth={3} />
        {delta}
      </div>
    </div>
  );
};
