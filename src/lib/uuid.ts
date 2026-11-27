import { createHash } from 'node:crypto';

/** Fixed namespace so seed identifiers stay stable between resets (RFC 9562, UUID version 5). */
export const EASYLOOK_NAMESPACE = '6f1d1c4e-2b7a-5c1e-9d3f-0e8a4b2c7d10';

export function uuidV5(name: string, namespace: string = EASYLOOK_NAMESPACE): string {
  const namespaceBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(namespaceBytes).update(name, 'utf8').digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
