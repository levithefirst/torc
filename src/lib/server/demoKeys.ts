import 'server-only';
import { NETWORK } from '../chain/config';
import { deriveDemoSeatKey, fromWif } from '../torc/keys';

/** Server-only demo seat signers: from DEMO_SEED (preferred) or DEMO_SEAT_WIFS. */
export function demoSeatKeys(count = 5): { privateKey: Uint8Array }[] {
  const seed = process.env.DEMO_SEED;
  if (seed) return Array.from({ length: count }, (_, i) => ({ privateKey: deriveDemoSeatKey(seed, NETWORK, i) }));
  return (process.env.DEMO_SEAT_WIFS ?? '').split(',').map((s) => s.trim()).filter(Boolean).map((w) => ({ privateKey: fromWif(w) }));
}
