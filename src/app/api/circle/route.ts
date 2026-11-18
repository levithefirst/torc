import { NextResponse } from 'next/server';
import { getSnapshot, paramsForAddress } from '@/lib/server/chain';
import { DEMO } from '@/lib/app/demo';
import { paramsToJson } from '@/lib/torc/circle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (v: unknown, init?: ResponseInit) =>
  new NextResponse(JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x)), { ...init, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** GET /api/circle[?address=bchtest:r…] → live snapshot of the demo circle or any Torc circle. */
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get('address');
  let params = DEMO?.params ?? null;
  if (address && address !== DEMO?.tokenAddress) {
    try { params = await paramsForAddress(address); } catch { params = null; }
    if (!params) return json({ error: 'not a Torc circle (no genesis params found for this address)' }, { status: 404 });
  }
  if (!params) return json({ error: 'no demo circle configured' }, { status: 404 });
  const { snap, stale, error } = await getSnapshot(params);
  if (!snap) return json({ error: error ?? 'chain unavailable', params: paramsToJson(params) }, { status: 503 });
  return json({ ...snap, stale });
}
