import { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { RestaurantMenuItem, RestaurantSelectedModifier } from '@/services/restaurantService';
import { formatRestaurantMoney } from '@/services/restaurantService';

interface ModifiersModalProps {
    open: boolean;
    menuItem: RestaurantMenuItem | null;
    currency?: string;
    onClose: () => void;
    onConfirm: (modifiers: RestaurantSelectedModifier[]) => void;
}

export function ModifiersModal({ open, menuItem, currency = 'AED', onClose, onConfirm }: ModifiersModalProps) {
    const [selectedIds, setSelectedIds] = useState<Record<string, string[]>>({});

    useEffect(() => {
        if (!menuItem || !open) {
            setSelectedIds({});
            return;
        }

        const defaults = menuItem.modifier_groups.reduce<Record<string, string[]>>((acc, group) => {
            const picked = group.modifiers.filter((modifier) => modifier.is_default).map((modifier) => modifier.id);
            acc[group.id] = picked;
            return acc;
        }, {});
        setSelectedIds(defaults);
    }, [menuItem, open]);

    const selectedModifiers = useMemo(() => {
        if (!menuItem) return [];
        return menuItem.modifier_groups.flatMap((group) =>
            group.modifiers
                .filter((modifier) => (selectedIds[group.id] ?? []).includes(modifier.id))
                .map((modifier) => ({
                    id: modifier.id,
                    modifier_group_id: group.id,
                    name: modifier.name,
                    name_ar: modifier.name_ar,
                    price_delta: modifier.price_delta,
                }))
        );
    }, [menuItem, selectedIds]);

    if (!open || !menuItem) return null;

    const toggleModifier = (groupId: string, modifierId: string, maxSelect: number) => {
        setSelectedIds((current) => {
            const existing = current[groupId] ?? [];
            if (existing.includes(modifierId)) {
                return {
                    ...current,
                    [groupId]: existing.filter((id) => id !== modifierId),
                };
            }
            if (maxSelect === 1) {
                return { ...current, [groupId]: [modifierId] };
            }
            if (existing.length >= maxSelect) return current;
            return { ...current, [groupId]: [...existing, modifierId] };
        });
    };

    const isValid = menuItem.modifier_groups.every((group) => {
        const selectedCount = (selectedIds[group.id] ?? []).length;
        const min = group.min_select_override ?? group.min_select;
        return !group.is_required && !(group.required_override ?? false)
            ? selectedCount >= min
            : selectedCount >= Math.max(min, 1);
    });

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#071C3B]/55 p-4" dir="rtl">
            <div className="w-full max-w-3xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                    <div>
                        <p className="text-[11px] font-bold tracking-[0.3em] text-slate-400">MODIFIERS</p>
                        <h2 className="mt-1 text-2xl font-black text-[#071C3B]">{menuItem.display_name_ar || menuItem.display_name}</h2>
                        <p className="mt-2 text-sm text-slate-500">اختر الإضافات المطلوبة قبل إضافة الصنف إلى الطلب الحالي.</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200">
                        <X size={18} />
                    </button>
                </div>

                <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-6">
                    {menuItem.modifier_groups.map((group) => {
                        const maxSelect = group.max_select_override ?? group.max_select;
                        const minSelect = group.min_select_override ?? group.min_select;
                        const selected = selectedIds[group.id] ?? [];

                        return (
                            <section key={group.id} className="rounded-[28px] border border-slate-200 p-5">
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-black text-[#071C3B]">{group.name_ar || group.name}</h3>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {group.required_override || group.is_required ? 'مجموعة مطلوبة' : 'اختيارية'} · الحد الأدنى {minSelect} · الحد الأقصى {maxSelect}
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                                        {selected.length}/{maxSelect}
                                    </span>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    {group.modifiers.map((modifier) => {
                                        const active = selected.includes(modifier.id);
                                        return (
                                            <button
                                                key={modifier.id}
                                                type="button"
                                                onClick={() => toggleModifier(group.id, modifier.id, maxSelect)}
                                                className={`flex items-center justify-between rounded-[22px] border px-4 py-3 text-start transition ${
                                                    active
                                                        ? 'border-cyan bg-cyan/10 text-[#071C3B]'
                                                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                                }`}
                                            >
                                                <div>
                                                    <div className="font-black">{modifier.name_ar || modifier.name}</div>
                                                    <div className="mt-1 text-xs font-medium text-slate-500">
                                                        {modifier.price_delta > 0 ? `+ ${formatRestaurantMoney(modifier.price_delta, currency)}` : 'بدون تكلفة إضافية'}
                                                    </div>
                                                </div>
                                                <span className={`rounded-full p-1 ${active ? 'bg-cyan text-[#071C3B]' : 'bg-slate-100 text-slate-400'}`}>
                                                    <Check size={14} />
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>

                <div className="border-t border-slate-200 px-6 py-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-slate-50 px-4 py-3">
                        <div>
                            <p className="text-xs font-bold text-slate-500">إجمالي الإضافات</p>
                            <p className="text-lg font-black text-[#071C3B]">
                                {formatRestaurantMoney(selectedModifiers.reduce((sum, modifier) => sum + modifier.price_delta, 0), currency)}
                            </p>
                        </div>
                        {!isValid && <p className="text-sm font-bold text-rose-500">يرجى استكمال الاختيارات المطلوبة قبل التأكيد.</p>}
                    </div>
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="rounded-[18px] border border-slate-200 px-5 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50">
                            إلغاء
                        </button>
                        <button
                            type="button"
                            disabled={!isValid}
                            onClick={() => onConfirm(selectedModifiers)}
                            className="rounded-[18px] bg-cyan px-5 py-3 text-sm font-black text-[#071C3B] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            إضافة إلى الطلب
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
