# 019: Broadcast Sync Correction Plan

## The Mismatch Overview
Currently, the database trigger `trg_inventory_movement_enqueue_sync` (in `013_commerce_triggers.sql`) calls the internal enqueue helper using `p_channel_account_id = NULL` to broadcast an inventory update across all channels.
This results in a single `sync_jobs` row with `channel_account_id = NULL`. However, the dispatcher Edge Function needs a deterministic destination channel to execute specific HTTP logic against either Salla or Noon. It cannot safely infer routing rules from a `NULL` target.

## Strategic Options

### Option A: Dispatcher-Level Fan-Out (Not Recommended)
The dispatcher pulls the `NULL` broadcast job, queries `sku_mappings` for all connected channels, and makes parallel HTTP requests to all adapters.
*   **Drawbacks:**
    *   **Poor Error Isolation:** If Salla succeeds but Noon fails, the single `sync_jobs` row cannot represent both `completed` and `failed` simultaneously.
    *   **Complex Lifecycle:** Retrying means re-pushing to successful channels unless we introduce tracking per-target inside a JSONB status field.
    *   **Violates Simplicity:** Forces the Edge Function to handle heavy cursor management.

### Option B: Enqueue-Level Fan-Out (Recommended for MVP)
Modify the backend SQL logic (`enqueue_inventory_push_internal` / `trg_inventory_movement_enqueue_sync`) so that it generates **one discrete `sync_jobs` row for every valid `channel_account_id`** mapped to that SKU.
*   **Why it's MVP-Safe:**
    *   **Absolute Isolation:** Each channel gets a unique row. A Salla failure acts independently of a Noon success.
    *   **Simple Dispatcher:** The asynchronous Edge worker remains completely unchanged. It pulls one job, sees exactly one `channel_account_id`, and executes it.
    *   **Trivial Retries:** Retries (`status = failed` -> `status = retrying`) act neatly on individual failed targets without causing double-dispatches on healthy targets.

---

## The Correction Implementation (Executing Option B)

To fix this asynchronously before touching frontend development:

**1. Revise `013_commerce_triggers.sql` (Line 101)**
Instead of passing `NULL`, change `trg_inventory_movement_enqueue_sync` to explicitly loop over the mapped channels for the new item. We will update `enqueue_inventory_push_internal` to handle the fan-out over active connected `channel_accounts`.

**2. Modify `013_commerce_triggers.sql` Enqueue Helper (Line 17)**
Adjust `enqueue_inventory_push_internal` to explicitly look up all `sku_mappings` belonging to the triggering `item_id`. It will loop and call `public.create_sync_job` once per valid `channel_account_id`.

**3. Dispatcher `started_at` Fix (Completed)**
The dispatcher was updated to lock using the existing schema column `locked_at = now()` (equivalent to the requested `started_at`) upon claiming the job. This satisfies the operational lock timestamp requested.
