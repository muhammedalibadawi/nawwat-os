import { useEffect, useMemo, useState } from 'react';
import { ChefHat, ClipboardList, LayoutGrid, Store, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { CurrentOrderPanel } from '@/components/restaurant/CurrentOrderPanel';
import { MenuGrid } from '@/components/restaurant/MenuGrid';
import { ModifiersModal } from '@/components/restaurant/ModifiersModal';
import { PaymentModal } from '@/components/restaurant/PaymentModal';
import { TableMap } from '@/components/restaurant/TableMap';
import { StatusBanner } from '@/components/ui/StatusBanner';
import type {
    RestaurantDraftLine,
    RestaurantLiveOrder,
    RestaurantMenuItem,
    RestaurantPaymentSplit,
    RestaurantPosSnapshot,
    RestaurantSelectedModifier,
    RestaurantTable,
} from '@/services/restaurantService';
import {
    calculateDraftSummary,
    completeRestaurantPayment,
    formatRestaurantMoney,
    loadRestaurantLiveOrderByTable,
    loadRestaurantPosSnapshot,
    safeRestaurantErrorMessage,
    sendRestaurantOrderToKitchen,
    toDraftLine,
    cancelRestaurantOrder,
} from '@/services/restaurantService';

type MobileTab = 'tables' | 'menu' | 'order';

function printReceipt(order: {
    branchLabel: string;
    tableLabel: string;
    invoiceNo: string;
    orderNo: string;
    currency: string;
    total: number;
    lines: Array<{ title: string; quantity: number; total: number }>;
}) {
    const receiptWindow = window.open('', '_blank', 'width=420,height=720');
    if (!receiptWindow) return;

    receiptWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>Receipt ${order.invoiceNo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #071C3B; }
            h1, h2, p { margin: 0; }
            .row { display: flex; justify-content: space-between; margin: 10px 0; }
            .divider { border-top: 1px dashed #cbd5e1; margin: 16px 0; }
            .muted { color: #64748b; font-size: 12px; }
            .title { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
            .total { font-size: 20px; font-weight: 700; color: #00A8D6; }
          </style>
        </head>
        <body>
          <h1 class="title">NawwatOS Restaurant Receipt</h1>
          <p class="muted">${order.branchLabel}</p>
          <p class="muted">الطاولة: ${order.tableLabel}</p>
          <p class="muted">Order: ${order.orderNo}</p>
          <p class="muted">Invoice: ${order.invoiceNo}</p>
          <div class="divider"></div>
          ${order.lines
              .map(
                  (line) => `
                <div class="row">
                  <span>${line.title} × ${line.quantity}</span>
                  <span>${formatRestaurantMoney(line.total, order.currency)}</span>
                </div>
              `
              )
              .join('')}
          <div class="divider"></div>
          <div class="row total">
            <span>الإجمالي</span>
            <span>${formatRestaurantMoney(order.total, order.currency)}</span>
          </div>
        </body>
      </html>
    `);
    receiptWindow.document.close();
    receiptWindow.focus();
    receiptWindow.print();
}

export default function RestaurantPOSScreen() {
    const { user } = useAuth();
    const [snapshot, setSnapshot] = useState<RestaurantPosSnapshot | null>(null);
    const [branchId, setBranchId] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshTick, setRefreshTick] = useState(0);
    const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
    const [liveOrder, setLiveOrder] = useState<RestaurantLiveOrder | null>(null);
    const [draftLines, setDraftLines] = useState<RestaurantDraftLine[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategoryId, setActiveCategoryId] = useState<string | 'all'>('all');
    const [modifiersOpen, setModifiersOpen] = useState(false);
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [selectedMenuItem, setSelectedMenuItem] = useState<RestaurantMenuItem | null>(null);
    const [sending, setSending] = useState(false);
    const [paying, setPaying] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [mobileTab, setMobileTab] = useState<MobileTab>('tables');
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
    const [noteDraft, setNoteDraft] = useState('');

    useEffect(() => {
        if (!success) return;
        const timer = window.setTimeout(() => setSuccess(''), 3600);
        return () => window.clearTimeout(timer);
    }, [success]);

    useEffect(() => {
        if (!user?.tenant_id) return;
        let cancelled = false;
        const tenantId = user.tenant_id;
        const defaultBranchId = user.branch_id;

        async function loadSnapshot() {
            setLoading(true);
            setError('');
            try {
                const targetBranchId = branchId || defaultBranchId;
                const nextSnapshot = await loadRestaurantPosSnapshot(tenantId, targetBranchId || defaultBranchId);
                if (cancelled) return;
                const resolvedBranchId = targetBranchId || nextSnapshot.branches[0]?.id || '';
                if (!resolvedBranchId) {
                    setSnapshot(nextSnapshot);
                    setBranchId('');
                    return;
                }
                if (resolvedBranchId !== targetBranchId) {
                    const hydratedSnapshot = await loadRestaurantPosSnapshot(tenantId, resolvedBranchId);
                    if (cancelled) return;
                    setSnapshot(hydratedSnapshot);
                } else {
                    setSnapshot(nextSnapshot);
                }
                setBranchId(resolvedBranchId);
            } catch (loadError) {
                if (!cancelled) {
                    setError(safeRestaurantErrorMessage(loadError, 'تعذر تحميل بيانات قطاع المطاعم'));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadSnapshot();

        return () => {
            cancelled = true;
        };
    }, [user?.branch_id, user?.tenant_id, branchId, refreshTick]);

    useEffect(() => {
        if (!user?.tenant_id || !selectedTable?.id) {
            setLiveOrder(null);
            return;
        }
        let cancelled = false;
        const tenantId = user.tenant_id;
        void loadRestaurantLiveOrderByTable(tenantId, selectedTable.id)
            .then((order) => {
                if (!cancelled) setLiveOrder(order);
            })
            .catch((loadError) => {
                if (!cancelled) {
                    setError(safeRestaurantErrorMessage(loadError, 'تعذر فتح الطلب الحالي لهذه الطاولة'));
                    setLiveOrder(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [selectedTable?.id, user?.tenant_id, refreshTick]);

    const summary = useMemo(
        () => calculateDraftSummary(draftLines, snapshot?.settings ?? {
            tenant_id: user?.tenant_id || '',
            branch_id: branchId || null,
            default_currency: 'AED',
            vat_rate: 5,
            service_charge_enabled: false,
            service_charge_rate: 0,
            rounding_mode: 'nearest_0.01',
        }),
        [branchId, draftLines, snapshot?.settings, user?.tenant_id]
    );

    const canEditDraft = Boolean(selectedTable && !liveOrder);

    const handleSelectTable = (table: RestaurantTable) => {
        if (draftLines.length > 0 && selectedTable?.id !== table.id) {
            const confirmed = window.confirm('لديك طلب غير محفوظ على طاولة أخرى. هل تريد تجاهله والانتقال؟');
            if (!confirmed) return;
            setDraftLines([]);
        }
        setSelectedTable(table);
        setError('');
        setSuccess('');
        setPaymentOpen(false);
        setEditingNoteIndex(null);
        setNoteDraft('');
        setSearchTerm('');
        setActiveCategoryId('all');
        setMobileTab('menu');
    };

    const addMenuItemToDraft = (menuItem: RestaurantMenuItem, modifiers: RestaurantSelectedModifier[] = []) => {
        setDraftLines((current) => {
            const existingIndex = current.findIndex((line) => line.menu_item_id === menuItem.id && JSON.stringify(line.modifiers) === JSON.stringify(modifiers));
            if (existingIndex >= 0) {
                return current.map((line, index) => index === existingIndex ? { ...line, quantity: line.quantity + 1 } : line);
            }
            return [...current, { ...toDraftLine(menuItem, modifiers) }];
        });
        setModifiersOpen(false);
        setSelectedMenuItem(null);
        setMobileTab('order');
    };

    const handleSelectMenuItem = (menuItem: RestaurantMenuItem) => {
        if (!selectedTable) {
            setError('اختر طاولة أولاً قبل إضافة الأصناف.');
            return;
        }
        if (liveOrder) {
            setError('تحرير الطلبات المرسلة غير مفعّل في هذه المرحلة. يمكنك الدفع أو الإلغاء.');
            return;
        }
        if (menuItem.modifier_groups.length > 0) {
            setSelectedMenuItem(menuItem);
            setModifiersOpen(true);
            return;
        }
        addMenuItemToDraft(menuItem);
    };

    const handleSendToKitchen = async () => {
        if (!selectedTable || !branchId || draftLines.length === 0) return;
        const tenantId = user?.tenant_id;
        const tableId = selectedTable.id;
        setSending(true);
        setError('');
        setSuccess('');
        try {
            const response = await sendRestaurantOrderToKitchen(branchId, tableId, {
                covers: Math.max(selectedTable.seats > 0 ? 1 : 1, 1),
                notes: '',
                items: draftLines,
            });

            setDraftLines([]);

            setRefreshTick((value) => value + 1);
            setMobileTab('order');

            let nextOrder: RestaurantLiveOrder | null = null;
            if (tenantId) {
                // backend view (fb_orders_live_v) قد لا تعكس الإرسال فورًا؛ جرّب إعادة التحميل لحظيًا.
                for (let attempt = 0; attempt < 3; attempt += 1) {
                    nextOrder = await loadRestaurantLiveOrderByTable(tenantId, tableId);
                    if (nextOrder) break;
                    await new Promise<void>((resolve) => window.setTimeout(resolve, 450));
                }
            }

            setLiveOrder(nextOrder);

            setSuccess(
                nextOrder
                    ? `تم إرسال الطلب ${String(response.order_no || '')} إلى المطبخ بنجاح. يمكنك الآن الدفع من شاشة نفس الطاولة.`
                    : `تم إرسال الطلب ${String(response.order_no || '')} إلى المطبخ بنجاح، لكن تعذر تحميل الطلب للدفع الآن. اختر الطاولة مرة أخرى خلال لحظات لإكمال الإجراء.`
            );
        } catch (sendError) {
            setError(safeRestaurantErrorMessage(sendError, 'تعذر إرسال الطلب إلى المطبخ'));
        } finally {
            setSending(false);
        }
    };

    const handlePayment = async (payments: RestaurantPaymentSplit[]) => {
        if (!selectedTable || !branchId) return;
        const tenantId = user?.tenant_id;
        if (!tenantId) return;
        setPaying(true);
        setError('');
        setSuccess('');

        let order = liveOrder;
        try {
            if (!order && draftLines.length > 0) {
                const response = await sendRestaurantOrderToKitchen(branchId, selectedTable.id, {
                    covers: 1,
                    notes: '',
                    items: draftLines,
                });
                setDraftLines([]);
                await Promise.resolve();
                order = await loadRestaurantLiveOrderByTable(tenantId, selectedTable.id);
                if (!order) {
                    throw new Error('تم إرسال الطلب ولكن تعذر تحميله لإكمال الدفع');
                }
                setLiveOrder(order);
                setSuccess(`تم إرسال الطلب ${String(response.order_no || '')} للمطبخ قبل الدفع.`);
            }

            if (!order) {
                throw new Error('لا يوجد طلب جاهز للدفع');
            }

            const paymentResult = await completeRestaurantPayment(order.id, payments);
            setPaymentOpen(false);
            setSuccess(`تم سداد الطلب ${order.order_no} وإنشاء الفاتورة ${String(paymentResult.invoice_no || '')}.`);

            printReceipt({
                branchLabel: snapshot?.branches.find((branch) => branch.id === branchId)?.name_ar || snapshot?.branches.find((branch) => branch.id === branchId)?.name || 'Restaurant',
                tableLabel: selectedTable.label,
                invoiceNo: String(paymentResult.invoice_no || ''),
                orderNo: order.order_no,
                currency: snapshot?.settings.default_currency || 'AED',
                total: order.total,
                lines: order.items.map((line) => ({
                    title: line.item_name_ar || line.item_name,
                    quantity: line.quantity,
                    total: line.line_total,
                })),
            });

            setSelectedTable(null);
            setLiveOrder(null);
            setDraftLines([]);
            setRefreshTick((value) => value + 1);
            setMobileTab('tables');
        } catch (paymentError) {
            setError(safeRestaurantErrorMessage(paymentError, 'تعذر إتمام الدفع'));
        } finally {
            setPaying(false);
        }
    };

    const handleCancel = async () => {
        setError('');
        setSuccess('');
        setPaymentOpen(false);
        setEditingNoteIndex(null);
        if (draftLines.length > 0) {
            setDraftLines([]);
            setSuccess('تم إلغاء مسودة الطلب الحالية.');
            return;
        }
        if (!liveOrder) return;
        try {
            await cancelRestaurantOrder(liveOrder.id, 'Cancelled from restaurant POS');
            setSuccess(`تم إلغاء الطلب ${liveOrder.order_no}.`);
            setLiveOrder(null);
            setSelectedTable(null);
            setRefreshTick((value) => value + 1);
            setMobileTab('tables');
        } catch (cancelError) {
            setError(safeRestaurantErrorMessage(cancelError, 'تعذر إلغاء الطلب الحالي'));
        }
    };

    const branchOptions = snapshot?.branches ?? [];
    const desktopSections = [
        {
            id: 'tables',
            label: 'الطاولات',
            icon: LayoutGrid,
            content: (
                <TableMap
                    tables={snapshot?.tables ?? []}
                    loading={loading}
                    selectedTableId={selectedTable?.id}
                    onSelect={handleSelectTable}
                />
            ),
        },
        {
            id: 'menu',
            label: 'القائمة',
            icon: Store,
            content: (
                <MenuGrid
                    items={snapshot?.menuItems ?? []}
                    categories={snapshot?.categories ?? []}
                    activeCategoryId={activeCategoryId}
                    searchTerm={searchTerm}
                    loading={loading}
                    disabled={!selectedTable || Boolean(liveOrder)}
                    onCategoryChange={setActiveCategoryId}
                    onSearchTermChange={setSearchTerm}
                    onSelectItem={handleSelectMenuItem}
                />
            ),
        },
        {
            id: 'order',
            label: 'الطلب',
            icon: ClipboardList,
            content: (
                <CurrentOrderPanel
                    table={selectedTable}
                    settings={snapshot?.settings ?? {
                        tenant_id: user?.tenant_id || '',
                        branch_id: branchId || null,
                        default_currency: 'AED',
                        vat_rate: 5,
                        service_charge_enabled: false,
                        service_charge_rate: 0,
                        rounding_mode: 'nearest_0.01',
                    }}
                    lines={draftLines}
                    summary={summary}
                    liveOrder={liveOrder}
                    sending={sending}
                    processingPayment={paying}
                    canEdit={canEditDraft}
                    onIncrease={(index) => setDraftLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, quantity: line.quantity + 1 } : line))}
                    onDecrease={(index) => setDraftLines((current) => current.flatMap((line, lineIndex) => {
                        if (lineIndex !== index) return [line];
                        if (line.quantity <= 1) return [];
                        return [{ ...line, quantity: line.quantity - 1 }];
                    }))}
                    onRemove={(index) => setDraftLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}
                    onEditNotes={(index) => {
                        setEditingNoteIndex(index);
                        setNoteDraft(draftLines[index]?.notes || '');
                    }}
                    onSend={handleSendToKitchen}
                    onPay={() => setPaymentOpen(true)}
                    onCancel={handleCancel}
                />
            ),
        },
    ] as const;

    return (
        <div className="-m-6 min-h-[calc(100vh-var(--topbar-h))] w-[calc(100%+3rem)] bg-[linear-gradient(180deg,#EEF9FF_0%,#F7FBFD_48%,#FFFFFF_100%)]" dir="rtl">
            <div className="border-b border-slate-200 bg-white/85 px-5 py-4 backdrop-blur">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[#071C3B] text-cyan shadow-lg">
                            <ChefHat size={22} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-[#071C3B]">Restaurant POS</h1>
                            <p className="text-sm text-slate-500">نظام مطاعم مترابط للطاولات والقائمة والمطبخ والدفع.</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        {branchOptions.length > 0 ? (
                            <select
                                value={branchId}
                                onChange={(event) => {
                                    setBranchId(event.target.value);
                                    setSelectedTable(null);
                                    setLiveOrder(null);
                                    setDraftLines([]);
                                    setError('');
                                    setSuccess('');
                                    setPaymentOpen(false);
                                    setEditingNoteIndex(null);
                                    setNoteDraft('');
                                }}
                                className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none"
                            >
                                {branchOptions.map((branch) => (
                                    <option key={branch.id} value={branch.id}>
                                        {branch.name_ar || branch.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
                                السبب: لا يوجد فرع نشط للمستأجر الحالي. أضف فرعًا من إعدادات الفروع أو تواصل مع المسؤول.
                            </div>
                        )}
                    </div>
                </div>

                {(error || success) && (
                    <div className="mt-4 space-y-2">
                        {error ? <StatusBanner variant="error">{error}</StatusBanner> : null}
                        {success ? <StatusBanner variant="success">{success}</StatusBanner> : null}
                    </div>
                )}
            </div>

            <div className="px-5 py-5">
                {!loading && branchOptions.length === 0 && (
                    <div className="mb-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
                        السبب: لا يمكن تشغيل نقطة مطعم بدون فرع. تأكد من وجود فرع نشط للمستأجر الحالي.
                    </div>
                )}
                {!loading && branchId && snapshot && (snapshot.tables?.length ?? 0) === 0 && (
                    <div className="mb-4 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        السبب: لا توجد طاولات مهيأة لهذا الفرع. إن وُضعت بذور التجربة على فرع آخر فاختره من القائمة أعلاه، أو أضف طاولات من «إدارة القائمة».
                    </div>
                )}
                {!loading && branchId && snapshot && (snapshot.menuItems?.length ?? 0) === 0 && (
                    <div className="mb-4 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        السبب: لا توجد أصناف في قائمة هذا الفرع. جرّب فرعًا آخر أو أضف أصنافًا من «إدارة القائمة». بدون قائمة لا يمكن إضافة بنود للطاولة.
                    </div>
                )}
                <div className="mb-4 flex gap-2 rounded-[22px] bg-white p-2 shadow-sm xl:hidden">
                    {desktopSections.map((section) => {
                        const Icon = section.icon;
                        const active = mobileTab === section.id;
                        return (
                            <button
                                key={section.id}
                                type="button"
                                onClick={() => setMobileTab(section.id)}
                                className={`flex-1 rounded-[18px] px-4 py-3 text-sm font-black transition ${
                                    active ? 'bg-[#071C3B] text-white' : 'bg-slate-50 text-slate-500'
                                }`}
                            >
                                <span className="inline-flex items-center gap-2">
                                    <Icon size={16} />
                                    {section.label}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="hidden xl:grid xl:grid-cols-[330px_minmax(0,1fr)_420px] xl:gap-5">
                    {desktopSections.map((section) => (
                        <section key={section.id}>{section.content}</section>
                    ))}
                </div>

                <div className="space-y-5 xl:hidden">
                    {desktopSections.find((section) => section.id === mobileTab)?.content}
                </div>
            </div>

            <ModifiersModal
                open={modifiersOpen}
                menuItem={selectedMenuItem}
                currency={snapshot?.settings.default_currency || 'AED'}
                onClose={() => {
                    setModifiersOpen(false);
                    setSelectedMenuItem(null);
                }}
                onConfirm={(modifiers) => {
                    if (selectedMenuItem) {
                        addMenuItemToDraft(selectedMenuItem, modifiers);
                    }
                }}
            />

            <PaymentModal
                open={paymentOpen}
                total={liveOrder?.total ?? summary.total}
                currency={snapshot?.settings.default_currency || 'AED'}
                orderLabel={liveOrder?.order_no || (selectedTable ? `طاولة ${selectedTable.label}` : undefined)}
                loading={paying}
                onClose={() => setPaymentOpen(false)}
                onConfirm={handlePayment}
            />

            {editingNoteIndex !== null && (
                <div className="fixed inset-0 z-[92] flex items-center justify-center bg-[#071C3B]/50 p-4">
                    <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl" dir="rtl">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-black text-[#071C3B]">ملاحظات الصنف</h2>
                            <button type="button" onClick={() => setEditingNoteIndex(null)} className="rounded-full bg-slate-100 p-2 text-slate-500">
                                <X size={16} />
                            </button>
                        </div>
                        <textarea
                            value={noteDraft}
                            onChange={(event) => setNoteDraft(event.target.value)}
                            placeholder="أدخل ملاحظات للمطبخ أو للخدمة..."
                            className="mt-4 min-h-32 w-full rounded-[20px] border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none"
                        />
                        <div className="mt-4 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setDraftLines((current) => current.map((line, index) => index === editingNoteIndex ? { ...line, notes: noteDraft } : line));
                                    setEditingNoteIndex(null);
                                }}
                                className="rounded-[18px] bg-cyan px-4 py-3 text-sm font-black text-[#071C3B]"
                            >
                                حفظ الملاحظة
                            </button>
                            <button type="button" onClick={() => setEditingNoteIndex(null)} className="rounded-[18px] border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500">
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
