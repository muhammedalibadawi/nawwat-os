import { useEffect, useState } from 'react';
import { CheckCheck, ChefHat, Clock3, Sparkles } from 'lucide-react';
import type { RestaurantKdsTicket } from '@/services/restaurantService';

interface KDSTicketCardProps {
    ticket: RestaurantKdsTicket;
    onAdvance: (ticket: RestaurantKdsTicket) => void;
}

function secondsSince(value: string) {
    return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
}

function formatAge(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
}

function ageStyle(seconds: number) {
    if (seconds >= 900) return 'border-rose-400/60 bg-rose-400/10 text-rose-200';
    if (seconds >= 480) return 'border-amber-300/60 bg-amber-300/10 text-amber-100';
    return 'border-cyan/35 bg-cyan/10 text-cyan';
}

export function KDSTicketCard({ ticket, onAdvance }: KDSTicketCardProps) {
    const [ageSeconds, setAgeSeconds] = useState(() => secondsSince(ticket.queued_at));

    useEffect(() => {
        const timer = window.setInterval(() => setAgeSeconds(secondsSince(ticket.queued_at)), 1000);
        return () => window.clearInterval(timer);
    }, [ticket.queued_at]);

    const nextLabel = ticket.status === 'pending' ? 'بدء التحضير' : ticket.status === 'preparing' ? 'جاهز' : 'أغلق';
    const nextIcon = ticket.status === 'pending' ? ChefHat : ticket.status === 'preparing' ? CheckCheck : Sparkles;

    const NextIcon = nextIcon;

    return (
        <article className={`overflow-hidden rounded-[28px] border bg-[#112B53] shadow-[0_18px_40px_rgba(0,0,0,0.24)] ${ageStyle(ageSeconds)}`}>
            <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
                <div>
                    <p className="text-[11px] font-bold tracking-[0.28em] text-white/40">TICKET</p>
                    <h3 className="mt-1 text-2xl font-black text-white">{ticket.ticket_no}</h3>
                    <p className="mt-2 text-sm font-bold text-white/65">
                        المحطة: <span className="text-cyan">{ticket.station}</span>
                    </p>
                </div>
                <div className="text-end">
                    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${ageStyle(ageSeconds)}`}>
                        <Clock3 size={13} />
                        {formatAge(ageSeconds)}
                    </div>
                    <p className="mt-2 text-xs font-bold text-white/40">{ticket.status}</p>
                </div>
            </div>

            <div className="space-y-3 px-5 py-4">
                {(Array.isArray(ticket.items_snapshot) ? ticket.items_snapshot : []).map((item, index) => (
                    <div key={`${ticket.id}-${index}`} className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h4 className="text-lg font-black text-white">{item.item_name_ar || item.item_name}</h4>
                                {item.modifiers && item.modifiers.length > 0 && (
                                    <p className="mt-1 text-xs font-bold text-cyan/80">
                                        {item.modifiers.map((modifier) => modifier.name_ar || modifier.name).join(' + ')}
                                    </p>
                                )}
                                {item.notes && <p className="mt-2 text-sm text-amber-100">{item.notes}</p>}
                            </div>
                            <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-black text-white">
                                x{item.quantity}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="border-t border-white/10 px-5 py-4">
                <button
                    type="button"
                    onClick={() => onAdvance(ticket)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-[20px] bg-cyan px-5 py-4 text-base font-black text-[#071C3B] transition hover:brightness-95"
                >
                    <NextIcon size={18} />
                    {nextLabel}
                </button>
            </div>
        </article>
    );
}
