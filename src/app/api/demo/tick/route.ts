// POST /api/demo/tick: perform the demo circle's next due step, signed by a THROWAWAY demo
// seat key (derived from DEMO_SEED, or DEMO_SEAT_WIFS; server-only). Funds only ever move between the demo seats and
// the covenant. Rate limit: one action per 60 s per server instance, plus the covenant itself
// (a payout before its time is impossible, so the answer is "available in N s").
// Exception: the payout right after the round's last contribution skips the 60 s wait, so a
// visitor sees "Maya received the pot" straight after 3 of 3. It is still one tx, still serialised
// by inFlight, still refused by the covenant before the payout opens, and it moves funds only
// from the covenant to the demo seat whose turn it is; the cooldown applies again after it.
import { NextResponse } from 'next/server';
import { DEMO } from '@/lib/app/demo';
import { serverProvider } from '@/lib/server/chain';
import { tick } from '@/lib/torc/demo';
import { demoSeatKeys } from '@/lib/server/demoKeys';
import { circleContract } from '@/lib/torc/circle';
import { scripthashOf } from '@/lib/chain/provider';

// Worst case cost (docs/DEMO-COST.md): money only moves seat -> covenant -> turn seat, so a drainer burns
// fees only. A round is 3 contributions (once per seat) + 1 claim, and claim() needs 600 s of chain
// time (MTP) since the last payout, so at most ~6 rounds per hour: 6 x (3 x 1,012 + 2,460) sats
// = ~33,000 sats/hour in BCH mode at 1 sat/byte, whatever the number of server instances.
// On top of that, a limit every instance shares because it is read from the chain: at most
// MAX_UNCONFIRMED covenant txs (one full round) may sit unconfirmed at once.
const MAX_UNCONFIRMED = 4;

/** Browsers send Origin on a POST fetch; refuse cross-site callers (a speed bump, not auth). */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function unconfirmedCovenantTxs(): Promise<number> {
  if (!DEMO) return 0;
  const lock = circleContract(DEMO.params, serverProvider).lockingBytecode;
  const mem = (await serverProvider.call('blockchain.scripthash.get_mempool', scripthashOf(lock))) as unknown[];
  return Array.isArray(mem) ? mem.length : 0;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const COOLDOWN_MS = 60_000;
// Cron fills the round but leaves an open payout for a visitor for up to 6 h of chain time.
const CRON_HOLD_CLAIM_S = 6 * 3600;
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
  try {
    if ((await unconfirmedCovenantTxs()) >= MAX_UNCONFIRMED)
      return NextResponse.json({ ok: false, reason: 'wait', seconds: 60, message: 'A full round is waiting for the next block. Try again after it is mined.' }, { status: 429 });
  } catch {
    // Mempool read failed: fail closed so the shared limit can't be bypassed.
    return NextResponse.json({ ok: false, reason: 'wait', seconds: 30, message: 'Could not read the chain right now. Try again in a moment.' }, { status: 503 });
  }
  const t0 = Date.now();
  const p = tick(serverProvider, DEMO.params, keys, isCron ? { holdClaimSeconds: CRON_HOLD_CLAIM_S } : {});
  inFlight = p;
  try {
    const r = await p;
    if (r.ok) {
      lastActionAt = Date.now();
      claimNext = r.claimNext;
    } else if (r.reason === 'wait' && isCron) {
      // A cron hold is not a covenant wait: visitors may still run the payout now.
    } else if (r.reason === 'wait') claimWaitUntil = Date.now() + Math.min(Math.max(r.seconds, 5), 600) * 1000;
    else claimNext = false;
    return NextResponse.json({ ...r, ms: Date.now() - t0 }, { status: r.ok ? 200 : r.reason === 'wait' ? 429 : r.reason === 'error' ? 500 : 409 });
  } finally {
    inFlight = null;
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, reason: 'error', message: 'cross-origin request refused' }, { status: 403 });
  return run(false);
}

/** Scheduled runs (Vercel Cron / GitHub Actions) authenticate with CRON_SECRET. */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return run(true);
}
