# Runtime Risk Log (Before Internal Rollout)

هذا القسم يلخّص أهم مخاطر “قبل التشغيل الداخلي” ضمن النطاق: WorkOS / Restaurants / Pharmacy.

## 1) Permission/Role propagation (Route vs Data)
- المخاطر:
  - `RoleBasedRoute` يعتمد على `user.role`، وإذا كانت غير متاحة لأي سبب يجعل الدور افتراضيًا `viewer`.
  - WorkOS routes بالفعل تسمح لـ `viewer` (لذلك أي مشكلة propagation قد تجعل WorkOS متاحًا أكثر من المتوقع).
- التأثير المتوقع:
  - قد يرى المستخدم صفحات WorkOS لكن لا تظهر له بيانات محظورة بسبب RLS (إن كانت RLS سليمة).
- تحقق يدوي:
  - سجّل دخول بحساب بدون role (إن أمكن) وتأكد أن الوصول للـroutes مطابق للوصف.
  - راقب هل يظهر redirect أو هل تظهر صفحات WorkOS دون بيانات.

## 2) Route baseRoute granularity
- المخاطر:
  - `RoleBasedRoute` يستخدم `baseRoute = '/' + location.pathname.split('/')[1]`.
  - لذلك كل `/work/*` يعتبر `/work` (اختيار صحيح هنا)، لكن أي مسارات مستقبلية قد تعتمد على first-segment بشكل غير مطابق.
- التأثير المتوقع:
  - أذونات قد تكون عامة داخل `/work` (مع بقاء تقييد البيانات عبر RLS).
- تحقق يدوي:
  - تأكد أن المسارات المذكورة كلها محمية كما في `src/App.tsx` وأن `allowedRoles` متطابق لكل route.

## 3) Tenant/Branch mismatch causes “empty that looks broken”
- المخاطر:
  - Restaurants وPharmacy تعتمد على `branchId`/فرع مختار.
  - KDS يستند إلى `user.branch_id` (أو أول فرع) بينما POS قد يكون فيه فرع مختلف إذا غيّره المستخدم يدويًا.
  - Pharmacy أيضًا تعتمد على `selectedBranchId`.
- التأثير المتوقع:
  - قد ترى شاشات فارغة (خصوصًا `/kds` أو نتائج batches) وتُفسر كـruntime broken بينما السبب mismatch.
- تحقق يدوي:
  - في أي تجربة POS → KDS: تأكد أن الفرع في `/kds` مطابق لفرع `/restaurant-pos`.
  - في الصيدلية: تأكد أن `selectedBranchId` في `/pharmacy-pos` يطابق الفرع الذي تظهر فيه batches/queue.

## 4) RLS/runtime error messaging completeness
- المخاطر:
  - رسائل RLS الخام يتم “تنظيفها” عبر:
    - WorkOS: `normalizeWorkOsError`
    - Restaurants: `safeRestaurantErrorMessage`
    - Pharmacy: `normalizePharmacyError`
  - إن كانت رسالة raw طويلة (> 220) يتم الرجوع إلى fallback generic.
- التأثير المتوقع:
  - المستخدم قد لا يحصل على تفاصيل كافية، لكن على الأقل لا تظهر raw technical.
- تحقق يدوي:
  - جرّب سيناريو “صلاحيات غير كافية” (باستخدام role أقل) وتأكد أن الرسالة عربية ومفهومة وتوضح إعادة المحاولة/تحديث الصفحة.

## 5) Demo data sparsity (natural empty states)
- المخاطر:
  - بعض الشاشات تتطلب seed/بيانات minimale لتبدو “غير فارغة” (مثلاً WorkOS home/search/inbox، أو وجود تذاكر مطبخ بعد أول إرسال).
- التأثير المتوقع:
  - empty states قد تبدو كأن الواجهة broken بينما هي نتيجة بيانات غير كافية.
- تحقق يدوي:
  - استخدم `docs/demo-flow.md` لمقارنة “النتيجة المتوقعة” أثناء العرض.
  - ارجع `docs/runtime-qa-checklist.md` للتحقق أن كل empty state مسبب وواضح.

## هل هناك مخاطر تحتاج DB schema change الآن؟
- لا. خلال المراجعة لا يوجد مؤشر على حاجة لتعديل Schema أو policies ضمن هذا النطاق.
- أي RLS issues يجب أن تظهر كرسائل normalized أو behavior منطقي. إذا ظهر blocker واضح لاحقًا (مثل absence of data بسبب policy غير صحيحة)، حينها نراجع DB schema/policies كـ “blocker حقيقي جدًا”.

