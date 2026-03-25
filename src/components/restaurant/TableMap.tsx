import { Clock3, Sparkles, Users, UtensilsCrossed } from 'lucide-react';
import type { RestaurantTable } from '@/services/restaurantService';

interface TableMapProps {
    tables: RestaurantTable[];
    loading?: boolean;
    selectedTableId?: string | null;
    onSelect: (table: RestaurantTable) => void;
}

const statusStyles: Record<RestaurantTable['status'], string> = {
    available: 'border-white/10 bg-white/5 text-white',
    occupied: 'border-cyan/50 bg-cyan/10 text-cyan',
    reserved: 'border-amber-400/50 bg-amber-400/10 text-amber-200',
    cleaning: 'border-rose-400/50 bg-rose-400/10 text-rose-200',
    inactive: 'border-white/10 bg-white/5 text-white/30',
};

const statusLabels: Record<RestaurantTable['status'], string> = {
    available: 'متاحة',
    occupied: 'مشغولة',
    reserved: 'محجوزة',
    cleaning: 'تنظيف',
    inactive: 'معطلة',
};

export function TableMap({ tables, loading, selectedTableId, onSelect }: TableMapProps) {
    if (loading) {
        return (
            <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-28 animate-pulse rounded-[24px] border border-white/10 bg-white/5" />
                ))}
            </div>
        );
    }

    if (tables.length === 0) {
        return (
            <div className="rounded-[28px] border border-dashed border-white/15 bg-white/5 px-5 py-10 text-center text-white/65">
                <Sparkles className="mx-auto mb-3 h-10 w-10 text-cyan" />
                <h3 className="text-lg font-black text-white">لا توجد طاولات بعد</h3>
                <p className="mt-2 text-sm">
                    السبب: لا توجد طاولات مهيأة للفرع الحالي. أضف طاولات من «إدارة القائمة» أو اختر فرعًا آخر لعرض المخطط. إن وُضعت بذور التجربة على فرع محدد فاختره من القائمة أعلاه.
                </p>
            </div>
        );
    }

    const areas = Array.from(
        tables.reduce((map, table) => {
            const key = table.area_name || 'القاعة الرئيسية';
            const bucket = map.get(key) ?? [];
            bucket.push(table);
            map.set(key, bucket);
            return map;
        }, new Map<string, RestaurantTable[]>())
    );

    return (
        <div className="space-y-5" dir="rtl">
            {areas.map(([areaName, areaTables]) => (
                <section key={areaName} className="space-y-3">
                    <div className="flex items-center justify-between text-white/70">
                        <h3 className="text-sm font-black tracking-wide text-white">{areaName}</h3>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold">
                            {areaTables.length} طاولة
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-1 2xl:grid-cols-2">
                        {areaTables.map((table) => {
                            const selected = table.id === selectedTableId;
                            return (
                                <button
                                    key={table.id}
                                    type="button"
                                    onClick={() => onSelect(table)}
                                    className={`group rounded-[24px] border p-4 text-start transition-all duration-200 ${
                                        statusStyles[table.status]
                                    } ${selected ? 'ring-2 ring-cyan shadow-[0_0_0_1px_rgba(0,207,255,0.4)]' : 'hover:-translate-y-0.5 hover:shadow-xl'}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] font-bold tracking-[0.25em] text-white/45">TABLE</p>
                                            <h4 className="mt-1 text-2xl font-black">{table.label}</h4>
                                        </div>
                                        <span className="rounded-full border border-current/20 px-3 py-1 text-[11px] font-bold">
                                            {statusLabels[table.status]}
                                        </span>
                                    </div>

                                    <div className="mt-4 flex items-center gap-3 text-sm text-white/75">
                                        <span className="inline-flex items-center gap-1.5">
                                            <Users size={14} />
                                            {table.seats} مقاعد
                                        </span>
                                        {table.active_order_no && (
                                            <span className="inline-flex items-center gap-1.5">
                                                <UtensilsCrossed size={14} />
                                                {table.active_order_no}
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-3 flex items-center justify-between">
                                        <span className="text-xs text-white/55">{table.code || 'بدون رمز'}</span>
                                        {table.active_total ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white">
                                                <Clock3 size={12} />
                                                AED {table.active_total.toFixed(2)}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-white/45">اضغط لبدء الطلب</span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}
