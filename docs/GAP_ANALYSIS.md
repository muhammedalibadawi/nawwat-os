# NawwatOS — Gap Analysis & Readiness Report
**Date**: March 2026
**Target**: Gap assessment between `NAWWAT_CONTEXT_v2.md` promises and actual codebase state.

## 1. Module Implementation Status
| Module | UI Built | Backend/DB | Auth | API | Overall |
|--------|----------|------------|------|-----|---------|
| Registration & Login | ✅ | ✅ | ✅ | ✅ | 100% |
| POS | ✅ | ✅ | ✅ | - | 95% |
| Admin Portal | ✅ | ✅ | ✅ | - | 95% |
| PriceIQ Integration | ✅ | ✅ | ✅ | ✅ | 100% |
| Inventory | ✅ | 🔴 | ✅ | - | 35% |
| Accounting | ✅ | 🟡 | ✅ | - | 45% |
| HR / Payroll | ✅ | 🔴 | ✅ | - | 25% |
| CRM | ✅ | 🔴 | ✅ | - | 25% |
| Logistics | ✅ | 🔴 | ✅ | - | 25% |
| Real Estate | ✅ | 🔴 | ✅ | - | 25% |

## 2. Database vs Code Alignment
- **`tenants`, `users`, `branches`**: 🟢 Fully Integrated. Used actively in `useRegister.ts` and `AuthContext.tsx`.
- **`items`, `item_categories`**: 🟢 Highly utilized by `POSScreen.tsx` and the Edge Function.
- **`market_price_snapshots`, `alerts`**: 🟢 Actively written to via Edge Functions based on explicit REST calls.
- **`inventory_transactions`, `invoices`**: 🔴 Schema only. The UI (POS, Inventory) has no actual `supabase.from('invoices').insert()` mutations written.
- **`employees`, `attendance`**: 🔴 Schema only. The `/hr` screen relies entirely on hardcoded arrays (`const mockEmployees = [...]`).
- **`properties`, `leases`**: 🔴 Schema only. No real connectivity.

## 3. Context Promises vs Reality
- **Promise**: "Database schema (multi-tenant) جاهز" -> **Actual state**: ✅ Verified. Highly robust RLS schema.
- **Promise**: "32+ module مبني كـ UI/UX" -> **Actual state**: ✅ Verified. Over 20+ distinct frontend routes exist with excellent visual fidelity.
- **Promise**: "F&B / Retail / Real Estate completion phase" -> **Actual state**: 🔴 UI Only. Backend integration for sector-specific tasks (Recipe Costing, Ejari tracking) is absent.

## 4. Priority Fix List
1. **Inventory Deduction Paths** | Effort: M | Impact: High
   *Gap*: Closing a POS cart doesn't actually deduct stock or write a transactional record. Essential for MVP.
2. **Invoice Generation** | Effort: M | Impact: High
   *Gap*: Must record sales into the `invoices` table to comply with ZATCA preparations.
3. **Dashboard Real-time Analytics** | Effort: M | Impact: Medium
   *Gap*: The Dashboard currently displays static/mock numbers instead of aggregating `invoices` / `users`.
4. **CRM Syncing** | Effort: S | Impact: Low
   *Gap*: Needs a basic hook into the `customers` table to manage loyalties.

## 5. Effort Estimate to Full MVP
**Target**: 1 Real Client 
**Recommended Sector**: Retail / Pharmacy
*Why Retail?* The Auth flow, Point of Sale, and Market Price Intelligence (PriceIQ) are the most technically complete verticals in the codebase. Retail requires far less complex relational logic than F&B (which requires complex internal Recipe/BOM handling).

**Minimum Requirements for Retail Pilot**:
- Wire Inventory Deductions to Cart Checkout: +1 Day
- Wire Invoice generation & DB commit: +1 Day
- Hook up basic receipt printing / ZATCA readiness formats: +1 Day
- Dashboard Aggregations (Revenue, Count): +1 Day

**Total Estimated Effort**: ~4-5 Developer Days to achieve a completely functional Retail Pilot MVP.
