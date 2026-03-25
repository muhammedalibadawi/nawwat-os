import { Search, Sparkles, TimerReset, UtensilsCrossed } from 'lucide-react';
import type { RestaurantCategory, RestaurantMenuItem } from '@/services/restaurantService';

interface MenuGridProps {
    items: RestaurantMenuItem[];
    categories: RestaurantCategory[];
    activeCategoryId: string | 'all';
    searchTerm: string;
    loading?: boolean;
    disabled?: boolean;
    onCategoryChange: (categoryId: string | 'all') => void;
    onSearchTermChange: (value: string) => void;
    onSelectItem: (item: RestaurantMenuItem) => void;
}

export function MenuGrid({
    items,
    categories,
    activeCategoryId,
    searchTerm,
    loading,
    disabled,
    onCategoryChange,
    onSearchTermChange,
    onSelectItem,
}: MenuGridProps) {
    const filteredItems = items.filter((item) => {
        const categoryMatch = activeCategoryId === 'all' || item.category_id === activeCategoryId;
        const search = searchTerm.trim().toLowerCase();
        if (!search) return categoryMatch;
        const haystack = [item.display_name, item.display_name_ar, item.category_name, item.category_name_ar, item.description]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return categoryMatch && haystack.includes(search);
    });

    return (
        <div className="space-y-5" dir="rtl">
            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                        value={searchTerm}
                        onChange={(event) => onSearchTermChange(event.target.value)}
                        placeholder="ابحث عن صنف أو تصنيف..."
                        className="w-full border-none bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                    />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => onCategoryChange('all')}
                        className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                            activeCategoryId === 'all'
                                ? 'bg-[#071C3B] text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        الكل
                    </button>
                    {categories.map((category) => (
                        <button
                            key={category.id}
                            type="button"
                            onClick={() => onCategoryChange(category.id)}
                            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                                activeCategoryId === category.id
                                    ? 'bg-cyan text-[#071C3B]'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {category.name_ar || category.name}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 9 }).map((_, index) => (
                        <div key={index} className="h-44 animate-pulse rounded-[28px] border border-slate-200 bg-white shadow-sm" />
                    ))}
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500">
                    <Sparkles className="mx-auto mb-3 h-10 w-10 text-cyan" />
                    <h3 className="text-lg font-black text-slate-800">
                        {items.length === 0 ? 'لا توجد أصناف لهذا الفرع' : 'لا توجد أصناف مطابقة'}
                    </h3>
                    <p className="mt-2 text-sm">
                        {items.length === 0
                            ? 'السبب: لا توجد بيانات أصناف مهيأة لهذا الفرع. جرّب فرعًا آخر من القائمة، أو أضف أصنافًا من «إدارة القائمة».'
                            : 'السبب: لا توجد نتائج مطابقة لمعايير البحث/التصنيف الحالية. جرّب تغيير التصنيف أو مسح عبارة البحث.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredItems.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            disabled={disabled || !item.is_available}
                            onClick={() => onSelectItem(item)}
                            className={`overflow-hidden rounded-[28px] border bg-white text-start shadow-sm transition-all duration-200 ${
                                disabled || !item.is_available
                                    ? 'cursor-not-allowed border-slate-200 opacity-60'
                                    : 'border-slate-200 hover:-translate-y-1 hover:border-cyan hover:shadow-xl'
                            }`}
                        >
                            <div className="relative h-32 overflow-hidden bg-[linear-gradient(135deg,#071C3B_0%,#0A356A_55%,#00CFFF_100%)] px-5 py-4 text-white">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_45%)]" />
                                <div className="relative flex h-full flex-col justify-between">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="rounded-2xl bg-white/10 px-3 py-1 text-[11px] font-bold">
                                            {item.category_name_ar || item.category_name || 'بدون تصنيف'}
                                        </div>
                                        <span className={`rounded-full px-3 py-1 text-[11px] font-black ${item.is_available ? 'bg-emerald-400/20 text-emerald-100' : 'bg-white/10 text-white/60'}`}>
                                            {item.is_available ? 'متوفر' : 'غير متوفر'}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black">{item.display_name_ar || item.display_name}</h3>
                                        <p className="mt-1 text-sm text-white/75 line-clamp-2">{item.description || 'صنف مهيأ للبيع داخل المطعم.'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4 p-5">
                                <div className="flex items-center justify-between">
                                    <span className="text-2xl font-black text-[#071C3B]">AED {item.price.toFixed(2)}</span>
                                    <span className="rounded-full bg-cyan/10 px-3 py-1 text-xs font-bold text-[#071C3B]">
                                        هامش {item.margin_pct?.toFixed(0) ?? '0'}%
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs font-bold text-slate-500">
                                    <span className="rounded-2xl bg-slate-50 px-3 py-2 text-center">تكلفة {item.cost.toFixed(2)}</span>
                                    <span className="rounded-2xl bg-slate-50 px-3 py-2 text-center inline-flex items-center justify-center gap-1">
                                        <TimerReset size={12} />
                                        {item.prep_time_minutes} د
                                    </span>
                                    <span className="rounded-2xl bg-slate-50 px-3 py-2 text-center inline-flex items-center justify-center gap-1">
                                        <UtensilsCrossed size={12} />
                                        {item.modifier_groups.length}
                                    </span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
