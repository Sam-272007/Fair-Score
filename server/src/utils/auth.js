import crypto from 'node:crypto';

/**
 * Generates high-entropy capability token for admin or judge access.
 */
export function generateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Computes SHA-256 hash of a capability token.
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verifies admin token using timing-safe comparison to prevent side-channel attacks.
 */
export function verifyToken(token, expectedHash) {
  if (!token || !expectedHash) return false;
  try {
    const computedHash = hashToken(token);
    const expectedBuf = Buffer.from(expectedHash, 'hex');
    const computedBuf = Buffer.from(computedHash, 'hex');

    if (expectedBuf.length !== computedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, computedBuf);
  } catch {
    return false;
  }
}
