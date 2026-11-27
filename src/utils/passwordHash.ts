const PBKDF2_PREFIX = 'pbkdf2_sha256$';
const SHA256_PREFIX = 'sha256$';
const PBKDF2_ITERATIONS = 50_000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function randomSaltHex(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return toHex(bytes);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function sha256HexFallback(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));
  const msg = Array.from(bytes);
  const bitLen = msg.length * 8;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  for (let i = 7; i >= 0; i--) msg.push(Math.floor(bitLen / Math.pow(2, i * 8)) & 0xff);
  const W = new Array<number>(64);
  for (let i = 0; i < msg.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = (msg[i + t * 4] << 24) | (msg[i + t * 4 + 1] << 16) | (msg[i + t * 4 + 2] << 8) | msg[i + t * 4 + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(7, W[t - 15]) ^ rotr(18, W[t - 15]) ^ (W[t - 15] >>> 3);
      const s1 = rotr(17, W[t - 2]) ^ rotr(19, W[t - 2]) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');
}

async function derivePbkdf2Hex(password: string, saltBytes: Uint8Array, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const saltBuffer = new Uint8Array(saltBytes.length);
  saltBuffer.set(saltBytes);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return toHex(new Uint8Array(bits));
}

export function isHashedPassword(stored?: string | null): boolean {
  if (!stored) return false;
  return stored.startsWith(PBKDF2_PREFIX) || stored.startsWith(SHA256_PREFIX);
}

/**
 * Produces a salted PBKDF2-SHA256 password digest (`pbkdf2_sha256$<iter>$<saltHex>$<digestHex>`, ~117 chars, <= 200 char Firestore limit).
 * Already-hashed inputs are returned unchanged so saving a loaded profile never double-hashes.
 */
export async function hashPassword(password: string): Promise<string> {
  const raw = String(password || '');
  if (!raw) return '';
  if (isHashedPassword(raw)) return raw;

  const saltHex = randomSaltHex(16);
  const saltBytes = fromHex(saltHex)!;

  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.deriveBits === 'function') {
    try {
      const digestHex = await derivePbkdf2Hex(raw, saltBytes, PBKDF2_ITERATIONS);
      return `${PBKDF2_PREFIX}${PBKDF2_ITERATIONS}$${saltHex}$${digestHex}`;
    } catch {
      // Fallback below
    }
  }

  const digestHex = sha256HexFallback(`${saltHex}:${raw}`);
  return `${SHA256_PREFIX}${saltHex}$${digestHex}`;
}

/**
 * Verifies a plaintext password input against a stored digest or legacy plaintext password.
 */
export async function verifyPassword(plainInput: string, storedPassword?: string | null): Promise<boolean> {
  const stored = String(storedPassword || '');
  if (!stored) return true;

  if (stored.startsWith(PBKDF2_PREFIX)) {
    const rest = stored.slice(PBKDF2_PREFIX.length);
    const parts = rest.split('$');
    if (parts.length !== 3) return false;
    const iterations = Number(parts[0]);
    const saltBytes = fromHex(parts[1]);
    const expectedHex = parts[2];
    if (!Number.isFinite(iterations) || iterations <= 0 || !saltBytes || !expectedHex) {
      return false;
    }
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.deriveBits === 'function') {
      const derivedHex = await derivePbkdf2Hex(plainInput, saltBytes, iterations);
      return timingSafeEqualStr(derivedHex, expectedHex);
    }
    return false;
  }

  if (stored.startsWith(SHA256_PREFIX)) {
    const rest = stored.slice(SHA256_PREFIX.length);
    const parts = rest.split('$');
    if (parts.length !== 2) return false;
    const [saltHex, expectedHex] = parts;
    if (!saltHex || !expectedHex) return false;
    const computed = sha256HexFallback(`${saltHex}:${plainInput}`);
    return timingSafeEqualStr(computed, expectedHex);
  }

  // Legacy plaintext compatibility (caller can re-hash & persist on successful login)
  return timingSafeEqualStr(plainInput, stored);
}
