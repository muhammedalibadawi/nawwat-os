# Launch Classification (Internal Rollout)

## Ready for internal rollout
### WorkOS
السبب:
- طبقة WorkOS routes مدعومة بـ demo seed (حسب ما تم سابقًا).
- رسائل empty/error normalized عربية واضحة نسبيًا، وواجهة search/inbox مصممة لسهولة التشغيل.
- المخاطر الأكبر هنا “بيانات ناقصة” لا “broken runtime”.

## Internal beta
### Restaurants
السبب:
- flow حساس لفرع POS vs KDS (branch alignment)؛ أي mismatch يسبب tickets لا تظهر.
- محطة KDS filtering قد تخفي tickets إذا محطة الصنف لا تطابق التصفية الحالية.
- ما زال يعتمد على data sparsity (وجود أصناف/طاولات فعالة).

### Pharmacy
السبب:
- flow حساس لـ mode (Prescription/OTC) واختيار branch المناسب.
- batch/expiry awareness طبيعي أن يظهر empty أو warnings إذا البيانات خفيفة أو صلاحيات/tenant mismatch.

## Needs monitored usage
### (حاليًا لا يوجد تصنيف إضافي منفصل خارج Restaurants/Pharmacy)
- نحتفظ بالمراقبة لتأكيد أن الرسائل لا تكون “مضللة” خلال الأسبوع الأول.

## Not for broad rollout yet
- لا ينطبق حاليًا ضمن النطاق المطلوب، لكن لا يوصى بتوسيع واسع قبل أسبوع monitoring (KDS branch + pharmacy batch/expiry + RLS messaging).

## لماذا هذا التصنيف منطقي؟
- الأهم في التشغيل الداخلي هو تقليل “التباس المستخدم” وليس ضمان وجود data دائمًا.
- RLS وtenant/branch alignment هما أكثر الأسباب شيوعًا للـempty، لذلك التصنيف يراعي ذلك.

