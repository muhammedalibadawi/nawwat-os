# Restaurant Readiness Pack — NawwatOS F&B

دليل مختصر لتشغيل واختبار قطاع المطاعم يدويًا: **Restaurant POS**، **KDS**، **إدارة القائمة**. لا يستبدل مراجعة RLS والبيئة.

---

## المتطلبات قبل الاختبار

| المتطلب | ملاحظة |
|--------|--------|
| مشروع Supabase مرتبط والـ migrations مطبّقة | انظر قسم «Migrations» أدناه |
| حساب مستخدم في التطبيق بنفس `tenant_id` الذي فيه البيانات | JWT / جدول `profiles` |
| متغيرات الواجهة | `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` (أو ما يعادلهما في مشروعك) |
| الصلاحيات (دور المستخدم) | انظر «أدوار المسارات» |

### أدوار المسارات (من `src/config/permissions.ts`)

- **`/restaurant-pos`**: `owner`, `master_admin`, `branch_manager`, `cashier`
- **`/kds`**: `owner`, `master_admin`, `branch_manager`, `kitchen`
- **`/menu-management`**: `owner`, `master_admin`, `branch_manager`

إذا فتحت الرابط وظهرت صفحة غير مصرّح: سجّل الدخول بدور يسمح بالمسار.

---

## Migrations المطلوبة (قطاع المطاعم)

1. **`supabase/migrations/20260324120000_fnb_restaurant_sector.sql`**  
   يضيف الجداول، الـ views (`fb_menu_catalog_v`, `fb_orders_live_v`)، ودوال الـ RPC:
   - `restaurant_send_order_to_kitchen`
   - `restaurant_complete_payment`
   - `restaurant_cancel_order`
   - `restaurant_update_kds_ticket_status`  
   ويعتمد على وجود **`get_effective_branch_settings(tenant, branch)`** في قاعدة البيانات (عادة من migrations الأساسية للمنصة / الفروع).

2. **`supabase/migrations/20260329200000_restaurant_demo_seed.sql`** (اختياري لكنه يُسهّل الاختبار)  
   بيانات تجريبية **minimal** لفرع نشط واحد (أول فرع حسب `is_default` ثم `created_at`):
   - **يتخطى التنفيذ** إذا وُجدت أي صف في `fb_tables` لنفس الـ tenant (idempotent بالنية).
   - يُنشئ: تصنيفات قائمة، `items` من نوع `menu_item`، `fb_menu_items`، طاولات (1–3)، مجموعات معدلات ومعدلات وروابط.

تطبيق عبر CLI (من جذر المشروع):

```bash
supabase db push
```

أو تشغيل محتوى الملفات يدويًا في SQL Editor بالترتيب أعلاه.

---

## Seed / demo data — ماذا تتوقع؟

بعد تطبيق `20260329200000_restaurant_demo_seed.sql` بنجاح (ولم يُتخطَّ):

- فروع: لا يُنشئ فرعًا جديدًا؛ يستخدم **أول فرع نشط** موجود.
- `fb_tables`: عادة 3 صفوف (طاولة 1، 2، 3 — حسب النصوص في الـ migration).
- `fb_menu_items` + `items` + `categories` (نوع `menu`): صفوف كافية لعرض قائمة في POS وإدارة القائمة.
- `fb_kds_tickets`: **صفر** حتى ترسل أول طلب من POS إلى المطبخ.

إذا ظهر `NOTICE` يقول إن البذرة تُتخطى: إما لا يوجد فرع نشط، أو `fb_tables` موجود مسبقًا لذلك الـ tenant.

---

## التحقق السريع من البيانات (SQL)

استخدم الملف الجاهز:

- **[`docs/restaurant-sanity-checks.sql`](restaurant-sanity-checks.sql)**

يحتوي على:

- التحقق من وجود الـ views والـ RPCs الأساسية.
- بلوك `DO $$ ... $$` يطبع أعدادًا لكل tenant بعد استبدال `tenant_id`.

**أين أجد `tenant_id`؟** من لوحة Supabase (`profiles`)، أو من جدول `branches`، أو من claims الـ JWT في التطبيق.

---

## اختبار `/restaurant-pos` خطوة بخطوة

1. **افتح** `/restaurant-pos` بعد تسجيل الدخول (بدور مسموح).
2. **المتوقع**: تحميل بدون crash؛ إما قائمة فروع أو رسالة **«لا يوجد فرع نشط»** إن لم توجد فروع.
3. **اختر فرعًا** من القائمة.
4. **المتوقع**: ظهور **خريطة الطاولات**؛ طاولات من `fb_tables` لهذا الفرع.
5. **اضغط طاولة** متاحة (`available`).
6. **المتوقع**: ظهور أقسام القائمة والأصناف (من `fb_menu_catalog_v` بعد فلترة `branch_id` / قائمة عامة بـ `branch_id` فارغ).
7. **أضف صنفًا** للسلة؛ إن وُجدت معدلات إلزامية يظهر المودال.
8. **غيّر الكمية** من لوحة الطلب.
9. **أرسل للمطبخ** (يستدعي `restaurant_send_order_to_kitchen`).
10. **المتوقع**: طلب نشط على الطاولة؛ في قاعدة البيانات: سجلات طلب/بنود؛ تذاكر KDS جديدة حسب محطات التحضير.
11. **الدفع**: من نفس تدفق POS عند اكتمال الطلب؛ يستدعي `restaurant_complete_payment`.
12. **المتوقع**: تحديث حالة الطلب؛ الطاولة تعود **متاحة** عند اكتمال التدفق كما صمّمته الـ RPC.

### أخطاء شائعة في POS

| العرض | أين تبحث |
|--------|----------|
| لا فروع | `branches` + `is_active` + RLS؛ دور المستخدم |
| لا طاولات | `fb_tables` لـ `branch_id` المختار |
| قائمة فارغة | `fb_menu_catalog_v`؛ `fb_menu_items`؛ تطابق `tenant_id`؛ فلترة الفرع |
| فشل الإرسال / دفع | Network tab → رسالة `safeRestaurantErrorMessage`؛ تنفيذ RPC في SQL مع نفس المستخدم صعب — راجع **RLS** و**GRANT** على الدوال |

---

## اختبار `/kds` خطوة بخطوة

1. **افتح** `/kds` (بدور `kitchen` أو أعلى حسب الجدول أعلاه).
2. **اختر نفس الفرع** المستخدم في POS (إن وُجد أكثر من فرع).
3. **المحطات (station)**: جرّب `all` ثم محطة محددة (`main`, `cold`, …) حسب بيانات الأصناف.
4. **قبل إرسال طلب**: قائمة فارغة أو empty state — طبيعي.
5. **بعد إرسال طلب من POS**: **المتوقع** ظهور تذاكر في الجدول `fb_kds_tickets` مع `items_snapshot` مقروء.
6. **غيّر الحالة**: pending → preparing → ready عبر الأزرار (RPC `restaurant_update_kds_ticket_status`).
7. **Realtime**: إن لم يتحدث فورًا، استخدم زر التحديث في الشاشة؛ قد تظهر رسالة تحذير للـ realtime دون كسر التدفق.

### أخطاء شائعة في KDS

| العرض | أين تبحث |
|--------|----------|
| لا تذاكر بعد الإرسال | فرع مختلف عن POS؛ فلتر `station`؛ RLS على `fb_kds_tickets` |
| بطاقة فارغة / crash قديم | تم تصليب `items_snapshot` في `KDSTicketCard` — إن استمر، راجع شكل JSON في العمود |
| خطأ خام من Postgres | `restaurantService.ts` → `safeRestaurantErrorMessage`؛ ثم سياسات RLS |

---

## اختبار `/menu-management` خطوة بخطوة

1. **افتح** `/menu-management` (بدور مسموح).
2. **تبويب أصناف القائمة**: جدول أو empty state نظيف.
3. **تبويب التصنيفات**: تصنيفات نوع قائمة.
4. **تبويب المعدلات**: مجموعات + معدلات.
5. **تبويب الوصفات والتكلفة**: يعتمد على `items` / `recipes` / `recipe_ingredients` — قد يكون فارغًا دون كسر الصفحة.
6. **إن لم يوجد فرع نشط**: تظهر رسالة توضيحية بدل قائمة فرع فارغة.

### أخطاء شائعة في إدارة القائمة

| العرض | أين تبحث |
|--------|----------|
| كل شيء فارغ مع وجود بيانات في DB | `tenant_id` للمستخدم ≠ tenant البذور |
| فشل حفظ | RLS على `fb_menu_items`, `categories`, `fb_modifier_groups`, … |
| تكلفة / هامش غريب | ربط `item_id` و`recipes` في نفس الـ tenant |

---

## Troubleshooting (ملخّص)

### لا تظهر الفروع

- تحقق `SELECT * FROM branches WHERE tenant_id = '...' AND is_active = true`.
- تحقق أن المستخدم الحالي يحمل نفس `tenant_id`.
- RLS: هل سياسة `SELECT` على `branches` تسمح لهذا الدور؟

### لا تظهر الطاولات

- `fb_tables.branch_id` يطابق الفرع المختار في الواجهة.
- الطاولة `is_active` إن وُجد العمود والفلتر في الاستعلام.

### لا تظهر الأصناف

- صفوف في `fb_menu_catalog_v` لذلك الـ `tenant_id`.
- عناصر بـ `branch_id` NULL (عامة للمستأجر) أو تساوي الفرع المختار.

### لا تظهر تذاكر KDS

- نفس الفرع بين POS و KDS.
- فلتر المحطة: جرّب `all`.
- تحقق `fb_kds_tickets` بعد الإرسال (انظر sanity SQL).

### فشل الدفع

- استدعاء `restaurant_complete_payment` في Network — اقرأ `message` من Supabase.
- حالة الطلب: يجب أن يسمح الـ RPC بإكمال الدفع (مثلاً طلب في حالة مناسبة).
- مبالغ الدفعات (`RestaurantPaymentSplit`) يجب أن تطابق التوقعات في الـ backend.

### مشاكل RLS

- لوحة Supabase → Authentication → جرّب كـ المستخدم نفسه صعب؛ غالبًا مراجعة السياسات على:
  `fb_tables`, `fb_menu_items`, `fb_orders_live_v` (إن كان قابل للـ select), `fb_order_items`, `fb_kds_tickets`, وجداول المعدلات.
- تأكد أن دوال الـ RPC **`SECURITY DEFINER`** كما في migration المطاعم وتملك `GRANT` لـ `authenticated`.

### الشاشات تفتح لكن البيانات فارغة

- غالبًا **tenant خاطئ** أو **لم تُشغَّل بذرة التجربة** على هذا المستأجر.
- نفّذ [`restaurant-sanity-checks.sql`](restaurant-sanity-checks.sql) بعد تعيين الـ UUID الصحيح.

---

## مراجع كود (للمطور)

| المنطقة | الملف |
|--------|--------|
| خدمة المطاعم | [`src/services/restaurantService.ts`](../src/services/restaurantService.ts) |
| POS | [`src/pages/RestaurantPOSScreen.tsx`](../src/pages/RestaurantPOSScreen.tsx) |
| KDS | [`src/pages/KDSScreen.tsx`](../src/pages/KDSScreen.tsx) |
| إدارة القائمة | [`src/pages/MenuManagementScreen.tsx`](../src/pages/MenuManagementScreen.tsx) |
| Migration القطاع | [`supabase/migrations/20260324120000_fnb_restaurant_sector.sql`](../supabase/migrations/20260324120000_fnb_restaurant_sector.sql) |
| بذرة تجريبية | [`supabase/migrations/20260329200000_restaurant_demo_seed.sql`](../supabase/migrations/20260329200000_restaurant_demo_seed.sql) |

---

## بناء الواجهة قبل الجلسة

من جذر الواجهة (حيث يوجد `package.json` الخاص بـ Vite):

```bash
npm run build
```

---

*آخر تحديث: حزمة الجاهزية لقطاع المطاعم فقط — بدون ميزات جديدة وبدون تغييرات على الصيدلية.*
