/** SHA-256 hex digest for PIN + salt (Web Crypto). */
export async function sha256Hex(message: string): Promise<string> {
    const enc = new TextEncoder().encode(message);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/** Random hex salt (32 chars = 16 bytes). */
export function generatePinSalt(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
