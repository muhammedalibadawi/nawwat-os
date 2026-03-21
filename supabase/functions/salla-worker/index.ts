import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { processSallaOrder } from "./mapper.ts";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  try {
    // 1. Fetch one pending Salla webhook event
    const { data: events, error: fetchErr } = await supabase
      .from("inbound_webhook_events")
      .select("*")
      .in("status", ["pending", "retrying"])
      .eq("event_type", "order.created")
      .order("created_at", { ascending: true })
      .limit(1);

    if (fetchErr) return new Response("Database Error", { status: 500 });
    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ message: "No pending jobs." }), { status: 200 });
    }

    const event = events[0];

    // 2. Optimistically lock the event by marking it 'processing'
    // To prevent race conditions, only update if the status is STILL pending/retrying
    const { data: lockData, error: lockErr } = await supabase
      .from("inbound_webhook_events")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", event.id)
      .in("status", ["pending", "retrying"])
      .select("id");

    if (lockErr) return new Response("Failed to lock event", { status: 500 });
    
    // If no row was returned, another worker instance already claimed it
    if (!lockData || lockData.length === 0) {
      console.warn(`Race condition averted: Event ${event.id} already claimed.`);
      return new Response(JSON.stringify({ message: "Event already claimed by another worker.", event_id: event.id }), { 
        headers: { "Content-Type": "application/json" },
        status: 200 
      });
    }

    // 3. Process the entire payload + Mapping Lookups / Auto-SKU Generation
    let pResult;
    try {
      pResult = await processSallaOrder(supabase, event);
    } catch (mappingError: any) {
      // Separate DB Operation: Mapping failed, set event to 'failed' and abort.
      await supabase
        .from("inbound_webhook_events")
        .update({ 
          status: "failed", 
          error_message: mappingError.message,
          updated_at: new Date().toISOString()
        })
        .eq("id", event.id);
      return new Response(JSON.stringify({ success: false, reason: "mapping_failed" }), { status: 200 });
    }

    const { inventoryMovements, invoiceLineItems, orderTotal, orderReferenceId } = pResult;

    // 4. Executing the Transaction (All-or-Nothing Array Insert)
    // The Supabase `.insert(array)` over Postgres-PostgREST operates completely inside a single transaction by default.
    // If any single item row fails constraints, the entire statement rolls back natively at the DB level.
    const { error: insertErr } = await supabase
      .from("inventory_movements")
      .insert(inventoryMovements);

    if (insertErr) {
      // Separate DB Operation: The implicit Postgres transaction rolled back natively.
      // Now we explicitly update the webhook status to 'failed'.
      await supabase
        .from("inbound_webhook_events")
        .update({ 
          status: "failed", 
          error_message: insertErr.message || "Failed during inventory movement insertion.",
          updated_at: new Date().toISOString()
        })
        .eq("id", event.id);
      return new Response(JSON.stringify({ success: false, reason: "insert_failed" }), { status: 200 });
    }

    // 5. Order-to-Invoice Translation (Phase 5)
    // Write the formal sales invoice to the ledger
    const invoiceMetadata = {
      salla_order_id: orderReferenceId,
      salla_event_id: event.id,
      channel_account_id: event.channel_account_id,
      source: 'salla_integration'
    };

    const { data: newInvoice, error: invErr } = await supabase
      .from("invoices")
      .insert({
        tenant_id: event.tenant_id,
        type: 'sales',
        total_amount: orderTotal,
        status: 'paid', // Assuming Salla orders ingested here are paid prior tracking 
        due_date: new Date().toISOString(),
        metadata: invoiceMetadata
      })
      .select('id')
      .single();

    if (invErr) {
      console.warn("Invoice generation failed:", invErr.message);
    } else if (newInvoice) {
      // Map the invoice ID onto the line items
      const linesWithInvoiceId = invoiceLineItems.map(line => ({
        ...line,
        invoice_id: newInvoice.id
      }));

      const { error: linesErr } = await supabase
        .from("invoice_line_items")
        .insert(linesWithInvoiceId);

      if (linesErr) console.warn("Invoice lines generation failed:", linesErr.message);
    }

    // 6. Success
    // Separate DB Operation: Mark the event completed.
    await supabase
      .from("inbound_webhook_events")
      .update({ 
        status: "completed", 
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null
      })
      .eq("id", event.id);

    return new Response(JSON.stringify({ success: true, event_id: event.id }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Critical worker failure:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});
