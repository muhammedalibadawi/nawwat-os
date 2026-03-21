# 027: Channel Connections Phase Plan (Phase 3)

## 1. Goal
Design the Admin UI mechanism for managing external commerce integrations (e.g., Salla). This screen provides Operations (`owner`, `branch_manager`, `master_admin`) with visibility into active channels, their connection health, and acts as the entry point for configuring safely-stored `credentials_metadata`.

## 2. Scope & Constraints
*   **Target Users**: `owner`, `branch_manager`, and `master_admin` limits only.
*   **Scope Inclusions**:
    *   Channel Connections list/grid.
    *   Health status and last sync visibility.
    *   Configuration UI (Modal/Drawer) to manage non-sensitive parameters (e.g., `merchant_id`, shop URL) via `credentials_metadata`.
*   **Scope Exclusions** (MVP limits enforced):
    *   **NO RAW SECRET UI**: We will not send raw API tokens or access secrets from the frontend directly into table inserts. Secret ingestion is typically handled by server-side OAuth callbacks or a dedicated secure vault RPC. For MVP frontend, we only edit metadata and view status.
    *   No complex generic connector builder. Tailor the UX primarily around the concrete implemented channel: `salla`.

## 3. Screen Breakdown
We will inject a **fourth tab** into our existing `CommerceScreen.tsx` router context:

### Tab 4: "Channels" (`<CommerceChannels />`)
*   **Header**: Title and "Add Channel" action (if authorized).
*   **Main Body**: Renders `<DataTable>` showing existing `channel_accounts` items.
    *   Columns: `channel_name`, `connection_status`, `health_status`, `last_synced_at`, `actions`.
*   **Actions**: "Configure" / "View Details" to open the configuration modal.

## 4. Component Breakdown
*   **`src/components/CommerceChannels.tsx`**: New container grid.
*   **`src/components/ConfigureSallaModal.tsx`**: A dedicated modal to interact with the non-sensitive parameters of the Salla integration (reading/writing `credentials_metadata`).
*   **Re-uses**: `<DataTable>`, `<StatusBadge>`, `<ActionButton>` from `src/components/ui/`.

## 5. Hook / Query Structure (`src/api/commerceHooks.ts`)
*   **`useChannelAccounts()`**:
    *   Queries `public.channel_accounts`.
    *   Filters: `deleted_at IS NULL`.
*   **`useUpdateChannelMetadata()`**:
    *   Mutation hook to update `credentials_metadata` for a specific account. This performs an explicit patch update to `channel_accounts` ensuring no other fields are disturbed.

## 6. Implementation Order
1.  **API Hook**: Implement `useChannelAccounts` and `useUpdateChannelMetadata` inside `commerceHooks.ts`.
2.  **UI Component (Grid)**: Build `CommerceChannels.tsx` to display the list of active/disconnected channels.
3.  **UI Component (Config)**: Build `ConfigureSallaModal.tsx` to handle safe metadata adjustments.
4.  **Integration**: Attach the fourth tab hook into `CommerceScreen.tsx`.
