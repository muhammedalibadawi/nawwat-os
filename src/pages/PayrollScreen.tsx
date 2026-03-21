import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { generatePayslipPDF } from '../utils/generatePayslipPDF';

export default function PayrollScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'structures' | 'runs' | 'eosb'>('structures');
  const [structures, setStructures] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showStructModal, setShowStructModal] = useState(false);
  const [structForm, setStructForm] = useState<any>({ user_id: '', basic_salary: '', housing_allowance: '', transport_allowance: '', other_allowances: '', iban: '', bank_routing_code: '', labor_card_number: '' });
  const [runMonth, setRunMonth] = useState('');
  const [eosbForm, setEosbForm] = useState<any>({ user_id: '', startDate: '', endDate: new Date().toISOString().slice(0, 10), country: 'UAE', reason: 'استقالة' });
  const [eosbResult, setEosbResult] = useState<any>(null);

  const load = async () => {
    if (!user?.tenant_id) return;
    setLoading(true);
    setError('');
    try {
      const [sRes, uRes, rRes] = await Promise.all([
        supabase.from('salary_structures').select('*').eq('tenant_id', user.tenant_id),
        supabase.from('users').select('id,full_name,email').eq('tenant_id', user.tenant_id),
        supabase.from('payroll_runs').select('*').eq('tenant_id', user.tenant_id).order('run_month', { ascending: false }),
      ]);
      if (sRes.error) throw sRes.error;
      if (uRes.error) throw uRes.error;
      if (rRes.error) throw rRes.error;
      setStructures(sRes.data ?? []);
      setUsers(uRes.data ?? []);
      setRuns(rRes.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? 'فشل تحميل بيانات الرواتب');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.tenant_id]);

  const totalByStruct = (s: any) => Number(s.basic_salary || 0) + Number(s.housing_allowance || 0) + Number(s.transport_allowance || 0) + Number(s.other_allowances || 0);

  const saveStructure = async () => {
    if (!user?.tenant_id) return;
    const payload = {
      tenant_id: user.tenant_id,
      user_id: structForm.user_id,
      basic_salary: Number(structForm.basic_salary || 0),
      housing_allowance: Number(structForm.housing_allowance || 0),
      transport_allowance: Number(structForm.transport_allowance || 0),
      other_allowances: Number(structForm.other_allowances || 0),
      iban: structForm.iban || null,
      bank_routing_code: structForm.bank_routing_code || null,
      labor_card_number: structForm.labor_card_number || null,
    };
    const existing = structures.find((s) => s.user_id === structForm.user_id);
    const q = existing ? supabase.from('salary_structures').update(payload).eq('id', existing.id) : supabase.from('salary_structures').insert(payload);
    const { error: qErr } = await q;
    if (!qErr) {
      setShowStructModal(false);
      await load();
    } else setError(qErr.message);
  };

  const createRun = async () => {
    if (!user?.tenant_id || !runMonth) return;
    const totalNet = structures.reduce((s, r) => s + totalByStruct(r), 0);
    const { data: run, error: runErr } = await supabase.from('payroll_runs').insert({
      tenant_id: user.tenant_id,
      run_month: runMonth,
      status: 'draft',
      total_net: totalNet,
      employee_count: structures.length,
    }).select('id').single();
    if (runErr) return setError(runErr.message);
    const slips = structures.map((s) => ({
      tenant_id: user.tenant_id,
      payroll_run_id: run.id,
      user_id: s.user_id,
      basic_salary: Number(s.basic_salary || 0),
      total_allowances: Number(s.housing_allowance || 0) + Number(s.transport_allowance || 0) + Number(s.other_allowances || 0),
      net_salary: totalByStruct(s),
      labor_card_number: s.labor_card_number || null,
      iban: s.iban || null,
    }));
    const { error: slipErr } = await supabase.from('payslips').insert(slips);
    if (slipErr) return setError(slipErr.message);
    await load();
  };

  const exportPayslipPdfs = async (run: any) => {
    if (!user?.tenant_id) return;
    const { data: tenant } = await supabase.from('tenants').select('id,name,name_ar,logo_url').eq('id', user.tenant_id).single();
    const { data: slips } = await supabase.from('payslips').select('*').eq('tenant_id', user.tenant_id).eq('payroll_run_id', run.id);
    for (const slip of slips ?? []) {
      const emp = users.find((u) => u.id === slip.user_id);
      if (emp) await generatePayslipPDF({ ...slip, payroll_runs: { run_month: run.run_month } }, emp, tenant);
    }
  };

  const exportSif = async (run: any) => {
    const { data: slips } = await supabase.from('payslips').select('*').eq('tenant_id', user?.tenant_id).eq('payroll_run_id', run.id);
    const lines = [
      `EDR|COMPANY_ROUTING|${new Date().toISOString().slice(0, 10).replace(/-/g, '')}|${Number(run.total_net || 0).toFixed(2)}|${Number(run.employee_count || 0)}`,
      ...((slips ?? []).map((s: any) => `EMP|${s.labor_card_number || '-'}|${users.find((u) => u.id === s.user_id)?.full_name || '-'}|${s.iban || '-'}|${Number(s.basic_salary || 0).toFixed(2)}|${Number(s.total_allowances || 0).toFixed(2)}|${Number(s.net_salary || 0).toFixed(2)}`)),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WPS_${run.run_month}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const calcEosb = () => {
    const s = structures.find((x) => x.user_id === eosbForm.user_id);
    if (!s) return;
    const basic = Number(s.basic_salary || 0);
    const gross = totalByStruct(s);
    const start = new Date(eosbForm.startDate);
    const end = new Date(eosbForm.endDate);
    const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const years = totalDays / 365;
    let eosb = 0;
    if (eosbForm.country === 'UAE') {
      if (years < 1) eosb = 0;
      else if (years <= 5) eosb = (21 * basic / 30) * Math.min(years, 5);
      else eosb = (21 * basic / 30 * 5) + (30 * basic / 30 * (years - 5));
      eosb = Math.min(eosb, basic * 24);
    } else {
      if (years < 2) eosb = 0;
      else if (years <= 5) {
        eosb = (15 * gross / 30) * years;
        if (eosbForm.reason === 'استقالة') eosb = eosb / 3;
      } else {
        eosb = (15 * gross / 30 * 5) + (30 * gross / 30 * (years - 5));
        if (eosbForm.reason === 'استقالة' && years <= 10) eosb = eosb * (2 / 3);
      }
    }
    setEosbResult({ years, eosb, salaryBase: eosbForm.country === 'UAE' ? basic : gross });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setTab('structures')} className={`px-3 py-2 rounded ${tab === 'structures' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>هياكل الرواتب</button>
        <button onClick={() => setTab('runs')} className={`px-3 py-2 rounded ${tab === 'runs' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>مسيرات الرواتب</button>
        <button onClick={() => setTab('eosb')} className={`px-3 py-2 rounded ${tab === 'eosb' ? 'bg-[#071C3B] text-white' : 'bg-gray-100'}`}>نهاية الخدمة</button>
      </div>
      {loading && <div className="animate-pulse space-y-3"><div className="h-4 bg-gray-200 rounded w-3/4"></div><div className="h-4 bg-gray-200 rounded w-1/2"></div><div className="h-4 bg-gray-200 rounded w-5/6"></div></div>}
      {!loading && error && <div className="text-red-600">{error}</div>}

      {!loading && tab === 'structures' && (
        <>
          <button onClick={() => setShowStructModal(true)} className="px-4 py-2 bg-[#071C3B] text-white rounded-lg">إضافة هيكل راتب</button>
          <div className="bg-white border rounded-xl overflow-x-auto">
            <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-3 text-start">الموظف</th><th className="p-3 text-start">الأساسي</th><th className="p-3 text-start">السكن</th><th className="p-3 text-start">المواصلات</th><th className="p-3 text-start">الإجمالي</th><th className="p-3 text-start">IBAN</th><th className="p-3 text-start">تعديل</th></tr></thead>
              <tbody>{structures.map((s) => <tr key={s.id} className="border-t"><td className="p-3">{users.find((u) => u.id === s.user_id)?.full_name || s.user_id}</td><td className="p-3">{Number(s.basic_salary || 0).toLocaleString('ar-AE')}</td><td className="p-3">{Number(s.housing_allowance || 0).toLocaleString('ar-AE')}</td><td className="p-3">{Number(s.transport_allowance || 0).toLocaleString('ar-AE')}</td><td className="p-3">{totalByStruct(s).toLocaleString('ar-AE')}</td><td className="p-3">{s.iban || '—'}</td><td className="p-3"><button onClick={() => { setStructForm({ ...s }); setShowStructModal(true); }} className="px-2 py-1 bg-cyan-50 rounded">تعديل</button></td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}

      {!loading && tab === 'runs' && (
        <>
          <div className="flex gap-2"><input type="month" value={runMonth} onChange={(e) => setRunMonth(e.target.value)} className="border rounded px-3 py-2" /><button onClick={createRun} className="px-4 py-2 bg-[#071C3B] text-white rounded-lg">إنشاء مسيرة شهر جديد</button></div>
          <div className="bg-white border rounded-xl overflow-x-auto">
            <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-3 text-start">الشهر</th><th className="p-3 text-start">الحالة</th><th className="p-3 text-start">الصافي</th><th className="p-3 text-start">موظفين</th><th className="p-3 text-start">إجراءات</th></tr></thead>
              <tbody>{runs.map((r) => <tr key={r.id} className="border-t"><td className="p-3">{r.run_month}</td><td className="p-3">{r.status}</td><td className="p-3">{Number(r.total_net || 0).toLocaleString('ar-AE')}</td><td className="p-3">{r.employee_count}</td><td className="p-3 flex flex-wrap gap-2"><button onClick={() => supabase.from('payroll_runs').update({ status: 'approved' }).eq('id', r.id).then(load)} className="px-2 py-1 bg-gray-100 rounded">اعتماد</button>{r.status === 'approved' && <button type="button" onClick={() => exportPayslipPdfs(r)} className="px-2 py-1 bg-[#071C3B] text-white rounded text-xs font-bold">تصدير قسائم PDF</button>}<button onClick={() => exportSif(r)} className="px-2 py-1 bg-cyan-50 rounded">تصدير WPS SIF</button></td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}

      {!loading && tab === 'eosb' && (
        <div className="bg-white border rounded-xl p-4 space-y-2">
          <select value={eosbForm.user_id} onChange={(e) => setEosbForm({ ...eosbForm, user_id: e.target.value })} className="w-full border rounded px-3 py-2"><option value="">اختر موظف</option>{users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}</select>
          <div className="grid grid-cols-2 gap-2"><input type="date" value={eosbForm.startDate} onChange={(e) => setEosbForm({ ...eosbForm, startDate: e.target.value })} className="border rounded px-3 py-2" /><input type="date" value={eosbForm.endDate} onChange={(e) => setEosbForm({ ...eosbForm, endDate: e.target.value })} className="border rounded px-3 py-2" /></div>
          <div className="grid grid-cols-2 gap-2"><select value={eosbForm.country} onChange={(e) => setEosbForm({ ...eosbForm, country: e.target.value })} className="border rounded px-3 py-2"><option value="UAE">UAE</option><option value="KSA">KSA</option></select><select value={eosbForm.reason} onChange={(e) => setEosbForm({ ...eosbForm, reason: e.target.value })} className="border rounded px-3 py-2"><option>استقالة</option><option>إنهاء خدمة</option><option>انتهاء عقد</option></select></div>
          <button onClick={calcEosb} className="px-4 py-2 bg-[#071C3B] text-white rounded-lg">احسب</button>
          {eosbResult && <div className="rounded-lg bg-gray-50 p-3 text-sm">المدة: {Math.floor(eosbResult.years)} سنة، الراتب الأساسي للحساب: {Number(eosbResult.salaryBase).toLocaleString('ar-AE')}، مكافأة نهاية الخدمة: {Number(eosbResult.eosb).toLocaleString('ar-AE')}</div>}
        </div>
      )}

      {showStructModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-xl p-5 space-y-2">
            <h2 className="font-black">هيكل راتب</h2>
            <select value={structForm.user_id || ''} onChange={(e) => setStructForm({ ...structForm, user_id: e.target.value })} className="w-full border rounded px-3 py-2"><option value="">اختر موظف</option>{users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}</select>
            {['basic_salary', 'housing_allowance', 'transport_allowance', 'other_allowances', 'iban', 'bank_routing_code', 'labor_card_number'].map((k) => (
              <input key={k} value={structForm[k] || ''} onChange={(e) => setStructForm({ ...structForm, [k]: e.target.value })} className="w-full border rounded px-3 py-2" placeholder={k} />
            ))}
            <div className="flex justify-end gap-2"><button onClick={() => setShowStructModal(false)} className="px-4 py-2 border rounded">إلغاء</button><button onClick={saveStructure} className="px-4 py-2 bg-[#071C3B] text-white rounded">حفظ</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
