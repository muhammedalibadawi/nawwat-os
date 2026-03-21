# NawwatOS — ملف السياق الدائم v2.0
**انسخ كل المحتوى ده وحطه في أول أي محادثة جديدة مع Claude**
**آخر تحديث: مارس 2026**

---

## 🏢 المشروع

**الاسم:** NawwatOS
**النوع:** Enterprise ERP — Cloud SaaS
**السوق:** UAE + KSA — عربي أولاً
**الهدف:** كل إنسان في الشركة يفتح NawwatOS يلاقي اللي يخصه هو — مش كل حاجة

---

## 👤 صاحب المشروع

- خبرة حقيقية في السوق — اشتغل في كل القطاعات (F&B, Retail, Real Estate, Manufacturing)
- يعرف الناس محتاجة إيه من تجربة مباشرة
- بيتعلم AI tools دلوقتي
- عنده Cursor AI
- الـ execution على Claude — الـ vision على صاحب المشروع

---

## ⚙️ الـ Tech Stack المتفق عليه

| الطبقة | الأداة | السبب |
|--------|--------|-------|
| Frontend | React + TypeScript + Tailwind | من الـ HTML demo الحالي |
| Backend | Supabase | DB + Auth + RLS + Real-time في يوم واحد |
| Deployment | Vercel | Git push = deployed |
| Automation | n8n self-hosted | WhatsApp + ZATCA + Webhooks |
| Analytics | PostHog | مجاني لأول مليون event |
| Support | Crisp | مجاني للبداية |
| AI داخل النظام | Claude API | AI Chat بالعربي |
| IDE | Cursor AI | Claude مدمج في الكود |
| **Price Intelligence** | **PriceIQ Microservice** | **مقارنة أسعار Amazon/Noon** |

---

## 📁 حالة المشروع الحالية

### ✅ مكتمل (UI/UX)
- NawwatOS v4.0 — Single HTML file (262KB)
- 32+ module مبني كـ UI/UX
- Arabic RTL كامل
- Multi-branch UI
- Role-based permissions UI
- ZATCA / WPS / Corporate Tax 9% UI
- WhatsApp templates UI
- E-Commerce (Noon/Salla/Shopify) UI
- Manufacturing + BOM UI
- Fixed Assets UI
- Customer/Supplier Portal UI
- AI Chat UI
- Audit Trail UI

### ✅ مكتمل (Schema)
- `nawwat_schema_v4_1_COMPLETE.sql` — PostgreSQL/Supabase كامل
- Multi-Tenant RLS (subquery pattern)
- price_history (internal — cost/selling price changes)
- 44 table شاملة كل القطاعات

### ✅ مكتمل (PriceIQ Integration — جديد)
- SQL Migration: `market_price_snapshots` + `market_price_alerts` + `item_market_intelligence` view
- Supabase Edge Function: `priceiq-query`
- React Component: `MarketPriceWidget`
- الدمج مع `notifications` table الموجود (WhatsApp alerts)

### ❌ ناقص (مرتب بالأولوية)
1. **Backend / Database** — مفيش حاجة بتتحفظ
2. **Authentication حقيقي** — مفيش login حقيقي
3. **Multi-Tenant** — عزل بيانات بين العملاء
4. **Role-Based Home Screens** — كل user يشوف شاشته
5. **PriceIQ Deployment** — رفع الـ microservice على سيرفر
6. **Recipe Costing** — للـ F&B
7. **Loyalty Program** — للـ Retail
8. **Ejari Integration** — للـ Real Estate (UAE legal)
9. **Mobile PWA**

---

## 🔗 PriceIQ Integration — ملخص سريع

### الفرق المهم
```
price_history (نواه داخلي) ← أسعار الشركة نفسها (cost/selling)
market_price_snapshots     ← أسعار السوق (Amazon / Noon / Carrefour)
```

### الـ Tables الجديدة
| Table | الوظيفة |
|-------|---------|
| `market_price_snapshots` | كل مرة نواه يسأل عن سعر السوق |
| `market_price_alerts` | تنبيهات "وصّلني لما السعر يوصل X" |
| `item_market_intelligence` | View يجمع سعر نواه + السوق |

### كيف الدمج بيشتغل
```
React (نواه) → Supabase Edge Function → PriceIQ API → يحفظ في Supabase
```

### الـ Modules اللي هتستفيد
- **Procurement:** عند إنشاء طلب شراء → فحص أسعار السوق تلقائي
- **Inventory:** تقرير المخزون → كل منتج عنده assessment (overpriced/fair/competitive)
- **Pricing:** شاشة المنتج → Widget مقارنة مباشر

### Environment Variables المطلوبة في Supabase
```
PRICEIQ_URL = http://your-priceiq-server:8000
```

---

## 🗺️ خريطة الطريق

### Phase 1 — شهر 1-3: Foundation
- Supabase setup كامل
- Database schema (multi-tenant) ✅ جاهز
- Authentication + Roles
- أول 5 modules حقيقيين: POS + Inventory + Invoices + HR + Accounting
- PriceIQ deployment + ربط أول module

### Phase 2 — شهر 3-6: First Market
- F&B completion (Recipe Costing + Waste + Delivery)
- Retail completion (Loyalty + Inter-branch + Market Price Intelligence)
- 10 pilot clients في دبي — مجاناً

### Phase 3 — شهر 6-10: Revenue
- Pricing live: Starter Free / Growth AED 199 / Branch AED 149
- ZATCA Phase 2 حقيقي
- WhatsApp API حقيقي
- PWA Mobile
- PriceIQ على كل الـ modules

### Phase 4 — شهر 10-18: Scale
- KSA launch
- Real Estate + Manufacturing sectors
- Partner network
- AI Assistant بالعربي (حقيقي)

---

## 💰 الـ Pricing Model

| الخطة | السعر | المحتوى |
|-------|-------|---------|
| Starter | مجاني | فرع واحد، 3 users، POS + Inventory + Invoices |
| Growth | AED 199/شهر | فرع واحد، 15 user، كل الـ modules |
| Business | AED 149/فرع/شهر | فروع متعددة، users غير محدودين |
| Enterprise | Custom | Multi-entity، SLA، custom dev |

---

## 🤝 توزيع الأدوار

**Claude:**
- كل الكود (HTML, CSS, JS, React, SQL, API)
- Database schema + architecture
- Business strategy + decisions
- Arabic UX + compliance logic
- Documentation

**صاحب المشروع:**
- Vision + قرارات المنتج النهائية
- معرفة السوق والعملاء
- جلب أول 10 عملاء حقيقيين
- Feedback من السوق
- Pricing + positioning decisions

---

## 🎯 القرار الأهم المعلق

**مين أول عميل حقيقي؟**
- لسه مش محدد
- الخيارات: مطعم / صيدلية / retail بفرعين / عقارات
- ده هيحدد الـ module الأول اللي هيتبني backend حقيقي

---

## 📋 قواعد العمل بيننا

1. **كل محادثة جديدة** — حط الملف ده في الأول
2. **مش هنبني features جديدة** قبل ما الـ Backend يكون جاهز
3. **كل قرار كبير** — Claude بيوضح options وصاحب المشروع بيختار
4. **الكود دايماً** بيتبني فوق الـ v4.0 HTML الحالي — مش من الصفر
5. **اللغة:** عربي في التواصل، English في الكود والتقنيات
6. **PriceIQ** بيشتغل كـ microservice منفصل — نواه بيناديه عبر Supabase Edge Functions

---

## 📂 الملفات الموجودة

| الملف | الوصف |
|-------|-------|
| `nawwat_os_v4.html` | الـ demo الكامل (262KB) |
| `nawwat_schema_v4_1_COMPLETE.sql` | Database schema الكامل |
| `NawwatOS_Strategy_v1.docx` | الوثيقة الاستراتيجية |
| `NawwatOS_MasterPlan.html` | خريطة الطريق التفاعلية |
| `NAWWAT_CONTEXT.md` | ملف السياق ده (محدَّث) |
| `priceiq_integration.sql` | Migration لـ PriceIQ tables |
| `priceiq-query/index.ts` | Supabase Edge Function |
| `MarketPriceWidget.tsx` | React component |

---

## 🔑 الـ Context لآخر محادثة

**آخر حاجة اتعملت:**
- دمج PriceIQ كـ microservice مع نواه
- SQL migration: `market_price_snapshots` + `market_price_alerts` + view
- Supabase Edge Function للتواصل مع PriceIQ
- React Widget للعرض في شاشة المنتج

**الخطوة الجاية:**
- رفع PriceIQ على سيرفر (Docker)
- ربط أول module حقيقي (Procurement أو Inventory)
- تحديد أول عميل لبدء الـ Backend

**المعلق:**
- تحديد أول عميل / قطاع
- Authentication setup في Supabase
