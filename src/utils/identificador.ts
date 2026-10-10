/** Gera identificadores também em navegadores conectados por HTTP na rede local. */
export function criarIdentificador(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hexadecimal = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return [
        hexadecimal.slice(0, 8),
        hexadecimal.slice(8, 12),
        hexadecimal.slice(12, 16),
        hexadecimal.slice(16, 20),
        hexadecimal.slice(20),
    ].join('-');
}
