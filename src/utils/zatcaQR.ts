// Utility to generate ZATCA Phase 2 compatible TLV (Tag-Length-Value) Base64 string for QR Code
// https://zatca.gov.sa/ar/E-Invoicing/SystemsDevelopers/Documents/QRCode_Implementation_Guidelines.pdf

export const generateZatcaQR = (
    sellerName: string,
    vatRegistrationNumber: string,
    timestamp: string,
    invoiceTotal: string,
    vatTotal: string
): string => {

    // Helper to get hex bytes for TLV
    const getTLV = (tag: number, value: string) => {
        const encoder = new TextEncoder();
        const valueBytes = encoder.encode(value);
        return [tag, valueBytes.length, ...Array.from(valueBytes)];
    };

    const tlvArray = [
        ...getTLV(1, sellerName),
        ...getTLV(2, vatRegistrationNumber),
        ...getTLV(3, timestamp),
        ...getTLV(4, invoiceTotal),
        ...getTLV(5, vatTotal),
    ];

    // Convert array to Uint8Array then to base64
    const uint8Array = new Uint8Array(tlvArray);

    // Browser compatible base64 encoding for Uint8Array
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }

    return btoa(binary);
};

