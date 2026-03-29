# Per-Role Usage Guide (Internal)

مهم: هذا الدليل مبني على:
- `src/config/permissions.ts` (قائمة الطرق لكل Role)
- `src/components/RoleBasedRoute.tsx` (منطق baseRoute + fallback role)
- `src/App.tsx` (allowedRoles لكل route)

## owner
الصفحات التي يستخدمها
- جميع صفحات النظام الأساسية مع التركيز على `/work`
- Restaurants: `/restaurant-pos`, `/kds`, `/menu-management`
- Pharmacy: `/pharmacy-pos`, `/prescriptions`, `/pharmacy-inventory`, `/pharmacy-receiving`, `/patient-med-history`, `/pharmacy-reports`
- WorkOS: `/work`, `/work/projects`, `/work/projects/:id`, `/work/docs`, `/work/channels`, `/work/inbox`, `/work/search`

ما الذي يفترض أن يراه
- كل بيانات العمل داخل tenant مع RLS مصفّاة.

ما الذي لا يفترض أن يراه
- بيانات tenant أخرى (ممنوع RLS).

أهم 3 flows
- تشغيل نهاية-لنهاية: POS→KDS→Payment
- تشغيل نهاية-لنهاية: Pharmacy dispense/receiving + مراقبة inventory
- WorkOS: search + inbox quick actions + project docs/thread

## master_admin
الصفحات التي يستخدمها
- نفس صلاحيات `owner` route-wise مع التركيز على التشغيل الداخلي وعمليات الإشراف.

ما الذي يفترض أن يراه
- كل ما يراه `owner`.

ما الذي لا يفترض أن يراه
- بيانات tenant أخرى (ممنوع RLS).

أهم 3 flows
- QA/triage: تشخيص مشاكل role/tenant/RLS من الرسائل العربية
- WorkOS: إنشاء/تعديل/أرشفة لتفعيل demo screens
- مراقبة تقارير pharmacy ورصد empty الطبيعي

## branch_manager
الصفحات التي يستخدمها
- Restaurants: `/restaurant-pos`, `/kds`, `/menu-management`
- Pharmacy: `/pharmacy-pos`, `/prescriptions`, `/pharmacy-inventory`, `/pharmacy-receiving`, `/patient-med-history`, `/pharmacy-reports`
- WorkOS: `/work` و `/work/projects` و `/work/docs` و `/work/channels` و `/work/inbox` و `/work/search` و `/work/projects/:id`

ما الذي يفترض أن يراه
- بيانات operational داخل الفرع ووفق tenant.

ما الذي لا يفترض أن يراه
- بيانات فروع غير مسموح بها عبر RLS/filters في الشاشات.

أهم 3 flows
- Restaurants: إرسال طلب للمطبخ ومتابعة KDS
- Pharmacy: تشغيل POS + مراجعة inventory tabs
- WorkOS: فتح project docs + تتبع النشاط

## cashier
الصفحات التي يستخدمها
- `/restaurant-pos`
- `/pharmacy-pos`
- `/work` (حسب role permissions)

ما الذي يفترض أن يراه
- current operations للتنفيذ اليومي.

ما الذي لا يفترض أن يراه
- تعديل قائمة الطعام/المكونات (ممنوع عبر route permissions)
- إدارة مخزون/استلام/جرد الصيدلية (ممنوع عبر route permissions)

أهم 3 flows
- Restaurant: POS إضافة صنف ثم “إرسال للمطبخ” ثم “الدفع”
- Pharmacy: صرف prescription أو OTC مع mode switch
- WorkOS: Inbox للمتابعة السريعة ثم تعليم كمقروء

## pharmacist
الصفحات التي يستخدمها
- `/pharmacy-pos`
- `/prescriptions`
- `/pharmacy-inventory`
- `/pharmacy-receiving`
- `/patient-med-history`
- `/pharmacy-reports`
- `/work`

ما الذي يفترض أن يراه
- كل ما يتعلق بـ dispense/OTC + FEFO/expiry + patient history.

ما الذي لا يفترض أن يراه
- عمليات مخزون عميقة خارج صلاحيات route (مثل procurement إذا لم تكن ضمن role)
- أي data من tenant آخر (RLS).

أهم 3 flows
- Pharmacy: POS prescription dispense + batch اختيار + success + refresh
- Pharmacy: inventory tabs (current/near/expired/low) وتعديل أو receiving عند الحاجة
- WorkOS: search/inbox لمراجعة تنبيهات العمليات

## warehouse
الصفحات التي يستخدمها
- `/pharmacy-inventory`
- `/pharmacy-receiving`
- `/work`

ما الذي يفترض أن يراه
- batches/receiving/returns وتحديث inventory.

ما الذي لا يفترض أن يراه
- POS الصيدلية (الصرف عبر `/pharmacy-pos`) إذا role لا يملك route.

أهم 3 flows
- Receiving: إدخال خطوط الاستلام + save success
- Inventory: اختيار batch + actions مثل marking expired/adjust/returns
- WorkOS: متابعة inbox/activities بشكل عام

## procurement
الصفحات التي يستخدمها
- `/pharmacy-inventory`
- `/pharmacy-receiving`
- `/work`
- (قد تشمل أيضًا procurement routes عامة حسب التطبيق، لكن هذا الدليل يركز على النطاق المطلوب)

ما الذي يفترض أن يراه
- وصول كافٍ لإدارة سلسلة الإمداد عبر pharmacy receiving/stock adjustments.

ما الذي لا يفترض أن يراه
- تنفيذ صرف OTC/Prescription من `/pharmacy-pos` إذا ممنوع.

أهم 3 flows
- Receiving + Supplier returns/receiving workflows
- Inventory management للـ batch awareness
- WorkOS متابعة inbox

## kitchen
الصفحات التي يستخدمها
- `/kds`
- `/work`

ما الذي يفترض أن يراه
- tickets حسب station/filter.

ما الذي لا يفترض أن يراه
- POS الصيدلية/المطاعم أو menu management.

أهم 3 flows
- KDS: advance pending→preparing→ready→dismissed
- التعامل مع empty طبیعی: “المطبخ جاهز” قبل أول إرسال
- WorkOS: فتح inbox إذا توجد تنبيهات تشغيلية

## doctor / receptionist
الصفحات (عندما ينطبق role-wise)
- doctor: `/pharmacy-pos`, `/prescriptions`, `/patient-med-history`, `/work` (حسب route permissions)
- receptionist: `/pharmacy-pos`, `/prescriptions`, `/work` (حسب route permissions)

ما الذي يفترض أن يراه
- ما يكفي للتفاعل مع الوصفات/المدخلات المرتبطة بالمرضى.

ما الذي لا يفترض أن يراه
- إدارة inventory/receiving/returns إن كانت خارج route permissions.

أهم 3 flows
- doctor: فتح prescription ثم إضافة للصرف من POS (عند استخدام flow داخلي)
- receptionist: التعامل مع tab list/create للوصفات بشكل محدود
- patient-med-history: قراءة تاريخ دوائي عند توفر data

