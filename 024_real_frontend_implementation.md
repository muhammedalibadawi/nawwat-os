# 024: Real NawwatOS Frontend Implementation

## A. Existing Frontend Structure Mapping

After inspecting the NawwatOS React codebase, here is exactly how the new commerce features will snap into the existing patterns:

* **Router (`src/App.tsx`)**: The UI uses `react-router-dom v6` nested routes wrapped in a custom `<RoleBasedRoute>` block for RBAC.
* **Layout Component**: `<MainLayout>` inside `src/components/layout/MainLayout.tsx` which houses the `Sidebar` and `Topbar`.
* **Auth Elements**: `useAuth()` hook from `src/context/AuthContext.tsx` handles Supabase sessions.
* **Page Structure**: All major views exist as root-level files inside `src/pages/` (eg. `src/pages/InventoryScreen.tsx`). We will NOT build complex nested feature folders inside `/pages`.
* **UI Components to Reuse (`src/components/ui/`)**:
  * `<DataTable>`: Pre-built grid.
  * `<ActionButton>`: For triggers like "Retry".
  * `<StatusBadge>`: Displaying `pending`/`completed`/`failed` tags.
  * `<KpiCard>`: For summary counters if needed.
* **Data Hook Location (`src/api/`)**: Currently empty, but this is the standard location for abstracting Supabase API calls.
* **Supabase Client (`src/lib/supabase.ts`)**: The initialized `@supabase/supabase-js` instance.

---

## B. Implementation File List

For the first rollout batch (Webhook Events + Failed Sync Jobs), we will only create the following **4** files:

1. `src/pages/CommerceScreen.tsx` — The main tabbed dashboard page container.
2. `src/components/CommerceWebhooks.tsx` — The Webhook data grid implementation.
3. `src/components/CommerceSyncJobs.tsx` — The Outbound failures data grid implementation.
4. `src/api/commerceHooks.ts` — The abstracted Supabase querying logic.

---

## C. Screen 1: Webhook Events Monitor

* **Page File**: Lives inside the new `src/pages/CommerceScreen.tsx` rendering `<CommerceWebhooks />`.
* **Child Components**:
  * Uses `src/components/ui/DataTable.tsx` for the array rendering.
  * Uses `src/components/ui/StatusBadge.tsx` for status cell rendering.
  * Uses `src/components/ui/ActionButton.tsx` exclusively on rows displaying `failed`.
* **Query Hook**: `useWebhooks()` exported from `src/api/commerceHooks.ts`. It will utilize standard React `useEffect` and `useState` polling wrapped around the Supabase client.
* **Data Dependencies**:
  * **Reads**: `public.commerce_pending_webhooks_v` & `public.commerce_failed_webhooks_v`.
  * **Writes**: `RPC public.retry_inbound_webhook(p_event_id)` triggered via the ActionButton.

---

## D. Screen 2: Failed Sync Jobs Monitor

* **Page File**: Rendered via `<CommerceSyncJobs />` within the second tab of `CommerceScreen.tsx`.
* **Child Components**:
  * Uses `src/components/ui/DataTable.tsx` to list jobs.
  * Error columns directly output the `last_error` text string.
* **Query Hook**: `useFailedSyncJobs()` exported from `src/api/commerceHooks.ts`.
* **Data Dependencies**:
  * **Reads**: `public.commerce_failed_sync_jobs_v`.

---

## E. Minimal Navigation Integration

We will insert the new route directly into the existing declarative structure without inventing new wrappers.

**1. `src/App.tsx` Modification**

Add a new lazy-loaded block alongside existing screens:

```tsx
const CommerceScreen = React.lazy(() => import('./pages/CommerceScreen'));
```

And insert the new `<Route>` block restricted to owners and branch managers:

```tsx
<Route path="commerce" element={<RoleBasedRoute allowedRoles={['owner', 'branch_manager']}><CommerceScreen /></RoleBasedRoute>} />
```

**2. `src/components/layout/Sidebar.tsx` Modification**

Add a navigation entry rendering an icon link pointing to `/commerce`. The link should ideally only render conditionally based on `user?.role`.
