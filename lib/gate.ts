// Passcode gate cookie: signed, not encrypted — payload is a fixed constant,
// so there's nothing to hide, only tampering to detect. Uses Web Crypto
// (crypto.subtle) rather than Node's crypto module so this works unchanged
// in both middleware's Edge runtime and the Server Action's Node runtime.

export const GATE_COOKIE_NAME = 'inventro_gate';

const PAYLOAD = 'ok';

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function toBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function signGateCookie(secret: string): Promise<string> {
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(PAYLOAD));
  return `${PAYLOAD}.${toBase64Url(signature)}`;
}

export async function verifyGateCookie(cookieValue: string | undefined, secret: string): Promise<boolean> {
  if (!cookieValue) return false;
  const [payload, signature] = cookieValue.split('.');
  if (payload !== PAYLOAD || !signature) return false;

  const key = await importSigningKey(secret);
  try {
    return await crypto.subtle.verify('HMAC', key, fromBase64Url(signature), new TextEncoder().encode(payload));
  } catch {
    return false;
  }
}
