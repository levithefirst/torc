// Public Electrum relay: the app's read methods + broadcast of a valid signed tx. Lets browsers
// (and sandboxed dev servers) reach the chain over HTTPS. Holds no keys.
// Light abuse protection: method allowlist with per-method param checks, a body size cap, and a
// best-effort per-IP rate limit (in memory, per server instance).
import { NextResponse } from 'next/server';
import { decodeTransaction, hexToBin } from '@bitauth/libauth';
import { fanoutCaller, RELAY_METHODS } from '@/lib/chain/electrum';
import { electrumHosts } from '@/lib/chain/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const call = fanoutCaller(electrumHosts(), 6000);

const MAX_BODY = 210_000; // a 100 kB tx is 200,000 hex chars; consensus max standard tx is 100 kB
const WINDOW_MS = 60_000;
const LIMIT = 300; // requests per IP per minute (a wallet rescan is ~30 calls)
const BROADCAST_LIMIT = 12; // broadcasts per IP per minute
const hits = new Map<string, { t: number; n: number; b: number }>();

function limited(ip: string, isBroadcast: boolean): boolean {
  const now = Date.now();
  let h = hits.get(ip);
  if (!h || now - h.t > WINDOW_MS) {
    h = { t: now, n: 0, b: 0 };
    hits.set(ip, h);
    if (hits.size > 10_000) for (const [k, v] of hits) if (now - v.t > WINDOW_MS) hits.delete(k);
  }
  h.n++;
  if (isBroadcast) h.b++;
  return h.n > LIMIT || (isBroadcast && h.b > BROADCAST_LIMIT);
}

const HEX64 = /^[0-9a-f]{64}$/i;
const isHex64 = (v: unknown) => typeof v === 'string' && HEX64.test(v);

function validTxHex(v: unknown): boolean {
  if (typeof v !== 'string' || v.length < 120 || v.length > 200_000 || v.length % 2 || !/^[0-9a-f]+$/i.test(v)) return false;
  return typeof decodeTransaction(hexToBin(v)) !== 'string';
}

/** Per-method param shapes; returns an error message or null. */
function checkParams(method: string, p: unknown[]): string | null {
  switch (method) {
    case 'blockchain.scripthash.listunspent':
      return isHex64(p[0]) && p.length <= 2 && (p[1] === undefined || p[1] === 'include_tokens') ? null : 'bad params';
    case 'blockchain.scripthash.get_history':
    case 'blockchain.scripthash.get_mempool':
      return isHex64(p[0]) && p.length === 1 ? null : 'bad params';
    case 'blockchain.transaction.get':
      return isHex64(p[0]) && p.length <= 2 && (p[1] === undefined || typeof p[1] === 'boolean') ? null : 'bad params';
    case 'blockchain.transaction.broadcast':
      return p.length === 1 && validTxHex(p[0]) ? null : 'not a valid transaction';
    case 'blockchain.headers.get_tip':
      return p.length === 0 ? null : 'bad params';
    case 'blockchain.block.headers':
      return p.length === 2 && Number.isInteger(p[0]) && (p[0] as number) >= 0 && Number.isInteger(p[1]) && (p[1] as number) >= 1 && (p[1] as number) <= 50 ? null : 'bad params';
    default:
      return 'method not allowed';
  }
}

export async function POST(req: Request) {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_BODY) return NextResponse.json({ error: 'body too large' }, { status: 413 });
  const text = await req.text();
  if (text.length > MAX_BODY) return NextResponse.json({ error: 'body too large' }, { status: 413 });
  let body: { method?: unknown; params?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }
  const method = typeof body.method === 'string' ? body.method : '';
  const params = body.params ?? [];
  if (!RELAY_METHODS.has(method)) return NextResponse.json({ error: 'method not allowed' }, { status: 400 });
  if (!Array.isArray(params)) return NextResponse.json({ error: 'bad params' }, { status: 400 });
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || req.headers.get('x-real-ip') || 'unknown';
  if (limited(ip, method === 'blockchain.transaction.broadcast')) return NextResponse.json({ error: 'rate limited, try again in a minute' }, { status: 429 });
  const bad = checkParams(method, params);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  try {
    const result = await call(method, ...(params as (string | number | boolean)[]));
    return NextResponse.json({ result });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 502 });
  }
}
