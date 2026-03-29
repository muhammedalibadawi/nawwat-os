# First-Week Rollout Checklist (Operational Enablement)

## قبل التشغيل (Pre-launch)
- تأكد من وجود tenant واحد نشط مع seed/demo data كحد أدنى.
- تأكد أن لديك `فرع نشط` في المطاعم والصيدلية.
- تأكد من وجود وصفات/batches/kds tickets (أو على الأقل أصناف/tables في restaurants).
- جهّز فريق triage: شخص/أو أكثر لفحص
  - role-based route redirects
  - tenant/branch mismatch
  - RLS-related empty/error messaging
- راجع وثائق:
  - `docs/runtime-qa-checklist.md`
  - `docs/role-access-matrix.md`
  - `docs/runtime-risk-log.md`

## يوم الإطلاق (Day 0)
- نفّذ سيناريو Restaurants end-to-end على نفس الفرع:
  - `/restaurant-pos` اختر فرع → اختر طاولة → أضف صنف → `إرسال للمطبخ` → `/kds` تحقق من ظهور ticket → `الدفع` من POS
- نفّذ سيناريو Pharmacy end-to-end على نفس الفرع:
  - `/pharmacy-pos` dispense prescription أو OTC → Success → راجع inventory tabs (على الأقل `current`/`near`)
- نفّذ سيناريو WorkOS سريع:
  - `/work/search` ب query كافٍ → `/work/inbox` تعليم كمقروء
- سجّل أي bug مع استخدام `docs/bug-intake-template.md`.

## أول 3 أيام (Day 1 - Day 3)
- راقب mismatches الشائعة:
  - POS restaurant على فرع A ثم KDS على فرع B
  - pharmacy-pos فرع مختلف عن الشاشات الأخرى
- راقب ظهور empty states الطبيعية:
  - `/kds` قبل أول إرسال للمطبخ
  - `/work` إذا البيئة بدون بيانات كفاية
- راقب جودة الرسائل:
  - هل الأخطاء عربية ومفهومة؟
  - هل يظهر raw error بدل message normalized؟
- نفّذ إعادة تشغيل/refresh عند الحاجة فقط (بدون اعتبارها bug).

## نهاية الأسبوع الأول (Day 7)
- صفّي Bugs حسب النوع:
  - role/route redirect wrong
  - tenant mismatch
  - RLS denial leading to empty
  - UI stale after success
- قرر التصنيف النهائي:
  - Ready / Internal beta / Needs monitored usage / Not for broad rollout بعد التحقق.
- اكتب ملخص أسبوعي:
  - ما الذي نجح
  - ما الذي ما زال يحتاج مراقبة
  - ما أكثر 3 أسباب لبلاغات المشاكل

## مؤشرات نجاح (Operational KPIs) في الأسبوع الأول
- نسبة نجاح flows الأساسية بدون إعادة محاولات متكررة بسبب UI confusion.
- معدل tickets/logs التي سببها root cause “branch mismatch” فقط (مع فهم المستخدم) مقابل مشاكل permissions/RLS.
- معدل نجاح refresh/updates بعد Actions.

