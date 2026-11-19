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

// The demo circle's own contract: BCH mode is TorcCircleBch.cash (claim() starts a line earlier).
const contractFor = (mode: string) => (mode === 'bch' ? { file: 'TorcCircleBch.cash', claim: 71 } : { file: 'TorcCircle.cash', claim: 72 });
const contractUrl = (file: string, line: number) => `${REPO_URL}/blob/main/contracts/${file}#L${line}`;

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

export function JudgeMode({ initial, paramsJson, names, circleName, stale, events, intro }: {
  intro?: React.ReactNode;
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
  const contract = contractFor(paramsJson.mode);
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

  const seats = snap?.params.seats ?? params.seats;
  const paidCount = snap?.paid ?? 0;
  const cta = t.s === 'running' ? 'Broadcasting…' : claimDue && snap ? `Run the next step live: pay ${seatName(names, snap.turnSeat)} the pot` : 'Run the next step live';

  return (
    <section data-testid="judge-mode">
      <div className="grid items-start gap-x-14 gap-y-6 sm:gap-y-8 lg:grid-cols-12">
        {intro && <div className="lg:col-span-7 lg:col-start-1 lg:row-start-1">{intro}</div>}

        <div className="fade-up lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 lg:pt-2" style={{ ['--d' as string]: '120ms' }}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b rule pb-2.5 sm:mb-5 sm:pb-3">
            <h2 className="text-[15px] font-semibold tracking-tight">{circleName}</h2>
            <StatusPill status={status} asOf={snap?.asOf} stale={stale && status !== 'live' && snap === initial} now={now} />
          </div>
          {snap ? <Ring snap={snap} names={names} key={prevTurn} /> : <p className="py-24 text-center text-text-2">Reaching the chain…</p>}
        </div>

        <div className="min-w-0 lg:col-span-7 lg:col-start-1 lg:row-start-2">
          {snap && (
            <div className="fade-up rounded-[20px] border rule bg-surface" style={{ ['--d' as string]: '220ms' }}>
              <div className="grid gap-4 p-5 sm:gap-5 sm:p-7">
                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4" data-testid="pot">
                  <div>
                    <div className="eyebrow mb-2">In the ring</div>
                    <div className="num text-[clamp(40px,7vw,64px)] font-medium leading-none tracking-[-0.04em]" data-testid="pot-amount">{fmtUnits(snap.potUnits, asset)}</div>
                  </div>
                  <div className="min-w-[150px]">
                    <div className="mb-2 flex gap-1" aria-hidden>
                      {Array.from({ length: seats }, (_, i) => (
                        <span key={i} className={`h-1.5 flex-1 rounded-full ${i < paidCount ? 'bg-confirmed' : 'bg-line'}`} />
                      ))}
                    </div>
                    <div className="num text-[13px]"><span className="text-text">{snap.paid} of {snap.params.seats}</span> <span className="text-text-2">paid</span></div>
                  </div>
                </div>
                <div className="order-3 grid gap-1 border-t rule pt-4 text-[14px] sm:order-none">
                  <p>{payoutLine(snap, now ?? snap.asOf)}</p>
                  <p className="text-text-2" data-testid="turn-label">
                    Round {snap.state.round + 1} · pays <span className="font-medium text-text">{seatName(names, snap.turnSeat)}</span> next · <span className="num">{fmtUnits(potTotal, asset)}</span> pot
                  </p>
                </div>
                <div className="grid gap-2.5">
                  <button
                    data-testid="run-next"
                    onClick={runNext}
                    disabled={t.s === 'running' || waitLeft > 0}
                    className="btn btn-gold group w-full px-6 py-4 text-[15px] disabled:opacity-60 sm:w-auto sm:justify-self-start"
                  >
                    {t.s === 'running' && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-on-accent border-t-transparent" />}
                    {cta}
                    {t.s !== 'running' && <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>}
                  </button>
                  <span className="text-[13px] text-text-2" data-testid="run-result" aria-live="polite">
                    {t.s === 'done' && (
                      <>
                        <span className="text-text">{t.msg}</span> · broadcast in <span className="num text-text">{(t.ms / 1000).toFixed(1)} s</span> · <TxLink txid={t.txid} />
                      </>
                    )}
                    {t.s === 'wait' && <span data-testid="run-wait">{waitLeft > 0 ? `Next step available in ${waitLeft} s` : t.msg}</span>}
                    {t.s === 'error' && <span className="text-danger">{t.msg}</span>}
                    {t.s === 'idle' && 'A real transaction on chain, signed with a demo seat key on the server. No wallet needed.'}
                  </span>
                </div>
              </div>
              {payout ? (
                <div
                  data-testid="payout"
                  data-fresh={payout.fresh ? '1' : '0'}
                  key={payout.txid}
                  className={`land border-t p-5 sm:px-7 ${payout.fresh ? 'border-confirmed bg-confirmed/10' : 'rule'}`}
                >
                  <div className="eyebrow mb-1.5">{payout.fresh ? 'Paid out just now' : 'Latest payout'}</div>
                  <p className="text-[clamp(20px,3vw,26px)] font-medium leading-tight tracking-[-0.02em]">
                    <span className="serif italic">{seatName(names, payout.seat)}</span> received <span className="num">{fmtUnits(payout.amount, asset)}</span>
                  </p>
                  <p className="mt-1.5 text-[13px] text-text-2">
                    The whole pot, paid by the covenant to the turn seat · <TxLink txid={payout.txid} label={`tx ${shortTx(payout.txid)}`} />
                  </p>
                </div>
              ) : (
                <div className="border-t border-dashed rule p-5 sm:px-7" data-testid="payout-pending">
                  <div className="eyebrow mb-1.5">Next payout</div>
                  <p className="text-[15px] text-text-2">
                    <span className="serif text-[20px] italic text-text">{seatName(names, snap.turnSeat)}</span> receives <span className="num text-text">{fmtUnits(potTotal, asset)}</span> once all {seats} seats have paid and the round time has passed. Nobody else can take it.
                  </p>
                </div>
              )}
            </div>
          )}
          <p className="mt-4 text-[13px]">
            <Link href="/circle/demo" data-testid="open-circle" className="link font-medium">Open this circle →</Link>
            <span className="text-text-2"> its own page, with the seat panel for wallet holders</span>
          </p>
        </div>
      </div>

      <div className="mt-20 grid gap-x-14 gap-y-12 border-t rule pt-10 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <h3 className="eyebrow mb-3">On-chain activity</h3>
          {snap ? <Feed rows={snap.feed} names={names} asset={asset} highlight={t.s === 'done' ? t.txid : undefined} total={snap.historyCount} address={snap.address} /> : <p className="text-sm text-text-2">Waiting for the chain…</p>}
        </div>

        <div className="lg:col-span-5">
          <h3 className="eyebrow mb-5">The covenant, in three calls</h3>
          <ol className="relative grid gap-8 text-sm" data-testid="how-it-works">
            <span aria-hidden className="absolute bottom-3 left-[15px] top-3 w-px bg-line" />
            {[
              { n: 1, title: 'Start a circle', body: 'One transaction mints a state NFT into the covenant and one member NFT per seat.', fn: 'genesis', line: 1, txid: showcase.genesis },
              { n: 2, title: 'Everyone pays in', body: 'contribute() sets your seat’s bit and locks exactly one contribution in the ring.', fn: 'contribute()', line: 25, txid: showcase.contribute },
              { n: 3, title: 'The turn seat takes the pot', body: 'claim() pays the whole pot to the holder of the turn seat’s NFT, and nobody else.', fn: 'claim()', line: contract.claim, txid: showcase.claim },
            ].map((s) => (
              <li key={s.n} className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-4">
                <span className={`num relative z-10 grid size-8 place-items-center rounded-full border bg-bg text-[12px] ${s.n === 3 ? 'border-turn text-turn' : 'rule text-text-2'}`}>{s.n}</span>
                <div className="min-w-0 pt-1">
                  <div className="text-[16px] font-semibold tracking-tight">{s.title}</div>
                  <p className="mt-1 text-text-2">{s.body}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                    <a className="num link" href={contractUrl(contract.file, s.line)}>{s.fn} in {contract.file}</a>
                    {s.txid && <TxLink txid={s.txid} label={`tx ${shortTx(s.txid)}`} className="num link" />}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
