# Runtime QA Checklist (Restaurants + Pharmacy + WorkOS)

## قبل البدء (سريع)
- تأكد أنك على نفس الـtenant الذي تم عليه seed/demo (لا تعتمد على بيانات tenant أخرى).
- تأكد أن لديك `فرع نشط` للمطاعم والصيدلية (إذا لا يوجد، سيظهر empty state طبيعي).
- إن كان هناك seed جديد/مؤخر، نفّذ “Refresh” داخل الشاشة إن وُجد.

## Restaurants

### 1) `/restaurant-pos`
- `Loading`: هل يظهر spinner/تحميل واضح؟
- `Empty`: عند عدم وجود فروع/طاولات/قائمة للفرع هل يظهر نص مسبب وواضح؟
- `Table selection`: عند اختيار طاولة هل تتغير لوحة الطلب بشكل واضح؟
- `Menu flow`: إضافة صنف بدون modifiers + صنف مع modifiers (هل تفتح الـmodal بشكل صحيح؟ هل التحديد المطلوب واضح؟)
- `POS → Kitchen`: بعد `إرسال للمطبخ` هل يظهر Success عربي؟ وهل تستطيع الدفع/المتابعة من نفس الشاشة دون إعادة اختيار الطاولة؟
- `KDS connection`: بعد الإرسال افتح `/kds` وتأكد أن التذكرة ظهرت مرتبطة بالفرع والمحطة المناسبة.
- `Payment`: عند الدفع هل يتم إغلاق الـmodal + تحديث الطلب + Success عربي + (إن أمكن) طباعة الإيصال.
- `Cancel`: إلغاء الطلب/المسودة: هل Success/Empty منطقي؟ وهل يتم reset واضح؟
- `Stale UI`: بعد أي Action ناجحة هل تختفي/تستبدل الرسائل القديمة عند تغيير الطاولة أو الفرع؟

### 2) `/kds`
- `Loading`: هل يظهر loading واضح؟
- `Station filtering`: تغيير المحطة (main/cold/bar/grill/dessert أو `كل المحطات`) هل يغيّر القائمة بدون “فراغ مضلل”؟
- `Empty`: عند عدم وجود تذاكر هل يظهر شرح أن هذا طبيعي قبل أول طلب + نص يوجه المستخدم؟
- `Action success`: عند `بدء التحضير/جاهز/أغلق` هل تظهر رسالة Success عربية قصيرة؟ وهل التذكرة تختفي/تتغير حسب الحالة؟
- `Realtime`: إن كانت تذاكر جديدة تدخل هل تظهر بدون Reload يدوي؟ وإذا فشل realtime هل رسالة الخطأ عربية وغير خام؟

### 3) `/menu-management`
- `Loading`: هل تظهر صفحة تحميل؟
- `Empty`: عند عدم وجود أصناف لهذا الفرع هل الرسالة واضحة؟
- `Create/Update/Delete`: بعد أي حفظ/حذف هل يظهر Success عربي واضح؟ وهل تتحدث الجداول بعد العملية؟
- `Error handling`: تأكد أن رسائل الخطأ عربية ومفهومة (لا تعرض raw PostgREST).

## Pharmacy

### 1) `/pharmacy-pos`
- `Loading`: هل يظهر shimmer/تحميل واضح؟
- `Mode clarity`: تبديل `Prescription` ↔ `OTC` هل يعيد/ينظف cart والحالات المرتبطة بدون خلط بيانات؟
- `Branch selection`: هل يمنع المستخدم من خطوات البحث/الصرف بدون فرع (رسالة واضحة)؟
- `Search`: عند البحث هل يتم عرض نتائج batch-aware؟ وعند عدم وجود نتائج هل يظهر empty message صحيح؟
- `Batch selection`: modal الدفعة—هل يظهر expiry awareness بشكل واضح (expired/near/healthy)؟
- `Dispense success`: عند `صرف الوصفة` أو `إتمام بيع OTC` هل تظهر Success عربية واضحة؟ وهل يتم تنظيف السلة/تحديث البيانات؟
- `Error`: هل أي خطأ يظهر رسالة عربية وغير خام؟
- `Stale UI`: بعد Action ناجحة، هل تختفي الرسائل القديمة عند تغيير mode/فرع/بانل؟

### 2) `/prescriptions`
- `Loading`: هل يظهر تحميل واضح عند أول دخول؟
- `Empty`: هل رسائل القائمة والفلاتر واضحة (خصوصًا عند فرع تجريبي محدود)؟
- `Filter apply`: بعد تطبيق الفلاتر هل تختفي success القديمة؟
- `Create/Update`: حفظ مسودة/تحديث: هل تظهر Success عربية؟ وهل تُحدث القائمة بعد الحفظ؟
- `Error`: تأكد أن error عربي ومفهوم.

### 3) `/pharmacy-inventory`
- `Loading`: هل يظهر تحميل؟
- `Tabs`: تغيير التبويب (current/near/expired/low/adjust/returns) هل يحدّث الجدول كما هو متوقع؟
- `Empty states`: هل التبويب الفارغ يشرح سبب الفراغ (مثلاً مطابقات/تبويب)؟
- `Actions`: تعديل/تعليم كمنتهي/مرتجع—هل كل action:
  - يعرض Success عربي
  - يعمل refresh للمخزون بعد العملية
  - لا يترك state قديم؟

### 4) `/pharmacy-receiving`
- `Loading`: هل تظهر لوحة تحميل؟
- `Empty states`: إذا لا يوجد فروع/أصناف/مورد—هل الرسائل واضحة؟
- `Save success`: عند الحفظ هل يتم reset لسطور الإدخال + Success عربي واضح؟
- `Error`: هل error عربي وليس raw؟

### 5) `/patient-med-history`
- `Patient selection`: هل اختيار المريض يحمّل التاريخ بدون أخطاء؟
- `Empty`: إذا لا توجد سجلات: هل النص يشرح سبب طبيعي؟
- `Filters by date`: هل نطاق التاريخ يعمل بدون “فراغ مضلل”؟

### 6) `/pharmacy-reports`
- `Loading`: هل يظهر تحميل عند تغيير الفرع/التواريخ؟
- `Charts empty`: هل جداول/لوحات العرض تعطي Empty states واضحة عند عدم توفر بيانات؟
- `Error`: هل أي خطأ يظهر normalize عربي وغير خام؟

## WorkOS (Runtime)

### 1) `/work` و `/work/projects` و `/work/projects/:id`
- `Loading`: هل يوجد skeleton/تحميل؟
- `Empty`: هل تظهر رسائل توضح أن البيئة بلا بيانات بعد (وليس عطل)؟
- `Success`: بعد Create/Edit/Archive هل تظهر Success عربية؟
- `Stale UI`: بعد أي action (حفظ/أرشفة/ربط) هل يتم refresh صحيح؟

### 2) `/work/docs` و `/work/channels`
- `Empty`: عند غياب team spaces/docs/channels هل الرسالة توضح مسار الإجراء التالي؟
- `Actions`: إنشاء/تعديل/أرشفة/إضافة كتلة أو رسالة—هل Success عربي واضح؟ وهل refresh يحدث؟
- `Error`: normalizeWorkOsError مستخدم بشكل كافٍ (بدون raw)؟

### 3) `/work/inbox`
- `Empty`: عند عدم وجود notifications: هل يظهر Empty state واضح؟
- `Mark as read`: هل Counts تتغير فورًا؟ وهل “Mark all” يعمل على العناصر الظاهرة؟
- `Error`: لا تظهر رسائل raw.

### 4) `/work/search`
- `Hint`: عند query أقل من حرفين هل يظهر hint صحيح؟
- `Grouping`: هل النتائج تظهر حسب النوع (project/doc/task/channel) وبادجات واضحة؟
- `Empty`: عند عدم وجود نتائج هل النص مسبب وواضح؟

