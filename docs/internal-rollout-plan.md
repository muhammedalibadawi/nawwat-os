# Internal Rollout Plan (NawwatOS: Restaurants + Pharmacy + WorkOS)

## ما الذي يعتبر جاهزًا الآن؟
- الـRuntime في القطاعات التشغيلية الثلاثة أصبح قابلًا للاستخدام عمليًا للاختبار اليدوي الداخلي.
- توجد states واضحة (loading/empty/success/error) في الشاشات الرئيسية لتقليل “هل التطبيق مكسور؟”.
- تم تحسين عدة نقاط UX لتقليل الالتباس بعد Actions (خصوصًا في المطاعم/الصيدلية).

## ما الذي ما زال Beta / Internal Beta؟
- ما زال هناك اعتماد تشغيلي قوي على `tenant + branch` وأن تكون بيانات seed/operational data موجودة بالشكل المناسب.
- بعض حالات `empty` طبيعية لكنها قد تبدو “مشكلة” لأول مرة، لذلك يجب أن تُفسّر داخل التدريب/الدليل.
- RLS قد ينتج عنه empty أو error “مفهوم”؛ لكن تفاصيل الأخطاء التقنية قد لا تكون كافية عند رسائل raw طويلة.

## ترتيب التفعيل المقترح داخل الشركة
1. المطاعم (`/restaurant-pos`, `/kds`, `/menu-management`)
2. الصيدلية (`/pharmacy-pos`, `/prescriptions`, `/pharmacy-inventory`, `/pharmacy-receiving`, `/patient-med-history`, `/pharmacy-reports`)
3. WorkOS (`/work`, `/work/projects`, `/work/projects/:id`, `/work/docs`, `/work/channels`, `/work/inbox`, `/work/search`)

## من يبدأ أولًا؟
- المطاعم: تشغيل KDS مع فريق POS (كاشير + مطبخ) على نفس الفرع.
- الصيدلية: فريق صرف/وصفات + فريق مخزون/استلام بحسب الأدوار.
- WorkOS: فريق Planner/Coordinator أو Viewer داخلي (حسب role) للتأكد من أن routes تعمل مع RLS.

## الشروط المسبقة لكل قطاع
### Restaurants
- فرع POS/`/kds` متطابق (نفس `branch`).
- وجود قائمة بأصناف لهذا الفرع (أو على الأقل بعض الأصناف الظاهرة في `Menu Grid`).
- وجود بيانات كافية ليظهر في `/kds` ticket بعد إرسال POS.

### Pharmacy
- فرع الصرف (`selectedBranchId` في `/pharmacy-pos`) مطابق للدفعات/queue التي تتوقعها.
- وجود batches مع تواريخ صلاحية حتى يظهر FEFO/expiry states.
- وجود patient/customer مرتبط إن تم استخدام mode prescription (حسب السيناريو).

### WorkOS
- وجود seed/بيانات تجريبية كحد أدنى لمساحات/مشاريع/مستندات وقنوات ورسائل/تنبيهات ليظهر UI بشكل مفيد.
- roles المطلوبة متحققة route-wise، وRLS يُفلتر البيانات فعليًا.

## المخاطر التشغيلية المعروفة
- Tenant/Branch mismatch: قد ينتج empty “يبدو broken” خصوصًا بين POS وKDS، وبين pharmacy-pos وباقي شاشات pharmacy.
- Station filtering في KDS قد يخفي tickets إذا كانت محطة الصنف مختلفة عن المحطة المختارة.
- RLS قد يمنع البيانات ويجعل النتائج empty؛ يجب التمييز بين “صلاحيات/tenant” و“عدم وجود بيانات”.

## ما الذي نراقبه في أول أسبوع تشغيل؟
- نسبة نجاح flows الأساسية (POS→KDS→Payment، Pharmacy dispense/receiving/inventory، WorkOS project/docs/inbox).
- معدل ظهور empty states على أنها “خطأ” (ومعرفة السبب: نقص بيانات vs mismatch vs RLS).
- تكرار تقارير bugs حول “إرسال تمت لكن لا يظهر” (وغالبًا السبب: refresh/branch mismatch).
- معدل ظهور رسائل error عامة بدل normalized message (خاصة لو error raw طويل).

