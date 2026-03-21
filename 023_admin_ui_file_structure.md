# 023: Admin UI File Structure

## 1. Route Structure

NawwatOS currently uses React Router (`App.tsx`). We will nest the Commerce Admin UI under a new protected route.

- **Path**: `/commerce/*`
- **Entry Page**: `src/pages/commerce/CommerceDashboard.tsx`
- **Routing Definition** (in `src/App.tsx`):

  ```tsx
  <Route path="/commerce" element={
      <ProtectedRoute requireRoles={['owner', 'branch_manager']}>
          <CommerceDashboard />
      </ProtectedRoute>
  } />
  ```

## 2. Component File Structure

All purely commerce-related UI components will be isolated within a dedicated subfolder to avoid polluting core UI files.

- Directory: `src/components/commerce/`
- **Files**:
  - `CommerceNavigation.tsx` (Tabs for navigating between the 5 operational screens)
  - `WebhookEventsMonitor.tsx` (Contains Pending & Failed grids)
  - `FailedSyncJobsMonitor.tsx` (Outbound sync errors)
  - `SkuMappingQueue.tsx` (Catalog readiness and approval grid)
  - `ChannelConnectionsGrid.tsx` (Connection statuses)
  - `ConfigureSallaModal.tsx` (Config form for metadata)

## 3. Query Hook Structure (Data Layer)

Separation of concerns requires abstracting Supabase calls out of the UI components. We will create custom React hooks (wrapping React Query / SWR or standard `useEffect`) aligned with our operational views.

- Directory: `src/api/commerce/`
- **Files**:
  - `useWebhooks.ts` (Hooks for pending/failed webhooks and the retry RPC)
  - `useSyncJobs.ts` (Hooks for failed/recent sync jobs)
  - `useSkuMappings.ts` (Hooks for mapping readiness and confirmation triggers)
  - `useChannelAccounts.ts` (Hooks for reading/writing configuration metadata)

## 4. SQL View & RPC Dependencies Per Screen

| Screen Component | Reads From (View / Table) | Writes To (RPC / Action) |
| :--- | :--- | :--- |
| **Webhook Events Monitor** | `public.commerce_pending_webhooks_v` `public.commerce_failed_webhooks_v` | N/A |
| **Retry Action Flow** | N/A | RPC `public.retry_inbound_webhook(p_event_id)` |
| **Failed Sync Jobs Monitor** | `public.commerce_failed_sync_jobs_v` | N/A (Manual retry not in MVP) |
| **SKU Mapping Approval Queue** | `public.commerce_mapping_readiness_v` | RPC / direct secure update to `sku_mappings` |
| **Channel Connections Screen** | `public.channel_accounts` | Config form / Metadata update |

## 5. First Implementation Phase (2 Screens Only)

Based on the immediate priority for pipeline observability, the first execution phase will ONLY cover the Ingress and Egress failure monitors.

### Step 1: The Egress Monitor (Failed Sync Jobs)

1. **API Hook**: Create `src/api/commerce/useSyncJobs.ts` exporting `useFailedSyncJobs()` which queries `commerce_failed_sync_jobs_v`.
2. **Component**: Create `src/components/commerce/FailedSyncJobsMonitor.tsx`.
3. **UI Construction**: Render a simple data table (Job ID, Channel, Timestamp, Error Text).

### Step 2: The Ingress Monitor (Webhook Events & Retry)

1. **API Hook**: Create `src/api/commerce/useWebhooks.ts` exporting `useFailedWebhooks()`, `usePendingWebhooks()`, and `useRetryWebhook()`.
2. **Component**: Create `src/components/commerce/WebhookEventsMonitor.tsx`.
3. **UI Construction**:
   - Build two tabs: "Pending/Processing" and "Failed".
   - In the "Failed" table, inject a `Retry` button that executes the `useRetryWebhook()` mutation, invalidating the view cache upon success.
