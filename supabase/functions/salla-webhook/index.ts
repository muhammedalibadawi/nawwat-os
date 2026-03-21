import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { verifySallaSignature } from "./validator.ts";

const SALLA_WEBHOOK_SECRET = Deno.env.get("SALLA_WEBHOOK_SECRET") || "";

serve(async (req) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // 1. Extract signature and body
    const signature = req.headers.get("x-salla-signature");
    if (!signature) {
      console.warn("Incoming Salla webhook missing signature header.");
      return new Response("Unauthorized: Missing signature", { status: 401 });
    }

    const rawBody = await req.text();

    // 2. Validate HMAC-SHA256 Signature
    if (!(await verifySallaSignature(rawBody, SALLA_WEBHOOK_SECRET, signature))) {
      console.error("Salla webhook signature validation failed.");
      return new Response("Unauthorized: Invalid signature", { status: 401 });
    }

    // Parse the payload safely now that authenticity is proven
    const payload = JSON.parse(rawBody);
    const eventType = payload.event;
    // Handle both payload shapes: merchant might be an object { id: 123... } or a raw ID string/number
    // Cast to String to ensure strict type matching against DB JSONB metadata.
    const merchantId = String(payload.merchant?.id ?? payload.merchant);
    const sourceEventId = payload.data?.id ? String(payload.data.id) : null;

    if (!merchantId || !eventType) {
      console.error("Malformed Salla payload: missing merchant or event type.");
      return new Response("Bad Request: Malformed payload", { status: 400 });
    }

    // Generate deterministic idempotency key to prevent dupes in Postgres
    // Format: salla:{event_type}:{source_event_id_or_timestamp}
    // TODO: Date.now() is a temporary fallback for MVP. Replace with a deterministic payload hash
    // in the future if `data.id` is fundamentally unavailable for certain webhook types.
    const idempotencyKey = `salla:${eventType}:${sourceEventId || Date.now()}`;

    // 3. Initialize Supabase Service Role Client
    // Webhooks are backend processes, so we use the SERVICE_ROLE key.
    // Tenant context will be passed explicitly to the RPC.
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // 4. Resolve Channel Account and Tenant
    // Find the NawwatOS tenant connected to this Salla merchant
    const { data: accounts, error: accountError } = await supabase
      .from("channel_accounts")
      .select("id, tenant_id")
      .eq("channel_name", "salla")
      .contains("credentials_metadata", { merchant_id: merchantId })
      .limit(1);

    if (accountError || !accounts || accounts.length === 0) {
      console.error(`Lookup failed: No active channel account found for Salla merchant_id: ${merchantId}`);
      return new Response("Channel account not found", { status: 404 });
    }

    const account = accounts[0];

    // 5. Safely log the webhook
    // This calls the SECURITY DEFINER function we generated in Migration 012.
    // Duplicate payloads with the same idempotencyKey will effectively be merged (ON CONFLICT).
    const { data: webhookId, error: logError } = await supabase.rpc("log_inbound_webhook", {
      p_channel_account_id: account.id,
      p_event_type: eventType,
      p_payload: payload,
      p_idempotency_key: idempotencyKey,
      p_source_event_id: sourceEventId,
      p_tenant_id: account.tenant_id,
    });

    if (logError) {
      console.error("Database error while logging inbound webhook:", logError);
      return new Response("Internal Server Error", { status: 500 });
    }

    // 6. Return HTTP 200 immediately
    return new Response(JSON.stringify({ success: true, logged_id: webhookId }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Unexpected error processing Salla webhook:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});
