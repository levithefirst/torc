import 'server-only';
import { electrumCaller } from '../chain/electrum';
import { electrumHosts, NETWORK } from '../chain/config';
import { TorcProvider } from '../chain/provider';
import { readSnapshot, discoverParams, type Snapshot } from '../torc/snapshot';
import type { CircleParams } from '../torc/circle';

export const serverProvider = new TorcProvider(electrumCaller(electrumHosts(), 5000), NETWORK);

const lastGood = new Map<string, Snapshot>();

function timeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`chain read timed out after ${ms} ms`)), ms))]);
}

/** Read the circle with a hard timeout; on failure return the last good snapshot marked stale. */
export async function getSnapshot(params: CircleParams, ms = 5000): Promise<{ snap: Snapshot | null; stale: boolean; error?: string }> {
  const key = params.circleCategory;
  try {
    const snap = await timeout(readSnapshot(serverProvider, params), ms);
    lastGood.set(key, snap);
    return { snap, stale: false };
  } catch (e) {
    return { snap: lastGood.get(key) ?? null, stale: true, error: String((e as Error)?.message ?? e) };
  }
}

const discovered = new Map<string, CircleParams | null>();
export async function paramsForAddress(address: string): Promise<CircleParams | null> {
  if (!discovered.has(address)) discovered.set(address, await timeout(discoverParams(serverProvider, address), 8000));
  return discovered.get(address) ?? null;
}
