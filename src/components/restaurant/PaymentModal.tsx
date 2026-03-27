import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Landmark, Plus, Trash2, Wallet, X } from 'lucide-react';
import type { RestaurantPaymentMethod, RestaurantPaymentSplit } from '@/services/restaurantService';
import { formatRestaurantMoney } from '@/services/restaurantService';

interface PaymentModalProps {
    open: boolean;
    total: number;
    currency?: string;
    orderLabel?: string;
    loading?: boolean;
    onClose: () => void;
    onConfirm: (payments: RestaurantPaymentSplit[]) => void;
}

type PaymentMode = RestaurantPaymentMethod | 'mixed';

const methodIcons: Record<RestaurantPaymentMethod, typeof Wallet> = {
    cash: Wallet,
    card: CreditCard,
    transfer: Landmark,
};

const modeLabels: Record<PaymentMode, string> = {
    cash: 'نقد',
    card: 'بطاقة',
    transfer: 'تحويل',
    mixed: 'مختلط',
};

export function PaymentModal({ open, total, currency = 'AED', orderLabel, loading, onClose, onConfirm }: PaymentModalProps) {
    const [mode, setMode] = useState<PaymentMode>('cash');
    const [splits, setSplits] = useState<RestaurantPaymentSplit[]>([{ method: 'cash', amount: total }]);

    useEffect(() => {
        if (!open) return;
        setMode('cash');
        setSplits([{ method: 'cash', amount: total }]);
    }, [open, total]);

    const allocatedTotal = useMemo(() => splits.reduce((sum, payment) => sum + payment.amount, 0), [splits]);
    const remaining = Number((total - allocatedTotal).toFixed(2));
    const isValid = Math.abs(remaining) <= 0.05 && splits.every((payment) => payment.amount > 0);

    if (!open) return null;

    const handleModeChange = (nextMode: PaymentMode) => {
        setMode(nextMode);
        if (nextMode === 'mixed') {
            setSplits([
                { method: 'cash', amount: Number((total / 2).toFixed(2)) },
                { method: 'card', amount: Number((total - total / 2).toFixed(2)) },
            ]);
            return;
        }
        setSplits([{ method: nextMode, amount: total }]);
    };

    const updateSplit = (index: number, patch: Partial<RestaurantPaymentSplit>) => {
        setSplits((current) =>
            current.map((payment, paymentIndex) => (paymentIndex === index ? { ...payment, ...patch } : payment))
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#071C3B]/60 p-4" dir="rtl">
            <div className="w-full max-w-2xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                    <div>
                        <p className="text-[11px] font-bold tracking-[0.3em] text-slate-400">PAYMENT FLOW</p>
                        <h2 className="mt-1 text-2xl font-black text-[#071C3B]">إتمام الدفع</h2>
                        <p className="mt-2 text-sm text-slate-500">
                            {orderLabel ? `إنهاء ${orderLabel}` : 'أكمل عملية الدفع وسنقوم بإغلاق الطلب وطباعة الإيصال.'}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-6 px-6 py-6">
                    <div className="rounded-[28px] bg-[#071C3B] p-5 text-white">
                        <p className="text-sm text-white/70">الإجمالي المطلوب</p>
                        <p className="mt-2 text-4xl font-black text-cyan">{formatRestaurantMoney(total, currency)}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {(Object.keys(modeLabels) as PaymentMode[]).map((paymentMode) => {
                            const Icon = paymentMode === 'mixed' ? Plus : methodIcons[paymentMode as RestaurantPaymentMethod];
                            return (
                                <button
                                    key={paymentMode}
                                    type="button"
                                    onClick={() => handleModeChange(paymentMode)}
                                    className={`rounded-[24px] border px-4 py-4 text-center transition ${
                                        mode === paymentMode
                                            ? 'border-cyan bg-cyan/10 text-[#071C3B]'
                                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                    }`}
                                >
                                    <Icon className="mx-auto mb-2 h-5 w-5" />
                                    <span className="text-sm font-black">{modeLabels[paymentMode]}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="space-y-3 rounded-[28px] border border-slate-200 p-5">
                        {splits.map((payment, index) => (
                            <div key={index} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                                <select
                                    value={payment.method}
                                    onChange={(event) => updateSplit(index, { method: event.target.value as RestaurantPaymentMethod })}
                                    className="rounded-[18px] border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 outline-none"
                                >
                                    <option value="cash">نقد</option>
                                    <option value="card">بطاقة</option>
                                    <option value="transfer">تحويل</option>
                                </select>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={payment.amount}
                                    onChange={(event) => updateSplit(index, { amount: Number(event.target.value) })}
                                    className="rounded-[18px] border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 outline-none"
                                />
                                {mode === 'mixed' ? (
                                    <button
                                        type="button"
                                        onClick={() => setSplits((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                                        className="rounded-[18px] bg-rose-50 px-4 py-3 text-rose-500 transition hover:bg-rose-100"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                ) : (
                                    <div className="hidden md:block" />
                                )}
                            </div>
                        ))}

                        {mode === 'mixed' && (
                            <button
                                type="button"
                                onClick={() => setSplits((current) => [...current, { method: 'cash', amount: 0 }])}
                                className="inline-flex items-center gap-2 rounded-[18px] bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-200"
                            >
                                <Plus size={16} />
                                إضافة دفعة
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-slate-50 px-4 py-4">
                        <div>
                            <p className="text-xs font-bold text-slate-500">المتبقي</p>
                            <p className={`text-lg font-black ${Math.abs(remaining) <= 0.05 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                {formatRestaurantMoney(Math.max(remaining, 0), currency)}
                            </p>
                        </div>
                        <p className="text-sm text-slate-500">
                            يجب أن يساوي مجموع الدفعات {formatRestaurantMoney(total, currency)}
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-5">
                    <button type="button" onClick={onClose} className="rounded-[18px] border border-slate-200 px-5 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50">
                        إغلاق
                    </button>
                    <button
                        type="button"
                        disabled={!isValid || loading}
                        onClick={() => onConfirm(splits)}
                        className="rounded-[18px] bg-cyan px-5 py-3 text-sm font-black text-[#071C3B] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? 'جارٍ الدفع...' : 'تأكيد الدفع'}
                    </button>
                </div>
            </div>
        </div>
    );
}
