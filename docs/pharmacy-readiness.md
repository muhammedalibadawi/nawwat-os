# Pharmacy Readiness — NawwatOS

دليل مختصر لاختبار قطاع الصيدلية يدويًا بعد تطبيق الـ migrations والـ seed.

---

## المتطلبات قبل الاختبار

| المتطلب | ملاحظة |
|--------|--------|
| تطبيق migrations الصيدلية | [`20260325150000_pharmacy_sector.sql`](../supabase/migrations/20260325150000_pharmacy_sector.sql) |
| بيانات منتجات/دفعات تجريبية | [`20260330120000_pharmacy_demo_seed.sql`](../supabase/migrations/20260330120000_pharmacy_demo_seed.sql) (يتخطى إن وُجدت `pharma_products`) |
| وصفات + مرضى تجريبيون | [`20260330180000_pharmacy_prescription_demo_seed.sql`](../supabase/migrations/20260330180000_pharmacy_prescription_demo_seed.sql) (يتخطى إن وُجدت `NW-SEED-RX-001` أو `002`) |
| حساب بـ `tenant_id` صحيح + دور مسموح | انظر [`src/config/permissions.ts`](../src/config/permissions.ts) و `RoleBasedRoute` في [`App.tsx`](../src/App.tsx) |
| متغيرات الواجهة لـ Supabase | `VITE_SUPABASE_URL` / المفتاح حسب مشروعك |

---

## جداول/عروض يجب أن تحتوي بيانات للاختبار الواقعي

- **`pharma_products`** / **`pharma_batches`**: بحث OTC، اختيار دفعة، مخزون.
- **`contacts`** (`patient` أو `customer`): قائمة المرضى في POS ووصفات.
- **`pharma_prescriptions`** + **`pharma_prescription_items`**: وضع الوصفة في POS وقائمة الوصفات.
- **`pharma_prescription_queue_v`**: ما يقرأه POS والتفاصيل (مجمّع من الوصفات + البنود).
- **`pharma_patient_med_history`**: (اختياري) شاشة التاريخ الدوائي — عيّنة من الـ seed إن وُجدت.

فحوصات SQL جاهزة: **[`docs/pharmacy-sanity-checks.sql`](pharmacy-sanity-checks.sql)**

---

## المسارات والأدوار (ملخص)

| المسار | أدوار تقريبية (راجع الكود) |
|--------|----------------------------|
| `/pharmacy-pos` | owner, master_admin, branch_manager, pharmacist, cashier, doctor, receptionist |
| `/prescriptions` | owner, master_admin, branch_manager, pharmacist, doctor, receptionist |
| `/pharmacy-inventory` | owner, master_admin, branch_manager, pharmacist, warehouse, procurement |
| `/pharmacy-receiving` | نفس صلاحيات المخزون الصيدلاني |
| `/patient-med-history` | owner, master_admin, branch_manager, pharmacist, doctor |
| `/pharmacy-reports` | owner, master_admin, branch_manager, pharmacist, accountant |

---

## كيف تختبر (خطوات ونتائج متوقعة)

### 1) `/pharmacy-pos` — وضع الوصفة (Prescription)

1. سجّل الدخول بدور يسمح بالمسار.
2. اختر **الفرع** نفسه الذي فيه دفعات (`pharma_batches`).
3. في الوضع **وصفة**: يجب أن تظهر في الطابور وصفات بحالات `draft` / `verified` / `partially_dispensed` (الـ seed يضيف `NW-SEED-RX-001` معلّمة **verified** و `NW-SEED-RX-002` **draft**).
4. اختر وصفة verified → تُحمّل التفاصيل والبنود.
5. أضف للسلة عبر اختيار دفعة (FEFO/اختيار دفعة) إن ظهر المودال.
6. **متوقع بعد الصرف الناجح**: تحديث مخزون الدفعة، وسجلات صرف حسب الـ RPC (إن نجحت الصلاحيات).

### 2) `/pharmacy-pos` — OTC

1. حوّل إلى وضع **OTC** (إن وُجد في الواجهة).
2. ابحث عن صنف يظهر في `pharma_batch_availability_v` لفرعك.
3. **متوقع**: نتائج بحث، إضافة للسلة، إكمال بيع OTC عبر `pharmacy_complete_otc_sale` عند التأكيد.

### 3) `/prescriptions`

1. تظهر قائمة من `pharma_prescription_queue_v` / الجداول الأساسية.
2. **متوقع**: رؤية `NW-SEED-RX-001` و `NW-SEED-RX-002`؛ فتح تفاصيل، تعديل مسودة إن يدعمها الـ UI.

### 4) `/pharmacy-inventory`

1. جداول/فلاتر على دفعات أو منتجات حسب الشاشة.
2. **متوقع**: دفعات الـ seed (`DEMO-BATCH-*`) لفرع البذرة؛ تعديل/تسوية عبر RPCs عند الضغط (إن مسموح بالدور).

### 5) `/pharmacy-receiving`

1. **متوقع**: الشاشة تفتح؛ تدفق الاستلام يعتمد على `pharmacy_receive_batches` ومورد من `contacts` (الـ seed يضيف موردًا تجريبيًا).

### 6) `/patient-med-history`

1. قائمة المرضى من `contacts` (أنواع `patient`/`customer`).
2. **متوقع**: مرضى الـ seed يظهرون؛ لمرضى **أحمد** قد يظهر صف في `pharma_patient_med_history` إن طبقت البذرة بنجاح.

### 7) `/pharmacy-reports`

1. **متوقع**: تحميل تقارير أو **empty state** نظيف دون خطأ خام من Postgres.

---

## Troubleshooting

| العرض | ماذا تفحص |
|--------|-----------|
| خطأ PostgREST: relationship بين `pharma_products` و `item_id` | تمت معالجته في الواجهة: الـ FK مركّب `(tenant_id, item_id)` فلا يدعم تضمين `items:item_id`؛ الخدمة تجلب `items` باستعلام ثانٍ. إن ظهر الخطأ قديمًا، أعد بناء الواجهة وحدّث cache المتصفح. |
| لا مرضى في POS | `contacts` بنوع `patient` أو `customer` و `is_active`؛ RLS على `contacts` |
| لا وصفات في الطابور | حالة الوصفة يجب أن تكون ضمن `draft`/`verified`/`partially_dispensed`؛ نفس **الفرع** |
| لا نتائج بحث دوائي | `pharma_batch_availability_v` لذلك `branch_id`؛ كمية متاحة > 0 |
| خطأ RLS / permission denied | JWT يحمل `tenant_id` و`user_role` المتوقعين لدوال `pharmacy_can_*` |
| فشل RPC عند الصرف | Network tab → رسالة الخطأ؛ تحقق من مخزون الدفعة وحالة الوصفة |

---

## مراجع كود

| المنطقة | الملف |
|--------|--------|
| الخدمة | [`src/services/pharmacyService.ts`](../src/services/pharmacyService.ts) |
| أنواع | [`src/types/pharmacy.ts`](../src/types/pharmacy.ts) |
| مساعدات | [`src/utils/pharmacy.ts`](../src/utils/pharmacy.ts) |

---

*بيانات الـ seed مميّزة بأرقام وصفات `NW-SEED-RX-*` وملاحظات `nawwat_seed:*` لتسهيل التمييز والحذف اليدوي لاحقًا إن لزم.*
