# 017: Salla Ingress MVP - Operational Test Checklist

This document strictly defines the end-to-end operational test constraints required to verify the Salla webhook ingress pipeline prior to production deployment.

## Prerequisites

Before executing these tests, ensure the following state is met:
1. The NawwatOS local stack (Supabase) is running.
2. All Commerce migrations (`010` through `016`) have been sequentially applied.
3. Both `salla-webhook` and `salla-worker` Edge Functions are being served locally (`npx supabase functions serve`).
4. A mock `tenant` and `owner` user exists.
5. A mock `channel_account` (Salla) exists with valid `credentials_metadata->>'merchant_id'`.
6. A test SKU is populated in `items`, with a linked `canonical_skus` and `channel_catalog_items` row.
7. A `sku_mappings` row joins them with `mapping_status = 'confirmed'`.
8. An active `general` warehouse exists for the tenant.

---

## Test Cases

### 1. Database Migration Verification
**Test:** Verify that the required schemas and functions physically exist and enforce RLS safely.
*   **SQL Verification:**
    ```sql
    SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('channel_accounts', 'inbound_webhook_events', 'sync_jobs');
    SELECT policyname, tablename, permissive, roles, cmd FROM pg_policies WHERE tablename IN ('channel_accounts', 'canonical_skus', 'channel_catalog_items', 'sku_mappings', 'inbound_webhook_events', 'sync_jobs');
    SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('enqueue_inventory_push_internal', 'log_inbound_webhook', 'retry_inbound_webhook');
    ```
*   **Expected Outcome:** All tables exist with `rowsecurity = true`. RLS policies explicitly exist bridging to the `tenant_id` context. Functions exist, and `prosecdef = true` for the designated `SECURITY DEFINER` helpers.
*   **Failure Note:** If tables, policies are missing, or `prosecdef` is false, the migration application failed or was overridden. Halt all other tests.

---

### 2. Happy-Path Webhook Test
**Test:** Submit a valid, signed `order.created` webhook matching the mapped item.
*   **Action:** Send `POST /functions/v1/salla-webhook` with valid `x-salla-signature`.
*   **Worker Action:** Run `POST /functions/v1/salla-worker`.
*   **SQL Verification:**
    ```sql
    SELECT status, payload FROM public.inbound_webhook_events WHERE event_type = 'order.created';
    ```
*   **Expected Outcome:** Webhook returns HTTP 200. Event row `status` evolves to `completed`.
*   **Failure Note:** If HTTP 401, signature logic failed. If HTTP 404, merchant ID resolution logic failed.

---

### 3. Worker Claim Race Test
**Test:** Assert that the conditional locking logic (`status IN ('pending', 'retrying')`) is honored by submitting concurrent worker requests.
*   **Prerequisite:** Ensure at least one `pending` event exists in `inbound_webhook_events`.
*   **Action:** Execute `POST /functions/v1/salla-worker` exactly twice, simultaneously.
*   **Expected Outcome:** Only one worker request completes a full mapping extraction. The second request returns a `200 OK` stating `"Event already claimed by another worker."`
*   **Failure Note:** If both workers process the payload, the strict `UPDATE ... in ('pending', 'retrying')` locking logic failed.

---

### 4. Duplicate Webhook Test
**Test:** Re-hydrate the exact same payload from Test 2 (identical Salla event ID) and submit it again.
*   **Action:** Send `POST /functions/v1/salla-webhook` identically.
*   **SQL Verification:**
    ```sql
    SELECT COUNT(*) FROM public.inbound_webhook_events WHERE event_type = 'order.created';
    SELECT COUNT(*) FROM public.inventory_movements WHERE reference_type = 'salla_order';
    SELECT COUNT(*) FROM public.sync_jobs WHERE job_type = 'inventory_push';
    ```
*   **Expected Outcome:** HTTP 200 returned instantly. Counts do NOT increase. Exactly one inbound event row, one movement bundle, and one sync intent layer exists.
*   **Failure Note:** If counts increase, the `ON CONFLICT` idempotency constraint failed or the `idempotency_key` formula mutated.

---

### 5. Invalid Signature Test
**Test:** Send a valid payload but alter or omit the `x-salla-signature` header.
*   **Action:** Send `POST /functions/v1/salla-webhook` with `x-salla-signature: invalid_hash`.
*   **SQL Verification:** No new events should appear.
*   **Expected Outcome:** HTTP 401 Unauthorized.
*   **Failure Note:** If HTTP 200 is returned, the edge function signature enforcement is broken, risking payload injection.

---

### 6. Unknown Channel/Merchant Test
**Test:** Send a perfectly signed payload, but change the `merchant.id` inside it to an unregistered ID.
*   **Action:** Send `POST /functions/v1/salla-webhook`.
*   **Expected Outcome:** HTTP 404 Not Found. No DB event logged.
*   **Failure Note:** If HTTP 200 is returned, tenant isolation is failing to stop undocumented ingress.

---

### 7. Unmapped SKU Test
**Test:** Send a valid webhook containing a Salla `sku` that exists in `channel_catalog_items` but is mapped as `'suggested'` (not `'confirmed'`).
*   **Action:** Run webhook receiver, then run worker.
*   **SQL Verification:**
    ```sql
    SELECT status FROM public.inbound_webhook_events ORDER BY created_at DESC LIMIT 1;
    ```
*   **Expected Outcome:** Event `status` becomes `failed`. No inventory is deducted.
*   **Failure Note:** If status becomes `completed`, the `mapping_status = 'confirmed'` requirement in `mapper.ts` is failing. 

---

### 8. Retry Flow Test
**Test:** Trigger an explicit retry on the failed event from Test 7, simulating an Admin action after fixing the mapping.
*   **Prerequisite:** Update the `sku_mappings` row to `mapping_status = 'confirmed'`.
*   **Action:** As an `owner`, call `SELECT public.retry_inbound_webhook('<event_uuid>');`
*   **SQL Verification:**
    ```sql
    SELECT status, error_message, processed_at FROM public.inbound_webhook_events WHERE id = '<event_uuid>';
    ```
*   **Worker Action:** Run `POST /functions/v1/salla-worker`.
*   **Expected Outcome:** On RPC call: returns `true`. Status becomes `retrying`, error & processed_at become `NULL`. After worker run, status becomes `completed`.
*   **Failure Note:** If RPC returns `false`, role permissions or RLS paths threw a silent deny. 

---

### 9. Stock Deduction Correctness Test
**Test:** Verify that the translated movement accurately represents a negative sale deduction.
*   **SQL Verification:**
    ```sql
    SELECT movement_type, quantity, reference_type FROM public.inventory_movements ORDER BY created_at DESC LIMIT 1;
    ```
*   **Expected Outcome:** `movement_type` is `'sale'`. `quantity` is strictly negative (e.g., `-2`). `reference_type` is `'salla_order'`.
*   **Failure Note:** If quantity is positive, internal NawwatOS aggregate sums will mistakenly increase physical stock instead of reducing it upon Salla sales.

---

### 10. Sync Intent Generation Test
**Test:** Verify the `trg_commerce_inventory_push` automatically generated an outbound command based on Test 9's insert.
*   **SQL Verification:**
    ```sql
    SELECT job_type, status, payload FROM public.sync_jobs ORDER BY created_at DESC LIMIT 1;
    ```
*   **Expected Outcome:** Row exists. `job_type` is `'inventory_push'`. `status` is `'queued'`. The payload contains the correct NawwatOS `item_id`.
*   **Failure Note:** If table is empty, `013_commerce_triggers.sql` is not firing on `inventory_movements`. If trigger fired but row is missing, the idempotency 5-minute suppression window might be catching it too aggressively.

---

### 11. Failure Recording
**Test:** Verify that when the worker encounters a crash (e.g., the warehouse lookup fails because no `general` warehouse is `is_active = true`), it surfaces the actual crash reason.
*   **Prerequisite:** Set `is_active = false` for the tenant's general warehouse. Send a valid order.
*   **Worker Action:** Run `POST /functions/v1/salla-worker`.
*   **SQL Verification:**
    ```sql
    SELECT status, error_message FROM public.inbound_webhook_events ORDER BY created_at DESC LIMIT 1;
    ```
*   **Expected Outcome:** `status` = `'failed'`. `error_message` explicitly contains: `"Cannot resolve a destination warehouse for tenant."`
*   **Failure Note:** If `error_message` is null or generic, then granular try/catch blocks in the `salla-worker` transaction logic are swallowing the real reason, which hurts observability.
