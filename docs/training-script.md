# Training Script (Internal Demo + Training)

## Script مختصر (3-5 دقائق) لعرض المنتج

### 1) Restaurants (أولوية العرض)
1. افتح `/restaurant-pos`.
2. اختر فرعًا ثم اختر طاولة.
3. من `القائمة` أضف صنفًا.
4. اضغط `إرسال للمطبخ`.
5. افتح `/kds` وتأكد أن التذكرة ظهرت.
6. ارجع إلى POS ثم اضغط `الدفع`.
النتيجة المتوقعة: Success عربي بعد إرسال/دفع، وتحديث حالة التذكرة في KDS.

ماذا نقول عند ظهور empty state طبيعي؟
- إذا KDS يعرض “المطبخ جاهز” قبل أول إرسال: هذا طبيعي قبل وجود tickets.

ماذا نقول عند mismatch branch/tenant؟
- إذا لم تظهر ticket في KDS: غالبًا هناك اختلاف فرع بين POS وKDS. اطلب من المستخدم مطابقة الفرع.

### 2) Pharmacy
1. افتح `/pharmacy-pos` واختر الفرع.
2. من تبويب `Prescription` اختر وصفة من الطابور ثم اضغط `إضافة للصرف`.
3. اختر batch (لاحظ expiry badge).
4. من السلة اضغط `صرف الوصفة`.
النتيجة المتوقعة: Success عربي + تنظيف السلة + refresh للبنود/الطابور.

ماذا نقول عند empty طبيعي؟
- إذا لا توجد batches/نتائج: جرّب فرعًا آخر أو نفّذ receiving لتوليد batches (حسب البيانات المتوفرة).

ماذا نقول عند mismatch؟
- إذا نتائج الصرف/الطابور لا تتطابق: افتح نفس الفرع في جميع شاشات pharmacy ضمن نفس tenant.

### 3) WorkOS
1. افتح `/work/search` واكتب query (حرفين على الأقل).
2. افتح نتيجة من نوع مشروع/مستند/مهمة/قناة.
3. افتح `/work/inbox` وجرّب “تعليم الكل كمقروء”.
النتيجة المتوقعة: grouped results واضحة + counts تتغير + error messages عربية.

## Script أطول (15-25 دقيقة) لتدريب المستخدمين

### Restaurants (تفصيل)
1. `/restaurant-pos`
   - اعرض dropdown الفرع، ثم مخطط الطاولات.
   - اشرح: المسودة والـliveOrder.
   - سيناريو 1: صنف بدون modifiers.
   - سيناريو 2: صنف مع modifiers (modal + required groups).
   - اضغط `إرسال للمطبخ` وتابع الرسالة.
2. `/kds`
   - اشرح station filtering.
   - اضغط “بدء التحضير” ثم “جاهز” ثم “أغلق”.
   - اشرح أن tickets المحذوفة/المغلقة قد لا تظهر حسب منطق العرض (empty طبيعي بعد completion).
3. رجوع POS
   - اشرح الدفع وإغلاق modal.
   - راقب أن نجاح العملية يزيل الالتباس.

### Pharmacy (تفصيل)
1. `/pharmacy-pos`
   - اعرض mode switch: Prescription ↔ OTC.
   - سيناريو prescription:
     - اختر prescription من queue.
     - إضافة للصرف.
     - اختيار batch مع expiry badge.
     - `صرف الوصفة`.
   - سيناريو OTC:
     - mode OTC.
     - search + إضافة batch.
     - `إتمام بيع OTC`.
2. `/pharmacy-inventory`
   - اشرح tabs: current/near/expired/low.
   - اظهر batch awareness + expiry risk.
3. `/pharmacy-receiving`
   - ادخال سطر/عدة أسطر ثم `حفظ الاستلام`.
   - اشرح أن receiving يولد/يحدّث batches.

### WorkOS (تفصيل)
1. `/work/search`
   - اكتب query ووضح grouping حسب النوع.
   - افتح نتيجة ثم اشرح الفرق بين doc blocks / channels / tasks حسب المسار.
2. `/work/inbox`
   - اعرض غير المقروءة ثم “تعليم الكل كمقروء”.
3. `/work/projects/:id` أو `/work/docs`
   - اشرح نجاح عمليات Create/Update/Archive كما تظهر رسائل عربية.

## كيف نفسّر الحدود الحالية بدون إرباك؟
- “Empty state” لا يعني عطل دائمًا: قد يكون بسبب:
  - نقص بيانات seed على الفرع المختار.
  - mismatch branch في العمليات المتسلسلة (POS↔KDS أو pharmacy-pos↔batches/history/reports).
  - RLS (صلاحيات/tenant) تمنع البيانات.
- إذا ظهر error: الرسائل normalized قدر الإمكان، لكن في حالات raw طويلة قد يظهر fallback.

