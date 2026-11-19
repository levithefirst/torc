// Electrum over WebSocket with host failover. Works in Node (Vercel functions, scripts) and browsers.
import { ElectrumClient, type ElectrumClientEvents } from '@electrum-cash/network';

type Client = ElectrumClient<ElectrumClientEvents>;
export type ElectrumCall = (method: string, ...params: (string | number | boolean)[]) => Promise<unknown>;

const pools = new Map<string, Promise<Client>>();

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function connectAny(hosts: string[], timeoutMs: number): Promise<Client> {
  let last: unknown;
  for (const h of hosts) {
    const [host, port] = h.split(':');
    const client: Client = new ElectrumClient('torc', '1.5', host!, {
      ...(port ? { port: Number(port) } : {}),
      sendKeepAliveIntervalInMilliSeconds: 20_000,
    } as never);
    try {
      await withTimeout(client.connect(), timeoutMs, `connect ${h}`);
      return client;
    } catch (e) {
      last = e;
      client.disconnect(true).catch(() => {});
    }
  }
  throw new Error(`no Electrum server reachable (${hosts.join(', ')}): ${String((last as Error)?.message ?? last)}`);
}

/** Shared, lazily-connected client for a host list. Reconnects to the next host on failure. */
export function electrumClient(hosts: string[], timeoutMs = 5000): Promise<Client> {
  const key = hosts.join(',');
  let p = pools.get(key);
  if (!p) {
    p = connectAny(hosts, timeoutMs);
    pools.set(key, p);
    p.catch(() => pools.delete(key));
  }
  return p;
}

export function resetElectrum(hosts: string[]) {
  const key = hosts.join(',');
  const p = pools.get(key);
  pools.delete(key);
  p?.then((c) => c.disconnect(true)).catch(() => {});
}

export function electrumCaller(hosts: string[], timeoutMs = 5000): ElectrumCall {
  return async (method, ...params) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const c = await electrumClient(hosts, timeoutMs);
        const r = await withTimeout(c.request(method, ...params), timeoutMs, method);
        if (r instanceof Error) throw r;
        return r;
      } catch (e) {
        const msg = String((e as Error)?.message ?? e);
        // Server-side RPC errors (bad tx etc.) are final; connection problems retry on a fresh client.
        if (/timed out|disconnect|connection|socket|reachable/i.test(msg) && attempt === 0) { resetElectrum(hosts); continue; }
        throw e;
      }
    }
    throw new Error('unreachable');
  };
}

/** Calls the /api/chain relay over HTTPS (used where WebSockets are unavailable). */
export function relayCaller(baseUrl: string): ElectrumCall {
  return async (method, ...params) => {
    const r = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chain`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method, params }),
    });
    const j = (await r.json()) as { result?: unknown; error?: string };
    if (!r.ok || j.error) throw new Error(j.error ?? `relay HTTP ${r.status}`);
    return j.result;
  };
}

/** Methods the public relay will forward. Read-only, plus broadcast (anyone may broadcast). */
export const RELAY_METHODS = new Set([
  'blockchain.scripthash.listunspent',
  'blockchain.scripthash.get_history',
  'blockchain.scripthash.get_mempool',
  'blockchain.transaction.get',
  'blockchain.transaction.get_merkle',
  'blockchain.transaction.broadcast',
  'blockchain.headers.get_tip',
  'blockchain.block.header',
  'blockchain.block.headers',
  'server.features',
]);

/**
 * Like electrumCaller, but broadcasts go to every host in parallel (a tx relayed through one
 * poorly-connected node can sit in its mempool unseen by miners). Succeeds if any host accepts it
 * or already knows it. Reads use the normal failover client.
 */
export function fanoutCaller(hosts: string[], timeoutMs = 5000): ElectrumCall {
  const primary = electrumCaller(hosts, timeoutMs);
  const perHost = hosts.map((h) => electrumCaller([h], timeoutMs));
  return async (method, ...params) => {
    if (method !== 'blockchain.transaction.broadcast') return primary(method, ...params);
    const results = await Promise.allSettled(perHost.map((c) => c(method, ...params)));
    const ok = results.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<unknown> | undefined;
    if (ok) return ok.value;
    const errs = results.map((r) => String((r as PromiseRejectedResult).reason?.message ?? (r as PromiseRejectedResult).reason));
    // Already known everywhere means it is out there: report success with the computed txid.
    if (errs.every((e) => /already|known|txn-already-in-mempool|txn-already-known/i.test(e))) {
      const { txidOf } = await import('./provider');
      return txidOf(String(params[0]));
    }
    throw new Error(errs.join(' | '));
  };
}

/**
 * Browser caller: Electrum WebSocket first; if the socket cannot connect (blocked port, captive
 * network), fall back to the /api/chain HTTPS relay for relay-allowed methods and stay there.
 */
export function wsWithRelayFallback(hosts: string[], baseUrl: string, timeoutMs = 8000): ElectrumCall {
  const ws = electrumCaller(hosts, timeoutMs);
  const relay = relayCaller(baseUrl);
  let useRelay = false;
  return async (method, ...params) => {
    if (useRelay && RELAY_METHODS.has(method)) return relay(method, ...params);
    try {
      return await ws(method, ...params);
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (RELAY_METHODS.has(method) && /timed out|disconnect|connection|socket|reachable|connect/i.test(msg)) {
        useRelay = true;
        return relay(method, ...params);
      }
      throw e;
    }
  };
}
