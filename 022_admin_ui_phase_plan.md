# 022: Admin UI Phase Plan for Commerce Pipeline

## 1. Overview
This operational Admin UI provides back-office visibility and control over the new multi-tenant Commerce Integration layer. The UI strictly skips storefront/analytics bloat in favor of a utilitarian, data-dense interface tailored for `owner` and `branch_manager` roles. 

By leveraging the previously established `WITH (security_invoker = true)` SQL read model views, the frontend simply executes standard read procedures bound safely to the tenant's context without any schema mutation risk.

---

## 2. Screen-by-Screen Breakdown

### A. Channel Connections Screen
*   **Purpose**: Manage external integrations (Salla) and monitor connection health.
*   **Components**: 
    *   `ChannelConnectionsGrid`: Data Table listing active channels and health status.
    *   `ConfigureSallaModal`: **MVP Constraint**: Treats channel configuration only as a metadata/config UI flow modifying `credentials_metadata`. Raw API tokens/secrets are never passed directly to backend rows via frontend UI; their storage logic is handled exclusively on the service-side.
*   **Data Dependencies**: 
    *   **Read**: `public.channel_accounts`

### B. Webhook Events Monitor (Ingress)
*   **Purpose**: Real-time and historical triage of inbound Salla payload executions.
*   **Components**:
    *   Two Tabs: `PendingWebhooksTab` & `FailedWebhooksTab`.
    *   `WebhookDataGrid`: Rendering row age, payload type, and detailed error messages.
*   **Data Dependencies**:
    *   **Read**: `public.commerce_pending_webhooks_v`, `public.commerce_failed_webhooks_v`
    *   **Sorting**: UI will apply an external `orderBy(created_at, asc)` for pending queues, and `desc` for failed audits.

### C. Retry Action Flow (Ingress/Outbound)
*   **Purpose**: The central interaction enabling admins to manually push isolated pipeline failures back into the retry loop.
*   **Components**:
    *   `RetryWebhookAction`: Row Action icon block on the Failed Webhooks Data Grid.
*   **Data Dependencies**:
    *   **Write**: Executes `RPC public.retry_inbound_webhook(p_event_id)`.
    *   **Side-effect**: The React Query / table cache invalidates. The item drops from the "Failed" view and reappears in the "Pending" view seamlessly.

### D. Failed Sync Jobs Monitor (Outbound)
*    **Purpose**: Visibility into terminal external push failures (e.g. rate limits hit, invalid Salla tokens, or removed external SKUs) avoiding silent desynced inventory.
*   **Components**:
    *   `OutboundFailedGrid`: Table rendering Job ID, Target Channel, Started Timestamp, and `last_error` text string.
*   **Data Dependencies**:
    *   **Read**: `public.commerce_failed_sync_jobs_v`

### E. SKU Mapping Approval Queue
*   **Purpose**: Unblock commerce synchronization by giving admins an interface to inspect and manually confirm AI-suggested or raw variant mappings.
*   **Components**:
    *   `MappingReadinessSummary`: Lightweight numeric summary-card block (Total Suggested vs Confirmed).
    *   `ApprovalQueueGrid`: Actionable Data Grid rendering `canonical_skus` alongside their mapped statuses.
    *   `ConfirmMappingAction`: Clickable row action.
*   **Data Dependencies**:
    *   **Read**: `public.commerce_mapping_readiness_v`
    *   **Write Action**: Uses a highly explicit path—either a future `RPC public.confirm_sku_mapping(...)` or a precise `.update()` relying strictly on confirmed current RLS safety, eliminating uncontrolled bulk row overwrites.

---

## 3. Recommended Implementation Order

To immediately deliver maximum operational value against the backend already deployed, we prioritize pipeline observability before config screens:

1. **Webhook Events Monitor (Screens B)**: Start by making the inbound failure queues highly visible.
2. **Retry Action Flow (Screen C)**: Hook the RPC up immediately into the failed queue so errors can be safely recycled.
3. **Failed Sync Jobs Monitor (Screen D)**: Deliver outbound visibility to catch broken sync attempts escaping the dispatch edge worker.
4. **SKU Mapping Approval Queue (Screen E)**: Build the catalog mapping unlock flow.
5. **Channel Connections Screen (Screen A)**: Treat configuration and secrets storage as the final UI requirement.
