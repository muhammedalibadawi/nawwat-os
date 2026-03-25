import { Minus, Pencil, Plus, Receipt, Send, Trash2, Wallet } from 'lucide-react';
import type {
    RestaurantDraftLine,
    RestaurantLiveOrder,
    RestaurantOrderSummary,
    RestaurantSettings,
    RestaurantTable,
} from '@/services/restaurantService';
import { formatRestaurantMoney } from '@/services/restaurantService';

interface CurrentOrderPanelProps {
    table: RestaurantTable | null;
    settings: RestaurantSettings;
    lines: RestaurantDraftLine[];
    summary: RestaurantOrderSummary;
    liveOrder: RestaurantLiveOrder | null;
    sending?: boolean;
    processingPayment?: boolean;
    canEdit?: boolean;
    onIncrease: (index: number) => void;
    onDecrease: (index: number) => void;
    onRemove: (index: number) => void;
    onEditNotes: (index: number) => void;
    onSend: () => void;
    onPay: () => void;
    onCancel: () => void;
}

export function CurrentOrderPanel({
    table,
    settings,
    lines,
    summary,
    liveOrder,
    sending,
    processingPayment,
    canEdit = true,
    onIncrease,
    onDecrease,
    onRemove,
    onEditNotes,
    onSend,
    onPay,
    onCancel,
}: CurrentOrderPanelProps) {
    const hasDraft = lines.length > 0;
    const hasLiveOrder = Boolean(liveOrder);
    const displayLines = hasDraft
        ? lines.map((line) => ({
              id: line.menu_item_id,
              title: line.name_ar || line.name,
              quantity: line.quantity,
              price: (line.unit_price + line.modifiers.reduce((sum, modifier) => sum + modifier.price_delta, 0)) * line.quantity,
              notes: line.notes,
              modifiers: line.modifiers.map((modifier) => modifier.name_ar || modifier.name),
          }))
        : (liveOrder?.items ?? []).map((line) => ({
              id: line.id,
              title: line.item_name_ar || line.item_name,
              quantity: line.quantity,
              price: line.line_total,
              notes: line.notes || '',
              modifiers: line.modifiers.map((modifier) => modifier.name_ar || modifier.name),
          }));

    const totalSummary = hasDraft
        ? summary
        : {
              subtotal: liveOrder?.subtotal ?? 0,
              tax: liveOrder?.tax_amount ?? 0,
              service: liveOrder?.service_amount ?? 0,
              total: liveOrder?.total ?? 0,
          };

    return (
        <div className="flex h-full flex-col rounded-[32px] border border-slate-200 bg-white shadow-sm" dir="rtl">
            <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-bold tracking-[0.3em] text-slate-400">CURRENT ORDER</p>
                        <h2 className="mt-1 text-2xl font-black text-[#071C3B]">
                            {table ? `الطاولة ${table.label}` : 'اختر طاولة'}
                        </h2>
                        <p className="mt-2 text-sm text-slate-500">
                            {hasLiveOrder
                                ? `الطلب المباشر ${liveOrder?.order_no} جاهز للدفع أو المتابعة.`
                                : hasDraft
                                  ? 'جهّز الطلب ثم أرسله إلى المطبخ؛ بعد الإرسال ستظهر التذاكر في شاشة KDS لمحطة التحضير المحددة للصنف.'
                                  : table
                                    ? 'السبب: لا يوجد طلب حي على هذه الطاولة حاليًا. أضف أصنافًا من القائمة ثم «إرسال للمطبخ»، أو تأكد أن الطلب أُنشئ من نفس الفرع.'
                                    : 'السبب: لم يتم اختيار طاولة بعد. اختر طاولة من المخطط ثم أضف الأصناف من تبويب القائمة.'}
                        </p>
                    </div>
                    {(table || liveOrder) && (
                        <span className="rounded-full bg-[#071C3B]/5 px-4 py-2 text-xs font-bold text-[#071C3B]">
                            {hasLiveOrder ? liveOrder?.status : table?.status}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                {displayLines.length === 0 ? (
                    <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50 text-center text-slate-500">
                        <Receipt className="mb-3 h-10 w-10 text-cyan" />
                        <h3 className="text-lg font-black text-slate-800">لا يوجد بنود في الطلب</h3>
                        <p className="mt-2 max-w-xs text-sm">
                            {table && !hasLiveOrder
                                ? 'السبب: لا توجد مسودة ولا طلب مفتوح على الطاولة الحالية. أضف أصنافًا من القائمة أو اختر طاولة أخرى إن كان الطلب عليها.'
                                : 'السبب: لا توجد بيانات طلب جاهزة للعرض بعد (قد يكون بسبب عدم اختيار طاولة أو mismatch فرع/tenant). اختر طاولة ثم أضف الأصناف.'}
                        </p>
                    </div>
                ) : (
                    displayLines.map((line, index) => (
                        <article key={line.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-base font-black text-[#071C3B]">{line.title}</h3>
                                    {line.modifiers.length > 0 && (
                                        <p className="mt-2 text-xs font-bold text-slate-500">
                                            {line.modifiers.join(' + ')}
                                        </p>
                                    )}
                                    {line.notes && (
                                        <p className="mt-2 rounded-2xl bg-white px-3 py-2 text-xs font-medium text-slate-500">
                                            {line.notes}
                                        </p>
                                    )}
                                </div>
                                <span className="text-sm font-black text-[#071C3B]">
                                    {formatRestaurantMoney(line.price, settings.default_currency)}
                                </span>
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-3">
                                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1">
                                    <button
                                        type="button"
                                        disabled={!hasDraft || !canEdit}
                                        onClick={() => onDecrease(index)}
                                        className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <span className="min-w-8 text-center text-sm font-black text-[#071C3B]">{line.quantity}</span>
                                    <button
                                        type="button"
                                        disabled={!hasDraft || !canEdit}
                                        onClick={() => onIncrease(index)}
                                        className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>

                                {hasDraft && canEdit && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onEditNotes(index)}
                                            className="rounded-full bg-white p-2 text-slate-500 transition hover:bg-slate-100 hover:text-[#071C3B]"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onRemove(index)}
                                            className="rounded-full bg-white p-2 text-rose-500 transition hover:bg-rose-50"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </article>
                    ))
                )}
            </div>

            <div className="border-t border-slate-200 px-6 py-5">
                <div className="space-y-3 rounded-[24px] bg-[#071C3B] p-5 text-white">
                    <div className="flex items-center justify-between text-sm text-white/75">
                        <span>الإجمالي قبل الضريبة</span>
                        <span>{formatRestaurantMoney(totalSummary.subtotal, settings.default_currency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-white/75">
                        <span>الضريبة</span>
                        <span>{formatRestaurantMoney(totalSummary.tax, settings.default_currency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-white/75">
                        <span>الخدمة</span>
                        <span>{formatRestaurantMoney(totalSummary.service, settings.default_currency)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-3 text-lg font-black">
                        <span>الإجمالي</span>
                        <span className="text-cyan">{formatRestaurantMoney(totalSummary.total, settings.default_currency)}</span>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3">
                    <button
                        type="button"
                        disabled={!table || !hasDraft || sending}
                        onClick={onSend}
                        className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-cyan px-5 py-4 text-base font-black text-[#071C3B] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Send size={18} />
                        {sending ? 'جارٍ الإرسال...' : 'إرسال للمطبخ'}
                    </button>
                    <button
                        type="button"
                        disabled={!table || (!hasDraft && !hasLiveOrder) || processingPayment}
                        onClick={onPay}
                        className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-[#071C3B] px-5 py-4 text-base font-black text-white transition hover:bg-[#0d2951] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Wallet size={18} />
                        {processingPayment ? 'جارٍ إتمام الدفع...' : 'الدفع'}
                    </button>
                    <button
                        type="button"
                        disabled={!table || (!hasDraft && !hasLiveOrder)}
                        onClick={onCancel}
                        className="rounded-[20px] border border-slate-200 px-5 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {hasLiveOrder ? 'إلغاء الطلب' : 'إلغاء المسودة'}
                    </button>
                </div>
            </div>
        </div>
    );
}
