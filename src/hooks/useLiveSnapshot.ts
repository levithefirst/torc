'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { electrumClient, electrumCaller, resetElectrum } from '@/lib/chain/electrum';
import { electrumHosts, NETWORK } from '@/lib/chain/config';
import { TorcProvider, scripthashOf } from '@/lib/chain/provider';
import { readSnapshot, type Snapshot } from '@/lib/torc/snapshot';
import type { CircleParams } from '@/lib/torc/circle';

export type LiveStatus = 'connecting' | 'live' | 'polling' | 'offline';

/**
 * Subscribes to the covenant address over Electrum WebSocket in the browser, re-reading the
 * circle on every notification. Falls back to polling /api/circle when Electrum is unreachable.
 */
export function useLiveSnapshot(params: CircleParams | null, initial: Snapshot | null) {
  const [snap, setSnap] = useState<Snapshot | null>(initial);
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const providerRef = useRef<TorcProvider | null>(null);
  const busy = useRef(false);
  const again = useRef(false);

  const refresh = useCallback(async () => {
    if (!params) return;
    if (busy.current) { again.current = true; return; }
    busy.current = true;
    try {
      do {
        again.current = false;
        try {
          if (!providerRef.current) throw new Error('no provider');
          const s = await readSnapshot(providerRef.current, params);
          setSnap(s);
          setStatus('live');
        } catch {
          try {
            const r = await fetch(`/api/circle?address=${encodeURIComponent(addressOf(params))}`, { cache: 'no-store' });
            if (r.ok) { setSnap(await r.json()); setStatus('polling'); } else setStatus('offline');
          } catch { setStatus('offline'); }
        }
      } while (again.current);
    } finally {
      busy.current = false;
    }
  }, [params]);

  useEffect(() => {
    if (!params) return;
    let cancelled = false;
    const hosts = electrumHosts();
    let unsub: (() => void) | undefined;
    (async () => {
      providerRef.current = new TorcProvider(electrumCaller(hosts, 6000), NETWORK);
      try {
        const client = await electrumClient(hosts, 6000);
        if (cancelled) return;
        const sh = scripthashOf(lockOf(params));
        const onNote = (n: { method: string; params?: unknown[] }) => {
          if (n.method === 'blockchain.scripthash.subscribe' && n.params?.[0] === sh) refresh();
          if (n.method === 'blockchain.headers.subscribe') refresh();
        };
        client.on('notification', onNote as never);
        await client.subscribe('blockchain.scripthash.subscribe', sh);
        await client.subscribe('blockchain.headers.subscribe');
        unsub = () => {
          client.off('notification', onNote as never);
          client.unsubscribe('blockchain.scripthash.subscribe', sh).catch(() => {});
        };
        setStatus('live');
      } catch {
        resetElectrum(hosts);
        setStatus('polling');
      }
      refresh();
    })();
    const iv = setInterval(refresh, 20_000);
    return () => { cancelled = true; clearInterval(iv); unsub?.(); };
  }, [params, refresh]);

  return { snap, status, refresh, setSnap };
}

// Covenant address / lock for params (computed lazily to keep this hook light).
import { circleContract } from '@/lib/torc/circle';
const cache = new Map<string, { address: string; lock: string }>();
function info(p: CircleParams) {
  const k = `${p.circleCategory}:${p.contribution}:${p.seats}:${p.period}:${p.mode}`;
  let v = cache.get(k);
  if (!v) {
    const c = circleContract(p, { network: NETWORK } as never);
    v = { address: c.tokenAddress, lock: c.lockingBytecode };
    cache.set(k, v);
  }
  return v;
}
const addressOf = (p: CircleParams) => info(p).address;
const lockOf = (p: CircleParams) => info(p).lock;
