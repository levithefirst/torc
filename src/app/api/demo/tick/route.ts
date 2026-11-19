// POST /api/demo/tick: perform the demo circle's next due step, signed by a THROWAWAY demo
// seat key (derived from DEMO_SEED, or DEMO_SEAT_WIFS; server-only). Funds only ever move between the demo seats and
// the covenant. Rate limit: one action per 60 s per server instance, plus the covenant itself
// (a payout before its time is impossible, so the answer is "available in N s").
// Exception: the payout right after the round's last contribution skips the 60 s wait, so a
// visitor sees "Ade received the pot" straight after 3 of 3. It is still one tx, still serialised
// by inFlight, still refused by the covenant before the payout opens, and it moves funds only
// from the covenant to the demo seat whose turn it is; the cooldown applies again after it.
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
let claimNext = false; // the last action completed a round: the payout may follow at once
let claimWaitUntil = 0; // the covenant said the payout is not open yet: answer from memory until then
let inFlight: Promise<unknown> | null = null;


async function run(isCron: boolean) {
  if (!DEMO) return NextResponse.json({ ok: false, reason: 'error', message: 'no demo circle configured' }, { status: 503 });
  const keys = demoSeatKeys();
  if (!keys.length) return NextResponse.json({ ok: false, reason: 'error', message: 'demo seat keys are not configured on this deployment' }, { status: 503 });
  const since = Date.now() - lastActionAt;
  if (!isCron && since < COOLDOWN_MS && !claimNext) {
    const seconds = Math.ceil((COOLDOWN_MS - since) / 1000);
    return NextResponse.json({ ok: false, reason: 'wait', seconds, message: `Next step available in ${seconds} s` }, { status: 429 });
  }
  if (!isCron && claimNext && Date.now() < claimWaitUntil) {
    const seconds = Math.ceil((claimWaitUntil - Date.now()) / 1000);
    return NextResponse.json({ ok: false, reason: 'wait', seconds, message: `The payout opens in about ${seconds} s of chain time` }, { status: 429 });
  }
  if (inFlight) return NextResponse.json({ ok: false, reason: 'wait', seconds: 5, message: 'A step is already being broadcast' }, { status: 429 });
  const t0 = Date.now();
  const p = tick(serverProvider, DEMO.params, keys);
  inFlight = p;
  try {
    const r = await p;
    if (r.ok) {
      lastActionAt = Date.now();
      claimNext = r.claimNext;
    } else if (r.reason === 'wait') claimWaitUntil = Date.now() + Math.min(Math.max(r.seconds, 5), 600) * 1000;
    else claimNext = false;
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
