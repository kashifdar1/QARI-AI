import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

/**
 * scrypt (Node's built-in crypto, no native addon) rather than bcrypt/argon2
 * — avoids a native-module build step in this stack for Milestone A; revisit
 * with argon2id if/when a native build pipeline exists for services/api.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  const storedKey = Buffer.from(key, 'hex');
  if (derivedKey.length !== storedKey.length) return false;
  return timingSafeEqual(derivedKey, storedKey);
}

/** A random, never-typed-in password for guest accounts — no one can ever log into a guest row with a password. */
export function generateUnusablePassword(): string {
  return randomBytes(32).toString('hex');
}
