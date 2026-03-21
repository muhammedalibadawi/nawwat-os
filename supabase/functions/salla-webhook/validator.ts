/**
 * Validates a Salla Webhook HMAC-SHA256 signature using the Web Crypto API.
 * 
 * NOTE: Salla supports both Signature-based and Token-based webhook authentication.
 * For MVP, this endpoint exclusively supports Signature-based validation 
 * as configured in the Salla App webhook settings.
 * 
 * @param rawBody The raw, unparsed string body of the incoming request
 * @param secret The Salla App Webhook Secret (from environment)
 * @param expectedSignature The value of the `x-salla-signature` header
 * @returns boolean indicating if the signature is valid
 */
export async function verifySallaSignature(
  rawBody: string,
  secret: string,
  expectedSignature: string
): Promise<boolean> {
  if (!secret || !expectedSignature) return false;

  try {
    const encoder = new TextEncoder();
    
    // Import the secret key for HMAC operation
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );

    // Compute the signature over the raw body
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(rawBody)
    );

    // Convert the resulting ArrayBuffer to a hex string
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const computedSignature = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // TODO: Use timing-safe constant-time string comparison for production hardening.
    // Use a timing-safe, constant-time comparison in a real production environment
    // For MVP, direct string equality is functionally acceptable
    return computedSignature === expectedSignature;
  } catch (error) {
    console.error("Error computing HMAC signature:", error);
    return false;
  }
}
