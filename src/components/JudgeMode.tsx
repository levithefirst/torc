'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Snapshot, FeedRow } from '@/lib/torc/snapshot';
import { paramsFromJson, type CircleParamsJson } from '@/lib/torc/circle';
import { useLiveSnapshot, type LiveStatus } from '@/hooks/useLiveSnapshot';
import { Ring } from './Ring';
import { Feed } from './Feed';
import { assetInfo, fmtDuration, fmtUnits, seatName, shortTx } from '@/lib/app/demo';
import { REPO_URL, NETWORK } from '@/lib/chain/config';
import { TxLink } from './TxLink';
import Link from 'next/link';

const contractUrl = (line: number) => `${REPO_URL}/blob/main/contracts/TorcCircle.cash#L${line}`;

export function fmtLocal(ms: number) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(ms);
}
/** Same on server and client (no locale or time zone), for the first render before hydration. */
const fmtUtc = (ms: number) => `${new Date(ms).toISOString().slice(11, 16)} UTC`;

// `now` is null on the server and on the first client render, so the hydrated text matches the
// server HTML (React error #418 otherwise: the server formats times in UTC, the browser locally).
function StatusPill({ status, asOf, stale, now }: { status: LiveStatus; asOf?: number; stale?: boolean; now: number | null }) {
  if ((status === 'live' || status === 'polling') && !stale && asOf && now !== null && now - asOf < 30_000)
    return (
      <span data-testid="live-status" data-status="live" className="inline-flex items-center gap-1.5 text-[12px] text-text-2">
        <span aria-hidden className="size-2 rounded-full bg-confirmed" /> live from {NETWORK} · {status === 'live' ? 'Electrum WebSocket' : 'server relay'}
      </span>
    );
  return (
    <span data-testid="live-status" data-status={status} className="inline-flex items-center gap-1.5 text-[12px] text-warning">
      <span aria-hidden className="size-2 rounded-full border border-warning" />
      {asOf ? `as of ${now === null ? fmtUtc(asOf) : fmtLocal(asOf)}` : 'chain not reached yet'} · {status === 'polling' ? 'live via server' : status === 'connecting' ? 'connecting live feed' : 'reconnecting'}
    </span>
  );
}

export function payoutLine(snap: Snapshot, nowMs: number) {
  const opensAt = snap.state.roundStart + snap.params.period;
  // Chain clock = median-time-past, extrapolated from when we read it.
  const chainNow = snap.mtp + Math.max(0, (nowMs - snap.asOf) / 1000);
  const left = opensAt - chainNow;
  return left <= 0 ? 'payout window open' : `payout opens in ~${fmtDuration(left)} of chain time`;
}

type TickState =
  | { s: 'idle' }
  | { s: 'running'; t0: number }
  | { s: 'done'; msg: string; txid: string; ms: number; kind: 'contribute' | 'claim'; seat: number; amount: string }
  | { s: 'wait'; until: number; msg: string }
  | { s: 'error'; msg: string };

export function JudgeMode({ initial, paramsJson, names, circleName, stale, events }: {
  initial: Snapshot | null;
  paramsJson: CircleParamsJson;
  names: string[];
  circleName: string;
  stale: boolean;
  events: { kind: string; txid: string }[];
}) {
  const params = useMemo(() => paramsFromJson(paramsJson), [paramsJson]);
  const { snap, status, refresh, setSnap } = useLiveSnapshot(params, initial);
  const asset = assetInfo(paramsJson);
  const [now, setNow] = useState<number | null>(null);
  const [t, setT] = useState<TickState>({ s: 'idle' });
  const [prevTurn, setPrevTurn] = useState(initial?.turnSeat);
  useEffect(() => { setNow(Date.now()); const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);
  useEffect(() => { if (snap) setPrevTurn(snap.turnSeat); }, [snap]);

  async function runNext() {
    const t0 = performance.now();
    setT({ s: 'running', t0 });
    try {
      const r = await fetch('/api/demo/tick', { method: 'POST' });
      const j = await r.json();
      if (j.ok) {
        const ms = Math.round(performance.now() - t0);
        // The node accepted the tx into its mempool: show it as SEEN 0-conf right away.
        if (snap && !snap.feed.some((f) => f.txid === j.txid)) {
          const row: FeedRow = { txid: j.txid, kind: j.kind, seat: j.seat, round: j.round, height: 0, amount: j.kind === 'claim' ? (params.contribution * BigInt(params.seats)).toString() : params.contribution.toString() };
          setSnap({ ...snap, feed: [row, ...snap.feed].slice(0, Math.max(snap.feed.length, 1)), historyCount: (snap.historyCount ?? snap.feed.length) + 1 });
        }
        setT({ s: 'done', txid: j.txid, ms, kind: j.kind, seat: j.seat, amount: j.amount ?? (j.kind === 'claim' ? (params.contribution * BigInt(params.seats)).toString() : params.contribution.toString()), msg: `${seatName(names, j.seat)} ${j.kind === 'claim' ? 'received the pot' : 'paid in'}${j.claimNext ? ' · that completes the round, so the next step pays out the pot' : ''}` });
        refresh();
      } else if (j.reason === 'wait') {
        setT({ s: 'wait', until: Date.now() + (j.seconds ?? 30) * 1000, msg: j.message });
      } else setT({ s: 'error', msg: j.message ?? 'Something went wrong' });
    } catch (e) {
      setT({ s: 'error', msg: String((e as Error).message) });
    }
  }

  const showcase = {
    genesis: events.find((e) => e.kind === 'genesis')?.txid ?? snap?.feed.find((f) => f.kind === 'genesis')?.txid,
    contribute: snap?.feed.find((f) => f.kind === 'contribute')?.txid ?? events.find((e) => e.kind === 'contribute')?.txid,
    claim: snap?.feed.find((f) => f.kind === 'claim')?.txid ?? events.find((e) => e.kind === 'claim')?.txid,
  };

  const waitLeft = t.s === 'wait' ? Math.max(0, Math.ceil((t.until - (now ?? Date.now())) / 1000)) : 0;
  const potTotal = BigInt(params.contribution) * BigInt(params.seats);
  const claimDue = snap?.next.kind === 'claim';
  const lastClaim = snap?.feed.find((f) => f.kind === 'claim');
  const payout = t.s === 'done' && t.kind === 'claim' ? { seat: t.seat, txid: t.txid, amount: t.amount, fresh: true } : lastClaim ? { seat: lastClaim.seat, txid: lastClaim.txid, amount: lastClaim.amount ?? potTotal.toString(), fresh: false } : null;

  return (
    <section className="grid gap-8 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]" data-testid="judge-mode">
      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{circleName}</h2>
          <StatusPill status={status} asOf={snap?.asOf} stale={stale && status !== 'live' && snap === initial} now={now} />
        </div>
        {snap ? <Ring snap={snap} names={names} key={prevTurn} /> : <p className="py-16 text-center text-text-2">Reaching the chain…</p>}
      </div>

      <div className="min-w-0">
        {snap && (
          <div className="rounded-[var(--radius)] border border-border-subtle bg-surface p-4">
            <p className="text-[15px]" data-testid="pot">
              <span className="num text-xl font-semibold" data-testid="pot-amount">{fmtUnits(snap.potUnits, asset)}</span>{' '}
              <span className="text-text-2">in the ring ·</span> <span className="num">{snap.paid} of {snap.params.seats}</span>{' '}
              <span className="text-text-2">paid ·</span> <span>{payoutLine(snap, now ?? snap.asOf)}</span>
            </p>
            <p className="mt-1 text-sm text-text-2" data-testid="turn-label">
              Round {snap.state.round + 1} · pays <span className="font-medium text-text">{seatName(names, snap.turnSeat)}</span> next · {fmtUnits(BigInt(snap.params.contribution) * BigInt(snap.params.seats), asset)} pot
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                data-testid="run-next"
                onClick={runNext}
                disabled={t.s === 'running' || waitLeft > 0}
                className="rounded-[var(--radius)] bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-60 [html:not(.dark)_&]:border [html:not(.dark)_&]:border-text"
              >
                {t.s === 'running' ? 'Broadcasting…' : claimDue && snap ? `Run the next step live: pay ${seatName(names, snap.turnSeat)} the pot` : 'Run the next step live'}
              </button>
              <span className="text-[13px] text-text-2" data-testid="run-result" aria-live="polite">
                {t.s === 'done' && (
                  <>
                    {t.msg} · broadcast in <span className="num">{(t.ms / 1000).toFixed(1)} s</span> · <TxLink txid={t.txid} />
                  </>
                )}
                {t.s === 'wait' && <span data-testid="run-wait">{waitLeft > 0 ? `Next step available in ${waitLeft} s` : t.msg}</span>}
                {t.s === 'error' && <span className="text-danger">{t.msg}</span>}
                {t.s === 'idle' && 'Signs with a demo seat key on the server. No wallet needed.'}
              </span>
            </div>
            {payout && (
              <div
                data-testid="payout"
                data-fresh={payout.fresh ? '1' : '0'}
                className={`mt-4 rounded-[var(--radius)] border p-3 text-sm ${payout.fresh ? 'border-confirmed bg-confirmed/10' : 'border-border-subtle'}`}
              >
                <span className="font-semibold">{seatName(names, payout.seat)} received {fmtUnits(payout.amount, asset)}</span>
                <span className="text-text-2"> {payout.fresh ? 'just now: the whole pot, paid by the covenant to the turn seat' : '· the latest payout: the whole pot, paid by the covenant to the turn seat'} · </span>
                <TxLink txid={payout.txid} label={`tx ${shortTx(payout.txid)}`} />
              </div>
            )}
            <p className="mt-3 text-[13px]">
              <Link href="/circle/demo" data-testid="open-circle" className="font-medium text-accent-text underline-offset-2 hover:underline">Open this circle →</Link>
              <span className="text-text-2"> its own page, with the seat panel for wallet holders</span>
            </p>
          </div>
        )}

        <h3 className="mb-1 mt-6 text-sm font-semibold uppercase tracking-wide text-text-2">On-chain activity</h3>
        {snap ? <Feed rows={snap.feed} names={names} asset={asset} highlight={t.s === 'done' ? t.txid : undefined} total={snap.historyCount} address={snap.address} /> : <p className="text-sm text-text-2">Waiting for the chain…</p>}
      </div>

      <ol className="grid gap-3 text-sm md:col-span-2 md:grid-cols-3" data-testid="how-it-works">
        {[
          { n: 1, title: 'Start a circle', body: 'One transaction mints a state NFT into the covenant and one member NFT per seat.', fn: 'genesis', line: 1, txid: showcase.genesis },
          { n: 2, title: 'Everyone pays in', body: 'contribute() sets your seat’s bit and locks exactly one contribution in the ring.', fn: 'contribute()', line: 25, txid: showcase.contribute },
          { n: 3, title: 'The turn seat takes the pot', body: 'claim() pays the whole pot to the holder of the turn seat’s NFT, and nobody else.', fn: 'claim()', line: 72, txid: showcase.claim },
        ].map((s) => (
          <li key={s.n} className="rounded-[var(--radius)] border border-border-subtle p-3">
            <div className="font-semibold">{s.n}. {s.title}</div>
            <p className="mt-1 text-text-2">{s.body}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 text-[12px]">
              <a className="text-accent-text underline-offset-2 hover:underline" href={contractUrl(s.line)}>{s.fn} in TorcCircle.cash</a>
              {s.txid && <TxLink txid={s.txid} label={`tx ${shortTx(s.txid)}`} className="num text-accent-text underline-offset-2 hover:underline" />}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
