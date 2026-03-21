export interface NoonInventoryPayload {
  partner_id: string;
  partner_sku: string;
  quantity: number;
}

/**
 * Pushes updated inventory quantity to the Noon Catalog API (Partner Catalog).
 * 
 * @param apiKey The Noon API key for this partner
 * @param payload The Noon-specific inventory update payload array
 * @returns boolean indicating success, or throws an Error
 */
export async function pushNoonInventory(
  apiKey: string,
  payload: NoonInventoryPayload
): Promise<boolean> {
  // Typical Noon outbound NIS catalog endpoint
  const url = `https://catalog.noon.partners/v1/catalog/price-stock`;
  
  // Formulate the NIS structure strictly
  const requestBody = {
    partner_id: payload.partner_id,
    stock: [
      {
        partner_sku: payload.partner_sku,
        quantity: payload.quantity
      }
    ]
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Noon API Error [${response.status}]: ${errorText}`);
  }

  return true;
}
