import React, { useEffect, useState } from 'react';
import { FoundationSubnav } from '@/components/commerceFoundation/FoundationSubnav';
import { listChannelAccounts } from '@/services/commerceFoundationService';
import type { ChannelAccountRecord } from '@/types/commerceFoundation';

const CommerceChannelsOpsScreen: React.FC = () => {
  const [rows, setRows] = useState<ChannelAccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ok = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listChannelAccounts();
        if (ok) setRows(data);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'فشل التحميل';
        if (ok) setError(msg);
      } finally {
        if (ok) setLoading(false);
      }
    })();
    return () => {
      ok = false;
    };
  }, []);

  return (
    <div className="flex w-full max-w-[1400px] flex-col gap-6 pb-10 animate-fade-in" dir="rtl">
      <div>
        <h1 className="text-[1.65rem] font-black text-white">قنوات البيع المتصلة</h1>
        <p className="mt-1 text-sm font-bold text-content-3">
          بيانات مباشرة من <code className="rounded bg-black/30 px-1">channel_accounts</code> عبر RLS. لربط الصلاحيات
          والعقود لاحقًا.
        </p>
      </div>
      <FoundationSubnav />

      {loading && <p className="text-sm font-bold text-content-3">جاري التحميل...</p>}
      {error && <p className="text-sm font-bold text-red-300">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="rounded-[20px] border border-dashed border-white/20 bg-white/5 p-8 text-center text-sm font-bold text-content-3">
          لا توجد حسابات قنوات نشطة. أنشئ اتصالًا من مسار التكامل الحالي أو عبر الإدارة الخلفية.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-x-auto rounded-[20px] border border-border bg-surface-card">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border bg-white/5 text-xs font-black text-content-3">
              <tr>
                <th className="p-3">القناة</th>
                <th className="p-3">حالة الاتصال</th>
                <th className="p-3">الصحة</th>
                <th className="p-3">آخر مزامنة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="p-3 font-black capitalize text-white">{r.channel_name}</td>
                  <td className="p-3 font-bold text-content-3">{r.connection_status}</td>
                  <td className="p-3 font-bold text-content-3">{r.health_status}</td>
                  <td className="p-3 text-xs text-content-3">
                    {r.last_synced_at ? new Date(r.last_synced_at).toLocaleString('ar-AE') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CommerceChannelsOpsScreen;
