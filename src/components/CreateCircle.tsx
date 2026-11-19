'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dryRunGenesis } from '@/lib/app/dryRun';
import { useWallet, ConnectButton } from '@/lib/wallet/WalletProvider';
import { buildGenesis, buildPrepare, pickGenesisInput } from '@/lib/torc/txs';
import { isValidAddress } from '@/lib/torc/address';
import type { AssetMode } from '@/lib/torc/circle';
import { NETWORK } from '@/lib/chain/config';
import { TxLink } from './TxLink';
import { PUSD_MAINNET } from '@/lib/app/demo';
import chipnetAsset from '../../deployments/chipnet-asset.json' with { type: 'json' };
import { BRAND_NAME } from '@/brand';

const ASSET_CATEGORY = NETWORK === 'mainnet' ? PUSD_MAINNET : chipnetAsset.category;
const ASSET_SYMBOL = NETWORK === 'mainnet' ? 'PUSD' : 'tPUSD';
const PERIODS = [
  ...(NETWORK === 'chipnet' ? [{ label: '10 minutes (test)', s: 600 }] : []),
  { label: '1 day', s: 86400 },
  { label: '1 week', s: 7 * 86400 },
];


export function CreateCircle() {
  return (
    <Form />
  );
}

function Form() {
  const w = useWallet();
  const router = useRouter();
  const [seats, setSeats] = useState(3);
  const [members, setMembers] = useState<string[]>(['', '', '', '', '']);
  const [mode, setMode] = useState<AssetMode>('token');
  const [amount, setAmount] = useState('0.10');
  const [period, setPeriod] = useState(PERIODS[NETWORK === 'chipnet' ? 1 : 0]!.s);
  const [dry, setDry] = useState<null | { size: number; fee: number; covenant: string; outputs: number; hex: string }>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; txid?: string; error?: boolean } | null>(null);

  const contribution = useMemo(() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return 0n;
    return mode === 'token' ? BigInt(Math.round(n * 100)) : BigInt(Math.round(n));
  }, [amount, mode]);
  const list = members.slice(0, seats).map((m) => m.trim());
  const valid = list.every((m) => isValidAddress(m, NETWORK)) && contribution > 0n && (mode === 'token' || contribution >= 1000n);
  const params = { network: NETWORK, mode, assetCategory: mode === 'token' ? ASSET_CATEGORY : undefined, contribution, seats, period } as const;

  function fillMine() {
    const me = w.walletSide()?.address;
    if (me) setMembers(members.map(() => me));
  }

  function dryRun() {
    setMsg(null);
    try {
      setDry(dryRunGenesis({ ...params, contribution: contribution || 10n }, list));
    } catch (e) {
      setMsg({ text: String((e as Error).message), error: true });
    }
  }

  async function create() {
    setBusy('create'); setMsg(null);
    try {
      let ws = w.walletSide();
      if (!ws) throw new Error('Connect a wallet first');
      if (!pickGenesisInput(ws)) {
        setMsg({ text: 'Step 1 of 2: your wallet needs a coin at output 0 to mint the circle. Approve a small self-send…' });
        const prep = buildPrepare(w.provider, ws, 20_000n);
        await w.signAndSend(prep, 'Prepare a coin to start a savings circle');
        await new Promise((r) => setTimeout(r, 1500));
        // `w` is this render's snapshot, so read the fresh coins from rescan's return value.
        const fresh = await w.rescan();
        ws = { ...ws, utxos: fresh };
      }
      const { mtp } = await w.provider.medianTimePast();
      const g = buildGenesis({ provider: w.provider, params, wallet: ws, members: list, startTime: mtp });
      const txid = await w.signAndSend(g.builder, `Start a ${seats}-seat ${BRAND_NAME} circle`);
      setMsg({ text: 'Circle created. Opening it…', txid });
      setTimeout(() => router.push(`/circle/${encodeURIComponent(g.contract.tokenAddress)}`), 1200);
    } catch (e) {
      setMsg({ text: String((e as Error).message ?? e), error: true });
    } finally { setBusy(null); }
  }

  const input = 'w-full rounded border border-border bg-bg px-2 py-1.5 text-sm';
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
      <form className="grid gap-4" onSubmit={(e) => e.preventDefault()} data-testid="create-form">
        <fieldset className="grid gap-1">
          <legend className="mb-1 text-sm font-semibold">Seats</legend>
          <div className="flex gap-2">
            {[3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setSeats(n)} aria-pressed={seats === n} className={`rounded border px-3 py-1.5 text-sm ${seats === n ? 'border-accent bg-surface-2' : 'border-border'}`}>{n}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className="grid gap-2">
          <legend className="mb-1 flex items-center gap-3 text-sm font-semibold">
            Member addresses, in payout order
            {w.ready && <button type="button" onClick={fillMine} className="rounded border border-border px-2 py-0.5 text-[12px] font-normal">Use my address for every seat</button>}
          </legend>
          {Array.from({ length: seats }, (_, i) => (
            <input key={i} className={`${input} num`} placeholder={`${NETWORK === 'mainnet' ? 'bitcoincash' : 'bchtest'}:… seat ${i + 1}`} value={members[i]} onChange={(e) => setMembers(members.map((m, j) => (j === i ? e.target.value : m)))} aria-label={`Seat ${i + 1} address`} />
          ))}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Asset</span>
            <select className={input} value={mode} onChange={(e) => { const m = e.target.value as AssetMode; setMode(m); setAmount(m === 'token' ? '0.10' : '2000'); }}>
              <option value="token">{ASSET_SYMBOL} (dollars)</option>
              <option value="bch">BCH (sats)</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Each pays ({mode === 'token' ? ASSET_SYMBOL : 'sats'})</span>
            <input className={`${input} num`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Round length</span>
            <select className={input} value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
              {PERIODS.map((p) => <option key={p.s} value={p.s}>{p.label}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ConnectButton />
          <button type="button" disabled={!valid || !w.ready || !!busy} onClick={create} className={`rounded-[var(--radius)] px-4 py-2 text-sm font-semibold disabled:opacity-60 ${w.ready ? 'bg-accent text-on-accent' : 'border border-border text-text-2'}`} data-testid="btn-create">
            {busy ? 'Check your wallet…' : 'Create circle'}
          </button>
          <button type="button" onClick={dryRun} className="rounded-[var(--radius)] border border-border px-4 py-2 text-sm" data-testid="btn-dry-run">Dry run (no wallet)</button>
        </div>
        {msg && (
          <p className={`text-sm ${msg.error ? 'text-danger' : 'text-text-2'}`} data-testid="create-msg">
            {msg.text} {msg.txid && <TxLink txid={msg.txid} />}
          </p>
        )}
        {dry && (
          <div className="rounded border border-dashed border-border p-3 text-sm" data-testid="dry-run-result">
            <div className="font-semibold">Unsigned genesis (dry run, example input)</div>
            <p className="mt-1 text-text-2">
              {dry.outputs} outputs: 1 state NFT into the covenant, {seats} member NFTs, the params OP_RETURN, change. <span className="num">{dry.size} bytes · {dry.fee} sats fee</span>.
            </p>
            <p className="num mt-1 break-all text-[12px]">covenant {dry.covenant}</p>
            <details className="mt-1"><summary className="cursor-pointer text-[12px] text-text-2">raw hex</summary><p className="num break-all text-[11px] text-text-2">{dry.hex}</p></details>
          </div>
        )}
      </form>
      <aside className="h-fit rounded-[var(--radius)] border border-border-subtle bg-surface p-4 text-sm" data-testid="judge-path">
        <h2 className="font-semibold">Judge path · 30 seconds</h2>
        <ol className="mt-2 grid list-decimal gap-1.5 pl-5 text-text-2">
          <li>Tap <b className="text-text">Connect wallet</b> and scan with Selene (WizardConnect).</li>
          <li>Tap <b className="text-text">Use my address for every seat</b>.</li>
          <li>Pick {mode === 'token' ? ASSET_SYMBOL : 'BCH'}, keep the amount small, tap <b className="text-text">Create circle</b> and approve.</li>
          <li>On the circle page tap <b className="text-text">Contribute</b> for each seat. That is a real {NETWORK} transaction from your own wallet, spending into a covenant only the turn seat can empty.</li>
        </ol>
        <p className="mt-2 text-[12px] text-text-2">Cost: one genesis (~{NETWORK === 'mainnet' ? 'a cent' : 'free test coins'}) plus ~1,300 bytes per contribution at 1 sat/byte.</p>
      </aside>
    </div>
  );
}
