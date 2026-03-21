# 025: SKU Mapping Approval Phase Plan (Phase 2)

## 1. Goal
Design the Admin UI mechanism for approving imported Channel SKU mappings against the NawwatOS Canonical Catalog. This UI empowers Operations (`owner`, `branch_manager`, `master_admin`) to resolve the edge `commerce_mapping_readiness_v` backlog blocking bidirectional syncs.

## 2. Scope & Constraints
*   **Target Users**: `owner`, `master_admin`, and `branch_manager` limits only.
*   **Scope Inclusions**:
    *   Mapping Readiness Summary (KPI counts of pending vs mapped Skus).
    *   Approval Queue Grid showing unconfirmed mappings.
    *   Explicit Confirm action (Secure RPC).
*   **Scope Exclusions** (MVP limits enforced):
    *   No Bulk automation or mass-select tooling.
    *   No AI suggestion UI.
    *   No inline edits of the canonical SKU itself (pure approval flow).

## 3. Screen Breakdown
We will inject a **third tab** into our existing `CommerceScreen.tsx` router context alongside Webhooks and Sync Jobs:

### Tab 3: "SKU Mappings" (`<CommerceSkuMappings />`)
*   **Top Header**: Contains absolute KPI stats derived from the `commerce_mapping_readiness_v` read model.
*   **Main Body**: Renders `<DataTable>` showing rows fed from the new `commerce_mapping_queue_v` where `mapping_status != 'confirmed'`.

## 4. Component Breakdown
*   **`src/components/CommerceSkuMappings.tsx`**: New container grid.
*   **Re-uses**: `<DataTable>`, `<StatusBadge>`, `<ActionButton>` from `src/components/ui/`.
*   **New Modal (Optional for MVP)**: A direct `<ActionButton>` click with an inline JS `window.confirm` is preferred to maintain speed while strictly mapping to 1 backend action.

## 5. Hook / Query Structure (`src/api/commerceHooks.ts`)
*   **`useMappingReadiness()`**: Queries `public.commerce_mapping_readiness_v` for top-level summary counts.
*   **`useSkuMappingQueue()`**: Queries `public.commerce_mapping_queue_v`. Filters explicitly `.neq('mapping_status', 'confirmed')` to only show the actionable row-level backlog.
*   **`useConfirmSkuMapping()`**: Mutation hook wrapping the secure RPC call to safely transition the mapping state based on `mapping_id`.

## 6. Required SQL Views / RPCs
To isolate the raw table access, we need **two new database structural components** implemented simultaneously:

1.  **Row-Level View (`commerce_mapping_queue_v`)**:
    *   `mapping_id` (UUID - the actionable primary key)
    *   `canonical_sku_id`
    *   `item_id` & `sku`
    *   `channel_account_id` & `channel_name`
    *   `channel_item_id` & `external_variant_id`
    *   `mapping_status`
    *   `confidence_score`
    *   `rejected_reason`
    *   `confirmed_at` & `last_validated_at`

2.  **Confirmation RPC (`confirm_sku_mapping`)**:
```sql
CREATE OR REPLACE FUNCTION public.confirm_sku_mapping(p_mapping_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$ ... $$
```
This protects the write path cleanly instead of deploying loose frontend row mutation policies.

## 7. Implementation Order
1.  **Backend Migration**: Generate and execute `026_sku_mapping_queue_and_rpc.sql` supplying the missing secure confirmation vector and the new row-level `commerce_mapping_queue_v`.
2.  **API Hook**: Implement `useMappingReadiness`, `useSkuMappingQueue`, and `useConfirmSkuMapping` inside `commerceHooks.ts`.
3.  **UI Component**: Build `CommerceSkuMappings.tsx`.
4.  **Integration**: Attach the third tab hook into `CommerceScreen.tsx`.
