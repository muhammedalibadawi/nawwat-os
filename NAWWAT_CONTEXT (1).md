# NawwatOS — ملف السياق الدائم v3.0
**آخر تحديث: مارس 2026**
**انسخ كل المحتوى ده وحطه في أول أي محادثة جديدة مع Claude**

---

## 🏢 المشروع

**الاسم:** NawwatOS — نواة
**النوع:** Enterprise ERP — Cloud SaaS Multi-Tenant
**السوق:** UAE + KSA — عربي أولاً
**الهدف:** كل إنسان في الشركة يفتح NawwatOS يلاقي اللي يخصه هو — مش كل حاجة
**الـ Tagline:** "النظام اللي يعرف شغلتك"

---

## 👤 صاحب المشروع

- خبرة حقيقية في السوق — اشتغل في كل القطاعات (F&B, Retail, Real Estate, Manufacturing)
- يعرف الناس محتاجة إيه من تجربة مباشرة
- بيتعلم AI tools دلوقتي — عنده Cursor AI
- الـ execution على Claude — الـ vision على صاحب المشروع

---

## ⚙️ الـ Tech Stack

| الطبقة | الأداة |
|--------|--------|
| Frontend | React 18 + TypeScript + Tailwind |
| Backend | Supabase (DB + Auth + RLS + Realtime) |
| Deployment | Vercel |
| Automation | n8n self-hosted (WhatsApp + ZATCA) |
| Analytics | PostHog |
| Support | Crisp |
| AI داخل النظام | Claude API `claude-sonnet-4-20250514` |
| IDE | Cursor AI |

---

## 🎨 Design System — ثابت لا يتغير أبداً

### Colors
```
Midnight Blue (Sidebar/Dark BG): #071C3B
Electric Cyan (Accent):          #00CFFF
Cyan Soft (hover/glow):          rgba(0,207,255,0.18)
Cyan Softer (bg tints):          rgba(0,207,255,0.08)
Page BG (Light):                 #F4F7FC
Card BG:                         #FFFFFF
Text Primary:                    #071C3B
Text Muted / Labels:             #8A97B0
Border / Divider:                #E8EDF5
Success:                         #06D6A0
Danger:                          #EF476F
Warning:                         #FFD166
```

### Typography
```
Headings / Logo / Numbers:  Nunito (700, 800, 900)
Body / UI:                  Plus Jakarta Sans (400, 500, 600, 700)
Google Fonts:
  https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900
  &family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap
```

### Layout
```
Sidebar width:        240px (collapsed: 68px)
Topbar height:        64px
Card border-radius:   18px
Button border-radius: 12px
Active nav item:      white text + rgba(255,255,255,0.1) bg + 3px cyan left border
Transition easing:    cubic-bezier(0.22, 1, 0.36, 1)
```

---

## 🔵 الـ Logo — مواصفات كاملة (SVG) — لا يتغير

### المفهوم
"نواة" = الأشياء المتفرقة بتتجمع في مركز واحد.
- **Nucleus:** دائرة كبيرة midnight = الـ ERP core
- **3 Satellites (سيان):** كل نقطة قطاع مختلف بيتجه للمركز
- **Flow Trails:** ellipses شفافة توحي بالحركة والتجمع

### SVG الأساسي 32×32 — للـ Sidebar (على dark bg)
```svg
<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32">
  <circle cx="16" cy="16" r="10" fill="rgba(0,207,255,0.07)"/>
  <ellipse cx="9.5" cy="8" rx="4" ry="2" fill="rgba(0,207,255,0.2)" transform="rotate(-42 9.5 8)"/>
  <ellipse cx="26" cy="14.5" rx="4.5" ry="1.8" fill="rgba(0,207,255,0.16)" transform="rotate(-8 26 14.5)"/>
  <ellipse cx="11" cy="25" rx="4" ry="1.8" fill="rgba(0,207,255,0.18)" transform="rotate(30 11 25)"/>
  <circle cx="6"  cy="6"  r="3"   fill="#00CFFF"/>
  <circle cx="27" cy="14" r="2.5" fill="#00CFFF" opacity="0.85"/>
  <circle cx="8"  cy="26" r="2.8" fill="#00CFFF" opacity="0.9"/>
  <circle cx="16" cy="16" r="7.5" fill="white"/>
</svg>
```
> على **light background**: آخر circle = `fill="#071C3B"`

### SVG الكبير 96×96 — للـ Landing / Login
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <circle cx="48" cy="48" r="30" fill="rgba(0,207,255,0.06)"/>
  <ellipse cx="31" cy="27" rx="11" ry="5.5" fill="rgba(0,207,255,0.22)" transform="rotate(-42,31,27)"/>
  <ellipse cx="72" cy="45" rx="13" ry="5"   fill="rgba(0,207,255,0.18)" transform="rotate(-8,72,45)"/>
  <ellipse cx="38" cy="75" rx="11" ry="5"   fill="rgba(0,207,255,0.20)" transform="rotate(30,38,75)"/>
  <circle cx="22" cy="20" r="9"   fill="#00CFFF"/>
  <circle cx="80" cy="44" r="7.5" fill="#00CFFF" opacity="0.85"/>
  <circle cx="28" cy="78" r="8.5" fill="#00CFFF" opacity="0.9"/>
  <circle cx="48" cy="48" r="22"  fill="#071C3B"/>
</svg>
```
> على **dark background**: آخر circle = `fill="white"`

### Wordmark (HTML)
```html
<!-- على dark background (Sidebar) -->
<span style="font-family:'Nunito',sans-serif;font-size:18px;font-weight:800;color:white;letter-spacing:-0.3px;line-height:1;">nawwat</span>
<span style="display:block;font-size:9px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#00CFFF;margin-top:-1px;">OS</span>

<!-- على light background -->
<span style="font-family:'Nunito',sans-serif;font-size:52px;font-weight:800;color:#071C3B;letter-spacing:-0.5px;">nawwat</span>
<span style="display:block;font-size:11px;font-weight:600;letter-spacing:3.5px;text-transform:uppercase;color:#00CFFF;margin-top:6px;">ENTERPRISE ERP</span>
```

### قواعد اللوجو (لا تُكسر)
- النقاط الثلاثة دايماً `#00CFFF` — لا تتغير
- Font = Nunito **800** دايماً (مش 700 ومش 900)
- في الحجم 24px وأقل: احذف الـ flow trails، سيب النقاط الأربع فقط
- لا border/outline يُضاف للـ nucleus

---

## 🖥️ UI Components — مواصفات ثابتة

### Sidebar
```
bg:              #071C3B
Glow overlay:    radial-gradient(circle at 20% 15%, rgba(0,207,255,0.05)...)
Group label:     10px, font-weight:700, letter-spacing:0.15em, color:rgba(255,255,255,0.2)
Nav item:        padding:9px 10px, border-radius:12px, color:rgba(255,255,255,0.45)
Nav item hover:  color:rgba(255,255,255,0.8), bg:rgba(255,255,255,0.05)
Nav item ACTIVE: color:white + bg:rgba(255,255,255,0.1) + 3px left bar (#00CFFF)
Badge:           bg:#00CFFF, color:#071C3B, 10px, bold, border-radius:100px
User card:       bg:rgba(255,255,255,0.05), border-radius:12px, padding:10px
Collapsed:       opacity:0 + width:0 للـ labels + tooltips on hover
```

### Topbar
```
height:          64px
bg:              #FFFFFF
border-bottom:   1px solid #E8EDF5
shadow:          0 1px 0 rgba(10,25,47,0.04)
Search focused:  bg:white + box-shadow:0 0 0 2px rgba(0,207,255,0.25) + width expands
Notif dot:       #00CFFF + box-shadow:0 0 0 1.5px white
User avatar:     gradient(135deg, #CCF7FF, #80EEFF), color:#071C3B
```

### Cards
```
bg:              #FFFFFF
border-radius:   18px
shadow:          0 1px 3px rgba(10,25,47,0.06)
hover shadow:    0 8px 28px rgba(10,25,47,0.1) + translateY(-2px)
hover top line:  2px gradient #00CFFF→transparent, opacity 0→1
```

### Dropdowns
```
bg:              white
border-radius:   16px
border:          1px solid #E8EDF5
shadow:          0 20px 60px rgba(10,25,47,0.12)
open animation:  scale(0.96)+y(8px) → scale(1)+y(0), 0.18s ease
transform-origin: top right
```

### Page Transitions
```
Enter:  opacity:0, y:14px → opacity:1, y:0 | 0.35s [0.22,1,0.36,1]
Exit:   opacity:1, y:0 → opacity:0, y:-6px | 0.18s ease
Mode:   AnimatePresence mode="wait"
```

---

## 📁 حالة المشروع — مارس 2026

### ✅ مكتمل

**UI Screens (7 مصممة بالكامل):**
1. Command Center Dashboard — KPIs + Revenue chart + Recent ops
2. POS Terminal — Product grid + Cart + Tabby split + Barcode
3. Inventory Management — Catalog + Stock levels + Low stock alerts
4. Finance & Accounting Hub — Cash flow + General ledger + Chart
5. CRM & Sales Pipeline — Kanban leads + AI prediction + Calendar
6. People & Performance Hub — Gamified leaderboard + 1-Click Payroll
7. Warehouse & Logistics Hub — 3D Digital Twin + Transit map

**HTML Files:**
- `nawwat_os_v4.html` — Full demo 262KB (32+ modules)
- `nawwat_friendly_logo.html` — Logo guidelines & all variants
- `DashboardLayout_preview.html` — Interactive layout HTML

**React Files:**
- `App.tsx` — Full router (Protected + RoleBasedRoute)
- `AuthContext.tsx` — Session persistence (F5 safe)
- `DashboardLayout.tsx` — Sidebar + Topbar + Outlet + Framer Motion
- `HRScreen.tsx` — HR module complete

**Database:**
- `nawwat_schema_v5_1_FINAL.sql` — 44 tables, 65+ indexes, 50+ RLS
- Healthcare Schema v5.2 — Clinic/Hospital/Pharmacy
- `hlc.py` — Hybrid Logical Clock (offline sync)

### ❌ ناقص (بالأولوية)
1. **Supabase Project** ← **أهم خطوة الآن**
2. Edge Functions (`register_new_tenant`)
3. Auth pages (Login/Signup حقيقية)
4. API Integration (React → Supabase)
5. First 5 real modules: POS + Inventory + Invoices + HR + Accounting
6. Recipe Costing (F&B)
7. Loyalty Program (Retail)
8. Ejari Integration (UAE Real Estate)
9. Mobile PWA

---

## 🐛 Schema Known Bugs

| المشكلة | الحل | الأولوية |
|---------|------|---------|
| `avg_cost` يتحدث عند البيع | `WHEN NEW.quantity > 0` في CASE | 🔴 عالية |
| `is_default` متعدد per tenant | Partial Unique Index | ✅ محلولة v5.2 |
| `seed_units` بدون UNIQUE | `UNIQUE(tenant_id, name)` | ✅ محلولة v5.2 |
| Journal sequence race condition | FOR UPDATE SKIP LOCKED | 🟡 متوسطة |
| RLS inventory_movements ناقصة | CHECK warehouse tenant | 🟡 متوسطة |

**SQL Patch — طبّقه قبل أي data حقيقية:**
```sql
-- في دالة update_stock_on_movement:
avg_cost = CASE
  WHEN NEW.quantity > 0 AND (stock_levels.quantity + NEW.quantity) > 0
  THEN ROUND(
    (stock_levels.quantity * stock_levels.avg_cost
     + NEW.quantity * NEW.unit_cost)
    / (stock_levels.quantity + NEW.quantity), 4)
  ELSE stock_levels.avg_cost
END
```

---

## 🗺️ خريطة الطريق

### Phase 1 — شهر 1-3: Foundation ← نحن هنا
- [ ] Supabase project + Schema deploy
- [ ] Edge Functions (auth + onboarding)
- [ ] React connected to Supabase
- [ ] أول 5 modules حقيقيين

### Phase 2 — شهر 3-6: First Market
- F&B (Recipe Costing + Waste + Delivery)
- Retail (Loyalty + Inter-branch)
- Healthcare (Schema v5.2 جاهز)
- **10 pilot clients في دبي — مجاناً**

### Phase 3 — شهر 6-10: Revenue
- Pricing live
- ZATCA Phase 2 حقيقي
- WhatsApp API (n8n)
- PWA Mobile

### Phase 4 — شهر 10-18: Scale
- KSA launch
- Real Estate + Manufacturing
- Partner network
- AI Assistant بالعربي (Claude API)

---

## 💰 Pricing

| الخطة | السعر | المحتوى |
|-------|-------|---------|
| Starter | مجاني | فرع واحد، 3 users، POS+Inventory+Invoices |
| Growth | AED 199/شهر | فرع واحد، 15 user، كل الـ modules |
| Business | AED 149/فرع/شهر | فروع متعددة، unlimited users |
| Enterprise | Custom | Multi-entity، SLA، custom dev |

---

## 🎯 القرار المعلق — مين أول عميل؟

| القطاع | Schema | Feature الأهم | Compliance |
|--------|--------|---------------|------------|
| مطعم F&B | v5.1 | Recipe Costing + POS | ZATCA |
| صيدلية | v5.2 | Prescription + Expiry tracking | MOH + ZATCA |
| Retail فرعين | v5.1 | POS + Loyalty + Transfer | ZATCA |
| عقارات | v5.1 | Ejari + Contracts + Payments | Ejari/RERA |
| عيادة | v5.2 | Appointments + EMR | MOH |

---

## 📋 قواعد العمل

1. **كل محادثة جديدة** — حط هذا الملف في الأول
2. **لا نبني features** قبل ما الـ Backend يكون جاهز
3. **كل قرار كبير** — Claude يوضح options وصاحب المشروع يختار
4. **الكود دايماً** يُبنى فوق الـ Architecture الموجودة
5. **اللغة:** عربي في التواصل، English في الكود
6. **اللوجو:** استخدم SVG المحدد هنا فقط — لا تعديل
7. **الـ Design System:** الألوان والـ fonts ثابتة — لا deviation أبداً
8. **Schema patches** — أي إصلاح يُوثّق هنا مع version number

---

## 🔑 Context آخر محادثة (مارس 2026)

**آخر حاجة اتعملت:**
- ✅ Schema v5.1 — تحليل كامل + 5 مشاكل + تقييم 8.8/10
- ✅ Schema v5.2 Healthcare Edition
- ✅ Logo نهائي (nawwat_friendly_logo.html) — 3 satellites + nucleus
- ✅ DashboardLayout.tsx كامل مع اللوجو الجديد + Framer Motion
- ✅ NAWWAT_CONTEXT.md v3.0 يشمل كل Design System + Logo SVG

**الخطوة الجاية:**
1. تحديد القطاع الأول ← **القرار عند صاحب المشروع**
2. إنشاء Supabase project
3. Deploy Schema المناسب + SQL Patch
4. Edge Function لـ `register_new_tenant`
5. ربط React app
