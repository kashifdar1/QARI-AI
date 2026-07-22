/**
 * Minimal UUID v4 generator. Hermes has no built-in `crypto.randomUUID`,
 * and this only needs to be unique-enough for client-generated idempotency
 * keys/attempt ids (collision risk, not unpredictability, is what matters
 * here) — not worth a native crypto dependency for that.
 */
export function generateUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
