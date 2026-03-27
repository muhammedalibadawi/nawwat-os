import React from 'react';
import { FileText, Phone, ShieldCheck, User } from 'lucide-react';
import type { PharmacyPatientOption, PharmacyPrescriptionSummary } from '@/types/pharmacy';
import { formatDate } from '@/utils/pharmacy';

interface PatientSummaryCardProps {
  patient?: PharmacyPatientOption | null;
  prescription?: PharmacyPrescriptionSummary | null;
}

const detailClass = 'rounded-2xl border border-slate-200 bg-white/80 p-3';

const PatientSummaryCard: React.FC<PatientSummaryCardProps> = ({ patient, prescription }) => {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#071C3B] text-white">
          <User size={20} />
        </div>
        <div>
          <h3 className="text-base font-black text-[#071C3B]">بيانات المريض</h3>
          <p className="text-sm text-slate-500">ملخص سريع قبل الصرف أو إنشاء وصفة جديدة.</p>
        </div>
      </div>

      {patient ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
            <div className="text-lg font-black text-[#071C3B]">{patient.name}</div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
              {patient.phone ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1">
                  <Phone size={12} />
                  {patient.phone}
                </span>
              ) : null}
              {patient.email ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1">
                  <FileText size={12} />
                  {patient.email}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className={detailClass}>
              <div className="text-xs font-bold text-slate-500">رقم الوصفة</div>
              <div className="mt-1 text-sm font-bold text-slate-800">
                {prescription?.prescription_number ?? 'لا توجد وصفة محددة'}
              </div>
            </div>
            <div className={detailClass}>
              <div className="text-xs font-bold text-slate-500">تاريخ الوصفة</div>
              <div className="mt-1 text-sm font-bold text-slate-800">
                {prescription ? formatDate(prescription.prescription_date) : '—'}
              </div>
            </div>
            <div className={detailClass}>
              <div className="text-xs font-bold text-slate-500">الطبيب</div>
              <div className="mt-1 text-sm font-bold text-slate-800">{prescription?.doctor_name ?? '—'}</div>
            </div>
            <div className={detailClass}>
              <div className="text-xs font-bold text-slate-500">التأمين</div>
              <div className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-slate-800">
                <ShieldCheck size={14} className="text-cyan-600" />
                {prescription?.insurance_provider ?? patient.policy_number ?? 'بدون تأمين'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          اختر مريضًا أو وصفة من القائمة لعرض البيانات هنا.
        </div>
      )}
    </section>
  );
};

export default PatientSummaryCard;
