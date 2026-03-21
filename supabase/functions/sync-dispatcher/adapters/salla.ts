export interface SallaInventoryPayload {
  merchant_id: string;
  external_variant_id: string;
  quantity: number;
}

/**
 * Pushes updated inventory quantity to the Salla Merchant API.
 * 
 * @param accessToken The Salla OAuth access token for this merchant
 * @param payload The Salla-specific inventory update payload
 * @returns boolean indicating success, or throws an Error with the API message for text logging
 */
export async function pushSallaInventory(
  accessToken: string,
  payload: SallaInventoryPayload
): Promise<boolean> {
  // Assuming a generic Salla API endpoint for inventory updates.
  // The actual endpoint format may be e.g., POST https://api.salla.dev/admin/v2/products/{product_id}/variants/{variant_id}
  // For MVP, we use the generalized approach to represent an outbound push intent.
  const endpoint = `https://api.salla.dev/admin/v2/inventory/variants/${payload.external_variant_id}`;

  try {
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        quantity: payload.quantity
      })
    });

    if (response.ok) {
      return true;
    }

    // Handle non-200 responses
    const errorText = await response.text();
    throw new Error(`Salla API Error [HTTP ${response.status}]: ${errorText.substring(0, 200)}`);
    
  } catch (error) {
    if (error instanceof Error) {
      throw Math.abs(error.message.indexOf("Salla API Error")) !== -1 ? error : new Error(`Network/Fetch Error: ${error.message}`);
    } else {
       throw new Error(`Unknown Salla Adapter Exception`);
    }
  }
}
