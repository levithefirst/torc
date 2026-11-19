'use client';
import { useState } from 'react';
import { TransactionBuilder, type SpendableUtxo } from 'cashscript';
import { useWallet, ConnectButton } from '@/lib/wallet/WalletProvider';
import type { Snapshot } from '@/lib/torc/snapshot';
import { circleContract, FEE_RATE, type CircleParams } from '@/lib/torc/circle';
import { buildContribute, buildClaim, memberNfts, unlockFor } from '@/lib/torc/txs';
import { decodeMember, hasPaid, allPaid } from '@/lib/torc/state';
import { toTokenAddress, isValidAddress } from '@/lib/torc/address';
import { NETWORK } from '@/lib/chain/config';
import { assetInfo, fmtUnits } from '@/lib/app/demo';
import { TxLink } from './TxLink';
import { lockingBytecodeToCashAddress, hexToBin } from '@bitauth/libauth';
import { prefixFor } from '@/lib/torc/address';

/** Wall-clock estimate of a chain-clock time (MTP lags wall clock; snap.mtp was read at snap.asOf). */
const toWall = (snap: Snapshot, chainTs: number) => (chainTs - snap.mtp) * 1000 + snap.asOf;
const fmtWhen = (ms: number) => new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(ms);

function icsHref(title: string, ms: number, desc: string) {
  const d = new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//torc//circle//EN', 'BEGIN:VEVENT', `UID:${ms}-${title.length}@torc`, `DTSTAMP:${d}`, `DTSTART:${d}`, `SUMMARY:${title}`, `DESCRIPTION:${desc}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export function MemberPanel({ snap, params, names, onSent }: { snap: Snapshot; params: CircleParams; names: string[]; onSent: (txid: string) => void }) {
  const w = useWallet();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; txid?: string; error?: boolean } | null>(null);
  const [dest, setDest] = useState('');
  const asset = assetInfo(params);
  // Seats in seat order (a wallet may hold several).
  const mine = memberNfts(params, w.utxos).sort((a, b) => decodeMember(a.token!.nft!.commitment) - decodeMember(b.token!.nft!.commitment));
  const opensAt = snap.state.roundStart + params.period;
  // Seats this wallet paid this round, remembered until the next snapshot shows it on chain.
  const [paidLocal, setPaidLocal] = useState<{ round: number; seats: number[] }>({ round: -1, seats: [] });
  const holderLabel = (nft: SpendableUtxo, seat: number) => {
    if (names[seat]) return names[seat];
    const a = lockingBytecodeToCashAddress({ bytecode: hexToBin(nft.lockingBytecode), prefix: prefixFor(NETWORK) });
    const addr = typeof a === 'string' ? '' : a.address;
    const body = addr.split(':')[1] ?? addr;
    return body ? `${body.slice(0, 6)}…${body.slice(-4)}` : 'your wallet';
  };

  async function act(label: string, f: () => Promise<string>) {
    setBusy(label); setMsg(null);
    try {
      const txid = await f();
      setMsg({ text: `${label} sent. It shows as SEEN 0-conf in a moment.`, txid });
      onSent(txid);
    } catch (e) {
      setMsg({ text: String((e as Error).message ?? e), error: true });
    } finally { setBusy(null); }
  }

  async function contribute(nft: SpendableUtxo, seat: number) {
    const round = snap.state.round;
    const ws = w.walletSide()!;
    const contract = circleContract(params, w.provider);
    const { builder } = buildContribute({ provider: w.provider, params, contract, contractUtxos: await contract.getUtxos(), wallet: ws, memberNft: nft });
    const txid = await w.signAndSend(builder, `Pay ${fmtUnits(params.contribution, asset)} into this circle`);
    setPaidLocal((p) => ({ round, seats: p.round === round ? [...p.seats, seat] : [seat] }));
    return txid;
  }
  async function claim(nft: SpendableUtxo) {
    const ws = w.walletSide()!;
    const contract = circleContract(params, w.provider);
    const { mtp } = await w.provider.medianTimePast();
    const { builder } = buildClaim({ provider: w.provider, params, contract, contractUtxos: await contract.getUtxos(), wallet: ws, memberNft: nft, locktime: mtp - 1 });
    return w.signAndSend(builder, `Take the ${fmtUnits(params.contribution * BigInt(params.seats), asset)} pot`);
  }
  async function transfer(nft: SpendableUtxo) {
    if (!isValidAddress(dest, NETWORK)) throw new Error(`Enter a ${NETWORK} address`);
    const ws = w.walletSide()!;
    const tb = new TransactionBuilder({ provider: w.provider });
    tb.addInput(nft, unlockFor(ws, nft));
    let have = nft.satoshis;
    for (const u of ws.utxos.filter((x) => !x.token).sort((a, b) => Number(b.satoshis - a.satoshis))) {
      if (have >= nft.satoshis + 2000n) break;
      tb.addInput(u, unlockFor(ws, u)); have += u.satoshis;
    }
    tb.addOutput({ to: toTokenAddress(dest), amount: nft.satoshis, token: nft.token! });
    tb.addBchChangeOutputIfNeeded({ to: ws.address, feeRate: FEE_RATE });
    return w.signAndSend(tb, 'Transfer your seat in this circle');
  }

  return (
    <div className="rounded-[var(--radius)] border border-border-subtle bg-surface p-4" data-testid="member-panel">
      <h3 className="mb-2 font-semibold">Your seats</h3>
      <ConnectButton />
      {w.ready && !w.scanning && mine.length === 0 && (
        <p className="mt-3 text-sm text-text-2">This wallet holds no seat in this circle on {NETWORK}. A seat is a member NFT; whoever holds it is that seat.</p>
      )}
      <ul className="mt-3 grid gap-3">
        {mine.map((nft) => {
          const seat = decodeMember(nft.token!.nft!.commitment);
          const paid = hasPaid(snap.state, seat) || (paidLocal.round === snap.state.round && paidLocal.seats.includes(seat));
          const isTurn = seat === snap.turnSeat;
          const open = snap.mtp >= opensAt;
          const roundsAway = (seat - snap.turnSeat + params.seats) % params.seats;
          const payoutChain = opensAt + roundsAway * params.period;
          const dueMs = toWall(snap, opensAt);
          const payMs = toWall(snap, payoutChain);
          return (
            <li key={`${nft.txid}:${nft.vout}`} className="rounded border border-border-subtle p-3 text-sm" data-testid={`my-seat-${seat}`}>
              <div className="font-medium">Seat {seat + 1} · {holderLabel(nft, seat)} {paid && <span className="ml-1 rounded border border-confirmed px-1.5 text-[11px] font-semibold text-confirmed" data-testid="paid-badge">PAID THIS ROUND</span>} {isTurn && <span className="ml-1 rounded bg-accent px-1.5 text-[11px] font-semibold text-on-accent">YOUR TURN</span>}</div>
              <p className="mt-1 text-text-2">
                {paid ? 'Paid this round. ' : <>Your next contribution is due by <b className="text-text">{fmtWhen(dueMs)}</b>. </>}
                Your payout: <b className="text-text">{fmtWhen(payMs)}</b>{' '}
                <a className="text-accent-text underline" download="torc-payout.ics" href={icsHref(`Torc payout: ${fmtUnits(params.contribution * BigInt(params.seats), asset)}`, payMs, 'Your turn to take the pot')}>.ics</a>
                {!paid && <> · <a className="text-accent-text underline" download="torc-due.ics" href={icsHref(`Torc contribution due: ${fmtUnits(params.contribution, asset)}`, dueMs, 'Pay into your circle')}>due .ics</a></>}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {!paid && (
                  <button disabled={!!busy} onClick={() => act('Contribution', () => contribute(nft, seat))} className="rounded bg-accent px-3 py-1.5 font-semibold text-on-accent disabled:opacity-50" data-testid="btn-contribute">
                    {busy === 'Contribution' ? 'Check your wallet…' : `Contribute ${fmtUnits(params.contribution, asset)}`}
                  </button>
                )}
                <button disabled={!!busy || !isTurn || !allPaid(snap.state, params.seats) || !open} onClick={() => act('Claim', () => claim(nft))} className="rounded border border-border px-3 py-1.5 disabled:opacity-50" data-testid="btn-claim">
                  {busy === 'Claim' ? 'Check your wallet…' : 'Claim the pot'}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder={`${NETWORK === 'mainnet' ? 'bitcoincash' : 'bchtest'}:… new holder`} className="num min-w-0 flex-1 rounded border border-border bg-bg px-2 py-1 text-[12px]" aria-label="Address to transfer this seat to" />
                <button disabled={!!busy || !dest} onClick={() => act('Seat transfer', () => transfer(nft))} className="rounded border border-border px-3 py-1 text-[12px] disabled:opacity-50">Transfer seat</button>
              </div>
            </li>
          );
        })}
      </ul>
      {msg && (
        <p className={`mt-3 text-sm ${msg.error ? 'text-danger' : 'text-text-2'}`} data-testid="member-msg">
          {msg.text} {msg.txid && <TxLink txid={msg.txid} />}
        </p>
      )}
    </div>
  );
}
