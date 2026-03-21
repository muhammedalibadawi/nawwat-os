# NawwatOS — نظام نواه للإدارة
> Enterprise ERP SaaS — Arabic-first — UAE + KSA

## 🌟 نظرة عامة (Overview)
NawwatOS is a comprehensive, multi-tenant cloud ERP system designed specifically for the UAE and KSA markets. It features an Arabic-first interface with full RTL support, a rigorous role-based access control system, and a modular architecture covering everything from Point of Sale to HR and Accounting.

## 🛠️ Tech Stack
| Layer | Tool | Version | Purpose |
|-------|------|---------|---------|
| Frontend | React + TypeScript | 18.x | Modular UI, isolated feature components |
| Backend | Supabase | 2.x | PostgreSQL DB, Auth, RLS, Storage |
| Routing | React Router | 6.x | Client-side navigation & Route Gating |
| Styling | Tailwind CSS | 3.x | Rapid dark-theme UI deployment |
| Edge | Deno (Supabase Functions)| 1.x | External integrations (PriceIQ) |

## 📁 Project Structure
- `/frontend/src/pages/` - Core UI screens and module layouts (30+ screens)
- `/frontend/src/components/` - Reusable UI widgets and layout shells
- `/frontend/src/context/` - Global state (Auth, App roles)
- `/frontend/src/hooks/` - Custom React hooks for API & Auth interaction
- `/supabase/migrations/` - PostgreSQL Schema and RLS policies
- `/supabase/functions/` - Serverless Edge Functions

## 🗄️ Database Schema
The database strictly utilizes `tenant_id` for hardware-level RLS Row Isolation.
- **Tenants & Auth**: `tenants`, `users`, `branches`, `subscriptions`
- **Inventory & Items**: `items`, `item_categories`, `inventory_transactions`
- **Accounting**: `journal_entries`, `chart_of_accounts`, `invoices`
- **Market Intelligence**: `market_price_snapshots`, `market_price_alerts`

[View Full Schema](supabase/migrations/nawwat_schema_v4_1_COMPLETE.sql) (or equivalent migration file).

## 🚀 Getting Started
### Prerequisites
- Node.js 18+
- Supabase CLI (`npm i -g supabase`)

### Environment Variables
Copy `.env.example` to `.env` in the frontend directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```
For Edge Functions (`supabase/functions/.env`):
```env
PRICEIQ_URL=http://priceiq:8000
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### Running locally
1. `cd frontend`
2. `npm install`
3. `npm run dev`

## 📱 Screens & Modules
| Screen | Route | Status | Auth Required | Notes |
|--------|-------|--------|---------------|-------|
| Login/Onboarding | `/register` | ✅ Complete | No | Multi-step Tenant provisioning |
| POS | `/pos` | ✅ Complete | Yes (Cashier) | Connected to Supabase items |
| Master Admin | `/admin-portal` | ✅ Complete | Yes (Master Admin) | Tenant oversight |
| PriceIQ Widget | Embedded | ✅ Complete | Yes | Microservice HTTP integration |
| Dashboard | `/dashboard` | 🟡 UI Only | Yes | Needs real analytics hookup |
| Inventory | `/inventory` | 🟡 UI Only | Yes | Missing real-time deduction logic |
| Accounting | `/accounting` | 🟡 UI Only | Yes | Schema exists, writes do not |
| HR | `/hr` | 🟡 UI Only | Yes | - |
| Logistics | `/logistics` | 🟡 UI Only | Yes | - |

## 🔐 Authentication & Authorization
Uses `@supabase/supabase-js` Auth. A custom `AuthContext` parses JWT `app_metadata` to extract `user_role` and `tenant_id`.
- **RLS Pattern**: `tenant_id = (SELECT tenant_id FROM users WHERE auth_id = auth.uid())`
- Access controls are enforced at both the React Router (`<RoleBasedRoute>`) and PostgreSQL levels.

## 🌐 API / Edge Functions
| Function | Endpoint | Purpose | Status |
|----------|----------|---------|--------|
| `priceiq-query` | `/functions/v1/priceiq-query` | Fetches competitor intelligence & compares prices | ✅ Active |

## 💰 Pricing Plans
| Plan | Price | Features |
|------|-------|----------|
| Starter | Free | 1 Branch, 3 Users, Basic POS + Inventory |
| Growth | 199 AED/mo | 1 Branch, 15 Users, All Modules |
| Business | 149 AED/branch/mo | Unlimited Branches & Users |

## 🤝 Contributing
- **Rule 1**: New screens must be added as Lazy-Loaded routes in `App.tsx`.
- **Rule 2**: Support strict `dir="rtl"` in all Tailwind roots.
- **Rule 3**: Do NOT expand mock data arrays. Inject real `supabase.from()` calls moving forward. 

## 📄 License
Proprietary / Closed Source.
