// POST /api/demo/tick: perform the demo circle's next due step, signed by a THROWAWAY demo
// seat key (derived from DEMO_SEED, or DEMO_SEAT_WIFS; server-only). Funds only ever move between the demo seats and
// the covenant. Rate limit: one action per 60 s per server instance, plus the covenant itself
// (a payout before its time is impossible, so the answer is "available in N s").
import { NextResponse } from 'next/server';
import { DEMO } from '@/lib/app/demo';
import { serverProvider } from '@/lib/server/chain';
import { tick } from '@/lib/torc/demo';
import { demoSeatKeys } from '@/lib/server/demoKeys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const COOLDOWN_MS = 60_000;
let lastActionAt = 0;
let inFlight: Promise<unknown> | null = null;


async function run(isCron: boolean) {
  if (!DEMO) return NextResponse.json({ ok: false, reason: 'error', message: 'no demo circle configured' }, { status: 503 });
  const keys = demoSeatKeys();
  if (!keys.length) return NextResponse.json({ ok: false, reason: 'error', message: 'demo seat keys are not configured on this deployment' }, { status: 503 });
  const since = Date.now() - lastActionAt;
  if (!isCron && since < COOLDOWN_MS) {
    const seconds = Math.ceil((COOLDOWN_MS - since) / 1000);
    return NextResponse.json({ ok: false, reason: 'wait', seconds, message: `Next step available in ${seconds} s` }, { status: 429 });
  }
  if (inFlight) return NextResponse.json({ ok: false, reason: 'wait', seconds: 5, message: 'A step is already being broadcast' }, { status: 429 });
  const t0 = Date.now();
  const p = tick(serverProvider, DEMO.params, keys);
  inFlight = p;
  try {
    const r = await p;
    if (r.ok) lastActionAt = Date.now();
    return NextResponse.json({ ...r, ms: Date.now() - t0 }, { status: r.ok ? 200 : r.reason === 'wait' ? 429 : r.reason === 'error' ? 500 : 409 });
  } finally {
    inFlight = null;
  }
}

export async function POST() {
  return run(false);
}

/** Scheduled runs (Vercel Cron / GitHub Actions) authenticate with CRON_SECRET. */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return run(true);
}
