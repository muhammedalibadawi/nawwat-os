# Role Access Matrix (Tenant/Role + Routes)

هذا الجدول يعتمد على `src/App.tsx` (مصفوفة `allowedRoles` لكل route) + `src/components/RoleBasedRoute.tsx` (فحص الدور + base route) + `src/config/permissions.ts` (قائمة الطرق لكل role).

> ملاحظة: منطق `RoleBasedRoute` يفحص `baseRoute` كالتالي: أول جزء بعد `/` في المسار الحالي. لذلك كل مسارات WorkOS تحت `/work/*` تُعتبر `baseRoute = /work`.

## WorkOS Routes (`/work`, `/work/*`)
الأدوار المسموحة (حسب `WORK_OS_ALLOWED_ROLES` في `src/App.tsx`):
- `owner`
- `master_admin`
- `branch_manager`
- `accountant`
- `hr`
- `procurement`
- `sales`
- `doctor`
- `pharmacist`
- `receptionist`
- `teacher`
- `viewer`
- `cashier`
- `kitchen`
- `warehouse`

لماذا منطقي؟
- هذه الأدوار تشترك في امتلاك صلاحية قراءة/استخدام WorkOS بناءً على طبقة WorkOS، بينما يتم تقييد البيانات الفعلي عبر RLS في قاعدة البيانات (وبالتالي حتى لو كان route متاحًا، قد لا تظهر بيانات غير مسموحة).

## Restaurants Routes

### `/restaurant-pos`
الأدوار المسموحة:
- `owner`
- `master_admin`
- `branch_manager`
- `cashier`

لماذا منطقي؟
- POS يتطلب صلاحية تشغيل point-of-sale + إرسال الطلبات للمطبخ/إدارة الطلبات، بينما عمليات KDS محكومة بأدوار المطبخ.

### `/kds`
الأدوار المسموحة:
- `owner`
- `master_admin`
- `branch_manager`
- `kitchen`

لماذا منطقي؟
- شاشة المطبخ مخصصة لمحطات التحضير (حركة التذاكر/تغيير الحالات).

### `/menu-management`
الأدوار المسموحة:
- `owner`
- `master_admin`
- `branch_manager`

لماذا منطقي؟
- إدارة قائمة الطعام/التصنيفات/المعدلات حساسة وتشمل تعديل بيانات التشغيل (menu catalog).

## Pharmacy Routes

### `/pharmacy-pos`
الأدوار المسموحة:
- `owner`
- `master_admin`
- `branch_manager`
- `pharmacist`
- `cashier`
- `doctor`
- `receptionist`

لماذا منطقي؟
- POS الصيدلية يشمل صرف (Prescription) + OTC ضمن تدفق واحد، وهو متاح لأدوار الصيدلة والتعامل مع الوصفات والعميل.

### `/prescriptions`
الأدوار المسموحة:
- `owner`
- `master_admin`
- `branch_manager`
- `pharmacist`
- `doctor`
- `receptionist`

لماذا منطقي؟
- إدارة الوصفات تتطلب صلاحية إنشاء/تعديل مسودات والوصول لتفاصيل الوصفة.

### `/pharmacy-inventory`
الأدوار المسموحة:
- `owner`
- `master_admin`
- `branch_manager`
- `pharmacist`
- `warehouse`
- `procurement`

لماذا منطقي؟
- المخزون يحتاج صلاحية تعديل/تتبّع batch-aware وإجراءات الجرد والتعديلات ومرتجعات/استلامات مرتبطة بالمخزن والمشتريات.

### `/pharmacy-receiving`
الأدوار المسموحة:
- `owner`
- `master_admin`
- `branch_manager`
- `pharmacist`
- `warehouse`
- `procurement`

لماذا منطقي؟
- شاشة الاستلام مرتبطة بإنشاء/تحديث دفعات عبر RPC.

### `/patient-med-history`
الأدوار المسموحة:
- `owner`
- `master_admin`
- `branch_manager`
- `pharmacist`
- `doctor`

لماذا منطقي؟
- سجل التاريخ الدوائي مرتبط بعلاقة المريض ويحتاج صلاحية طبية/صيدلانية.

### `/pharmacy-reports`
الأدوار المسموحة:
- `owner`
- `master_admin`
- `branch_manager`
- `pharmacist`
- `accountant`

لماذا منطقي؟
- التقارير تشمل مخاطر/هامش/مرتجعات ومخزون، ووجود `accountant` منطقي للقراءة التحليلية.

