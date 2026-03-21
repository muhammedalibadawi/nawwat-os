// @ts-ignore
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Normalizes the Salla payload, implements Auto-SKU for unmapped products,
 * and constructs the inventory movements + invoice line items.
 * 
 * @param supabase The authenticated Supabase Service Role client
 * @param event The full `inbound_webhook_events` row
 * @returns Object with inventory movements, invoice lines, and total order amount
 */
export async function processSallaOrder(supabase: SupabaseClient, event: any) {
  const tenantId = event.tenant_id;
  const payload = event.payload;

  // 1. Resolve Warehouse
  const { data: warehouseData, error: warehouseErr } = await supabase
    .from("warehouses")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("type", "general")
    .eq("is_active", true)
    .limit(1);

  if (warehouseErr || !warehouseData || warehouseData.length === 0) {
    throw new Error("Cannot resolve a destination warehouse for tenant.");
  }
  const warehouseId = warehouseData[0].id;

  // 2. Extract Salla Line Items
  const items = payload.data?.items || [];
  if (items.length === 0) {
    throw new Error("Salla order contains no items.");
  }

  const orderReferenceId = payload.data?.reference_id || String(payload.data?.id);
  const orderTotal = parseFloat(payload.data?.amounts?.total?.amount || 0);

  // 3. Process mapping and construct the payloads
  const inventoryMovementsToInsert = [];
  const invoiceLineItemsToInsert = [];

  for (const item of items) {
    const externalVariantId = String(item.options?.length > 0 ? item.options[0].id : item.sku || item.id);
    const quantity = parseInt(item.quantity || 1, 10);
    const price = parseFloat(item.amounts?.total?.amount || item.price?.amount || 0) / quantity; // Approximate unit price
    const itemName = String(item.name || "Unknown Salla Product");

    // Look up or Auto-Create the channel_catalog_items
    let catalogItemId = null;
    const { data: catalogItem, error: catalogErr } = await supabase
      .from('channel_catalog_items')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('channel_account_id', event.channel_account_id)
      .eq('external_variant_id', externalVariantId)
      .limit(1)
      .single();

    if (catalogErr || !catalogItem) {
      // Auto-SKU: Create a ghost catalog item 
      const { data: newCatalogItem, error: newCatErr } = await supabase
        .from('channel_catalog_items')
        .insert({
          tenant_id: tenantId,
          channel_account_id: event.channel_account_id,
          external_variant_id: externalVariantId,
          name: itemName,
          sku: item.sku || externalVariantId,
          price: price,
          metadata: item
        })
        .select('id')
        .single();
        
      if (newCatErr) throw new Error(`Auto-SKU failed to inject catalog item: ${newCatErr.message}`);
      catalogItemId = newCatalogItem.id;
    } else {
      catalogItemId = catalogItem.id;
    }

    // Look up the canonical sku mapping
    let internalItemId = null;
    const { data: mappingData, error: mappingErr } = await supabase
      .from("sku_mappings")
      .select("canonical_skus(item_id)")
      .eq("tenant_id", tenantId)
      .eq("channel_item_id", catalogItemId)
      .eq("mapping_status", "confirmed")
      .limit(1)
      .single();

    const typedMapping = mappingData as any;
    
    if (mappingErr || !typedMapping?.canonical_skus?.item_id) {
      // Auto-SKU: Intercept Mapping Failure. Create actual NwawatOS item!
      const { data: newItem, error: itemErr } = await supabase
        .from("items")
        .insert({
          tenant_id: tenantId,
          name: `${itemName} (Auto-imported)`,
          sku: item.sku || `AUTO-${externalVariantId}`,
          category: 'Uncategorized',
          selling_price: price,
          status: 'draft'
        })
        .select('id')
        .single();
      
      if (itemErr) throw new Error(`Auto-SKU failed to create internal item: ${itemErr.message}`);
      internalItemId = newItem.id;

      // Create canonical SKU pointer
      const { data: newCanonical, error: canonicalErr } = await supabase
        .from("canonical_skus")
        .insert({
          tenant_id: tenantId,
          item_id: internalItemId,
          sku: item.sku || `AUTO-${externalVariantId}`
        })
        .select('id')
        .single();
        
      if (canonicalErr) throw new Error(`Auto-SKU failed to canonicalize: ${canonicalErr.message}`);

      // Map it as 'suggested' so the user can verify it later in the UI (Phase 2 module)
      const { error: newMapErr } = await supabase
        .from("sku_mappings")
        .insert({
          tenant_id: tenantId,
          canonical_sku_id: newCanonical.id,
          channel_item_id: catalogItemId,
          mapping_status: 'suggested',
          confidence_score: 1.0
        });

      if (newMapErr) throw new Error(`Auto-SKU failed to write mapping: ${newMapErr.message}`);
      
    } else {
      internalItemId = typedMapping.canonical_skus.item_id;
    }

    // 1. Construct Inventory Movement shape
    inventoryMovementsToInsert.push({
      tenant_id: tenantId,
      item_id: internalItemId,
      warehouse_id: warehouseId,
      movement_type: "sale",
      quantity: -Math.abs(quantity),
      reference_type: "salla_order",
      reference_id: null,
      notes: `Salla Order Webhook [Ref: ${orderReferenceId}] ingested via event_id: ${event.id}`
    });

    // 2. Construct Invoice Line Item shape (requires invoice_id later)
    invoiceLineItemsToInsert.push({
      tenant_id: tenantId,
      item_id: internalItemId,
      quantity: quantity,
      unit_price: price,
      total_price: price * quantity,
      notes: `Salla Item ID: ${externalVariantId}`
    });
  }

  return {
    inventoryMovements: inventoryMovementsToInsert,
    invoiceLineItems: invoiceLineItemsToInsert,
    orderTotal,
    orderReferenceId
  };
}
