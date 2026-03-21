import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { pushSallaInventory } from "./adapters/salla.ts";
import { pushNoonInventory } from "./adapters/noon.ts";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  try {
    // 1. Fetch one queued sync job
    const { data: jobs, error: fetchErr } = await supabase
      .from("sync_jobs")
      .select("*, channel_accounts(channel_name, credentials_metadata)")
      .eq("status", "queued")
      .eq("job_type", "inventory_push")
      .order("created_at", { ascending: true })
      .limit(1);

    if (fetchErr) return new Response("Database Error", { status: 500 });
    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ message: "No pending sync jobs." }), { status: 200 });
    }

    const job = jobs[0];

    // 2. Conditional Lock (Claim)
    // Prevent double-dispatch by updating strictly where status remains 'queued'.
    const { data: lockData, error: lockErr } = await supabase
      .from("sync_jobs")
      .update({ 
        status: "running", 
        updated_at: new Date().toISOString(),
        locked_at: new Date().toISOString() 
      })
      .eq("id", job.id)
      .eq("status", "queued")
      .select("id");

    if (lockErr) return new Response("Failed to lock job", { status: 500 });
    
    if (!lockData || lockData.length === 0) {
      console.warn(`Race condition averted: Sync Job ${job.id} already claimed.`);
      return new Response(JSON.stringify({ message: "Job already claimed by another worker.", job_id: job.id }), { status: 200 });
    }

    // 3. Resolve Payload Data
    // The inner trigger stored the `item_id` in `job.payload`. We calculate real-time quantity dynamically.
    const channelName = job.channel_accounts?.channel_name;
    const internalItemId = job.payload?.item_id;

    if (!internalItemId) {
      await failJob(supabase, job.id, "Malformed sync job payload: missing item_id");
      return new Response("Done (Failed)", { status: 200 });
    }

    // A. Resolve canonical_skus.id
    const { data: canonicalData, error: canonicalErr } = await supabase
      .from("canonical_skus")
      .select("id")
      .eq("tenant_id", job.tenant_id)
      .eq("item_id", internalItemId)
      .limit(1)
      .single();

    if (canonicalErr || !canonicalData) {
       await failJob(supabase, job.id, `Cannot push sync: No canonical SKU found for internal item_id ${internalItemId}`);
       return new Response("Done (Failed)", { status: 200 });
    }

    // B. Resolve sku_mappings.channel_item_id
    const { data: mappingData, error: mappingErr } = await supabase
      .from("sku_mappings")
      .select("channel_item_id")
      .eq("tenant_id", job.tenant_id)
      .eq("canonical_sku_id", canonicalData.id)
      .eq("mapping_status", "confirmed")
      .limit(1)
      .single();

    if (mappingErr || !mappingData) {
       await failJob(supabase, job.id, `Cannot push sync: No confirmed mapping found for canonical SKU ${canonicalData.id}`);
       return new Response("Done (Failed)", { status: 200 });
    }

    // C. Lookup mapped external channel variant ID
    const { data: catalogData, error: catalogErr } = await supabase
      .from("channel_catalog_items")
      .select("external_variant_id")
      .eq("tenant_id", job.tenant_id)
      .eq("channel_account_id", job.channel_account_id)
      .eq("id", mappingData.channel_item_id)
      .limit(1)
      .single();

    if (catalogErr || !catalogData?.external_variant_id) {
       await failJob(supabase, job.id, `Cannot push sync: Catalog mapping broken for channel_item_id ${mappingData.channel_item_id}`);
       return new Response("Done (Failed)", { status: 200 });
    }

    // 4. Resolve Dynamic Stock Level from NawwatOS
    // Sum aggregates across warehouses representing the true sellable stock position.
    const { data: stockData, error: stockErr } = await supabase
      .from("stock_levels")
      .select("quantity")
      .eq("tenant_id", job.tenant_id)
      .eq("item_id", internalItemId);

    if (stockErr) {
      await failJob(supabase, job.id, `Cannot push sync: Failed to read stock_levels for item_id ${internalItemId}`);
      return new Response("Done (Failed)", { status: 200 });
    }
    
    // Sum the quantity across all matching warehouse stock lines
    const currentStock = stockData?.reduce((acc: number, row: any) => acc + (Number(row.quantity) || 0), 0) || 0;


    // 5. Dispatch using proper Channel Adapter
    try {
      if (channelName === "salla") {
        const merchantId = job.channel_accounts?.credentials_metadata?.merchant_id;
        // In a real implementation, you would securely fetch the Salla OAuth Token 
        // using the channel_account.credentials_secret_id Vault reference here.
        // For MVP structure, we mock the token retrieval layer.
        const mockAccessToken = "SALLA_OAUTH_TOKEN_PLACEHOLDER"; 

        await pushSallaInventory(mockAccessToken, {
          merchant_id: merchantId,
          external_variant_id: catalogData.external_variant_id,
          quantity: currentStock
        });

      } else if (channelName === "noon") {
        const noonPartnerId = job.channel_accounts?.credentials_metadata?.partner_id;
        const noonApiKey = job.channel_accounts?.credentials_metadata?.api_key || "NOON_API_KEY_PLACEHOLDER";
        
        if (!noonPartnerId) {
            throw new Error(`Missing Noon partner_id in channel_accounts.credentials_metadata`);
        }

        await pushNoonInventory(noonApiKey, {
          partner_id: noonPartnerId,
          partner_sku: catalogData.external_variant_id,
          quantity: currentStock
        });
      } else {
        throw new Error(`Unsupported channel adapter: ${channelName}`);
      }
      
    } catch (pushError: any) {
      // Step 6a: HTTP Request / Dispatch Failed
      await failJob(supabase, job.id, pushError.message);
      return new Response(JSON.stringify({ success: false, reason: "adapter_failed" }), { status: 200 });
    }

    // Step 6b: Success
    await supabase
      .from("sync_jobs")
      .update({ 
        status: "completed", 
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_error: null
      })
      .eq("id", job.id);

    return new Response(JSON.stringify({ success: true, job_id: job.id }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Critical dispatcher failure:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});

// Helper for strict TEXT-bound terminal error updates
async function failJob(supabase: any, jobId: string, message: string) {
  try {
    await supabase
      .from("sync_jobs")
      .update({ 
        status: "failed", 
        last_error: String(message).substring(0, 500),
        updated_at: new Date().toISOString()
      })
      .eq("id", jobId);
  } catch (e) {
    console.error(`Failed to record error state for job ${jobId}:`, e);
  }
}
