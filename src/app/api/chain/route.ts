// Public Electrum relay: whitelisted read methods + broadcast. Lets clients without WebSocket
// access (and the server itself) reach the chain over HTTPS. Holds no keys.
import { NextResponse } from 'next/server';
import { electrumCaller, RELAY_METHODS } from '@/lib/chain/electrum';
import { electrumHosts } from '@/lib/chain/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const call = electrumCaller(electrumHosts(), 6000);

export async function POST(req: Request) {
  let body: { method?: string; params?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }
  const { method, params = [] } = body;
  if (!method || !RELAY_METHODS.has(method)) return NextResponse.json({ error: 'method not allowed' }, { status: 400 });
  if (!Array.isArray(params) || params.length > 3 || !params.every((p) => ['string', 'number', 'boolean'].includes(typeof p)))
    return NextResponse.json({ error: 'bad params' }, { status: 400 });
  if (params.some((p) => typeof p === 'string' && p.length > 200_000)) return NextResponse.json({ error: 'param too large' }, { status: 400 });
  try {
    const result = await call(method, ...(params as (string | number | boolean)[]));
    return NextResponse.json({ result });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 502 });
  }
}
