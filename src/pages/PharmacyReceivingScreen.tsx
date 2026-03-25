import React, { useEffect, useState } from 'react';
import { Plus, Truck } from 'lucide-react';
import PharmacyPageHeader from '@/components/pharmacy/PharmacyPageHeader';
import { useAuth } from '@/context/AuthContext';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { loadPharmacyCatalog, loadPharmacyPosSnapshot, receivePharmacyBatches } from '@/services/pharmacyService';
import type { PharmacyReceiveBatchLineInput } from '@/types/pharmacy';
import { normalizePharmacyError } from '@/utils/pharmacy';

const emptyRow = (): PharmacyReceiveBatchLineInput => ({
  product_id: '',
  batch_number: '',
  expiry_date: '',
  quantity: 0,
  purchase_cost: 0,
  selling_price: 0,
  barcode: '',
});

const PharmacyReceivingScreen: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [branches, setBranches] = useState<Array<{ id: string; name: string; name_ar?: string | null }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; label: string }>>([]);
  const [branchId, setBranchId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [rows, setRows] = useState<PharmacyReceiveBatchLineInput[]>([emptyRow()]);

  useEffect(() => {
    if (!user?.tenant_id) return;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const snapshot = await loadPharmacyPosSnapshot(user.tenant_id, user.branch_id || undefined);
        const catalog = await loadPharmacyCatalog(user.tenant_id);
        setBranches(snapshot.branches);
        setSuppliers(snapshot.suppliers);
        setProducts(
          catalog.map((product) => ({
            id: product.id,
            label: product.brand_name || product.item_name || product.generic_name || 'دواء',
          }))
        );
        setBranchId(user.branch_id || snapshot.branches[0]?.id || '');
      } catch (loadError) {
        setError(normalizePharmacyError(loadError, 'تعذر تحميل شاشة الاستلام.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.branch_id, user?.tenant_id]);

  const updateRow = (index: number, field: keyof PharmacyReceiveBatchLineInput, value: string | number) => {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  };

  const handleSave = async () => {
    if (!branchId) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await receivePharmacyBatches(branchId, rows, supplierId || undefined, 'استلام عبر شاشة الصيدلية');
      setRows([emptyRow()]);
      setSuccess('تم حفظ الاستلام الدوائي بنجاح.');
    } catch (saveError) {
      setError(normalizePharmacyError(saveError, 'تعذر حفظ عملية استلام الأدوية.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      <PharmacyPageHeader
        title="استلام الأدوية"
        subtitle="إدخال batch-aware لاستلام الأدوية يدويًا أو كأساس للربط لاحقًا مع أوامر الشراء."
        actions={
          <button type="button" onClick={() => setRows((current) => [...current, emptyRow()])} className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white">
            <span className="inline-flex items-center gap-2">
              <Plus size={16} />
              إضافة سطر
            </span>
          </button>
        }
      />

      {(error || success) && (
        <div className="mt-4 space-y-2">
          {error ? <StatusBanner variant="error" className="rounded-2xl">{error}</StatusBanner> : null}
          {success ? <StatusBanner variant="success" className="rounded-2xl">{success}</StatusBanner> : null}
        </div>
      )}

      {!loading && branches.length === 0 ? (
        <StatusBanner variant="warning" className="rounded-2xl">
          لا يوجد فرع نشط — اختر/أضف فرعًا قبل تسجيل الاستلام.
        </StatusBanner>
      ) : null}
      {!loading && products.length === 0 ? (
        <StatusBanner variant="warning" className="rounded-2xl">
          لا توجد أصناف صيدلية في الكتالوج. أضف منتجات أو طبّق بذور التجربة قبل تعبئة أسطر الاستلام.
        </StatusBanner>
      ) : null}
      {!loading && suppliers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          لا يوجد مورد مسجّل — يمكنك ترك «المورد» فارغًا إن كان الاستلام بدون مورد، أو أضف موردًا من بيانات المستأجر.
        </div>
      ) : null}

      {loading ? (
        <div className="h-96 animate-pulse rounded-[28px] bg-slate-100" />
      ) : (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3">
              <option value="">اختر الفرع</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name_ar || branch.name}
                </option>
              ))}
            </select>
            <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3">
              <option value="">اختر المورد</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-3 text-sm text-cyan-900">
              <span className="inline-flex items-center gap-2 font-bold">
                <Truck size={16} />
                كل سطر ينتج batch أو يحدّث دفعة موجودة بأمان عبر RPC.
              </span>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-3 text-start">المنتج</th>
                  <th className="px-3 py-3 text-start">رقم الدفعة</th>
                  <th className="px-3 py-3 text-start">الصلاحية</th>
                  <th className="px-3 py-3 text-start">الكمية</th>
                  <th className="px-3 py-3 text-start">تكلفة الشراء</th>
                  <th className="px-3 py-3 text-start">سعر البيع</th>
                  <th className="px-3 py-3 text-start">Barcode</th>
                  <th className="px-3 py-3 text-start"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    <td className="px-3 py-3">
                      <select value={row.product_id} onChange={(event) => updateRow(index, 'product_id', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3">
                        <option value="">اختر الصنف</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <input value={row.batch_number} onChange={(event) => updateRow(index, 'batch_number', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
                    </td>
                    <td className="px-3 py-3">
                      <input type="date" value={row.expiry_date} onChange={(event) => updateRow(index, 'expiry_date', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
                    </td>
                    <td className="px-3 py-3">
                      <input type="number" value={row.quantity} onChange={(event) => updateRow(index, 'quantity', Number(event.target.value))} className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
                    </td>
                    <td className="px-3 py-3">
                      <input type="number" value={row.purchase_cost} onChange={(event) => updateRow(index, 'purchase_cost', Number(event.target.value))} className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
                    </td>
                    <td className="px-3 py-3">
                      <input type="number" value={row.selling_price} onChange={(event) => updateRow(index, 'selling_price', Number(event.target.value))} className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
                    </td>
                    <td className="px-3 py-3">
                      <input value={row.barcode ?? ''} onChange={(event) => updateRow(index, 'barcode', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setRows((current) => (current.length > 1 ? current.filter((_, rowIndex) => rowIndex !== index) : current))}
                        className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setRows([emptyRow()])} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600">
              تفريغ النموذج
            </button>
            <button type="button" onClick={handleSave} disabled={saving || !branchId} className="rounded-2xl bg-[#071C3B] px-5 py-3 text-sm font-black text-white disabled:opacity-50">
              {saving ? 'جارٍ الحفظ...' : 'حفظ الاستلام'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default PharmacyReceivingScreen;
