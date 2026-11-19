// Reads a circle from the chain: current state, pot, and a classified activity feed.
// Isomorphic: runs on the server (SSR) and in the browser (live updates) over any TorcProvider.
import { binToHex } from '@bitauth/libauth';
import type { TorcProvider } from '../chain/provider';
import { decodeTx } from '../chain/provider';
import { circleContract, paramsToJson, type CircleParams, type CircleParamsJson } from './circle';
import { decodeMember, decodeState, nextAction, paidCount, turnSeat, type CircleState, type NextAction } from './state';
import { findState, findContributions, decodeParamsOpReturn } from './txs';

export type FeedKind = 'genesis' | 'contribute' | 'claim' | 'other';
export interface FeedRow {
  txid: string;
  kind: FeedKind;
  seat?: number;
  round?: number;
  amount?: string; // base units (tokens or sats)
  step?: number; // position in the circle's state chain (orders unconfirmed txs)
  height: number; // > 0 confirmed in that block; <= 0 mempool (SEEN 0-conf)
}

export interface Snapshot {
  params: CircleParamsJson;
  address: string;
  tokenAddress: string;
  lockingBytecode: string;
  state: CircleState;
  next: NextAction;
  turnSeat: number;
  paid: number;
  potUnits: string; // amount currently in the ring (contribution UTXOs)
  tipHeight: number;
  mtp: number; // chain clock (median-time-past), unix seconds
  asOf: number; // ms, when this snapshot was read
  feed: FeedRow[];
  historyCount?: number; // every tx that ever touched the covenant (the feed shows the latest)
}

type DecodedTx = ReturnType<typeof decodeTx>;
const txCache = new Map<string, DecodedTx>();

async function getTx(p: TorcProvider, txid: string): Promise<DecodedTx> {
  let t = txCache.get(txid);
  if (!t) {
    t = decodeTx(await p.getRawTransaction(txid));
    txCache.set(txid, t);
  }
  return t;
}

export function classify(t: DecodedTx, params: CircleParams, covenantLock: string): Omit<FeedRow, 'txid' | 'height'> {
  const cat = params.circleCategory;
  const isCat = (o: DecodedTx['outputs'][number]) => o.token && binToHex(o.token.category) === cat;
  const stateIdx = t.outputs.findIndex((o) => isCat(o) && o.token!.nft?.capability === 'mutable');
  if (stateIdx < 0) return { kind: 'other' };
  const st = decodeState(binToHex(t.outputs[stateIdx]!.token!.nft!.commitment));
  const members = t.outputs.filter((o) => isCat(o) && o.token!.nft?.capability === 'none');
  if (members.length >= 3 && st.round === 0 && st.paidMask === 0 && stateIdx === 0 && !t.outputs[1]?.token?.nft?.capability?.startsWith('m') && members.length === params.seats) {
    // A genesis mints every member NFT at once; contribute/claim txs carry exactly one.
    return { kind: 'genesis', round: 0, step: 0 };
  }
  const o1 = t.outputs[1];
  const o2 = t.outputs[2];
  const seat = o2 && isCat(o2) && o2.token!.nft ? decodeMember(binToHex(o2.token!.nft.commitment)) : undefined;
  if (o1 && binToHex(o1.lockingBytecode) === covenantLock) {
    const n = [0, 1, 2, 3, 4].filter((i) => (st.paidMask >> i) & 1).length;
    return { kind: 'contribute', seat, round: st.round, amount: params.contribution.toString(), step: st.round * 8 + n };
  }
  if (st.paidMask === 0 && st.round > 0) {
    return { kind: 'claim', seat, round: st.round - 1, amount: (params.contribution * BigInt(params.seats)).toString(), step: st.round * 8 };
  }
  return { kind: 'other' };
}

export async function readSnapshot(p: TorcProvider, params: CircleParams, opts: { feedLimit?: number } = {}): Promise<Snapshot> {
  const contract = circleContract(params, p);
  const [utxos, history, clock] = await Promise.all([
    contract.getUtxos(),
    p.getHistory(contract.lockingBytecode),
    p.medianTimePast(),
  ]);
  const stateUtxo = findState(params, utxos);
  const state = decodeState(stateUtxo.token!.nft!.commitment);
  const pot = findContributions(params, utxos).reduce((a, u) => a + (params.mode === 'token' ? u.token!.amount : u.satoshis), 0n);

  // Newest first: mempool entries (height <= 0) then by height desc.
  const ordered = [...history].sort((a, b) => {
    const ha = a.height <= 0 ? Infinity : a.height;
    const hb = b.height <= 0 ? Infinity : b.height;
    return hb - ha;
  });
  const recent = ordered.slice(0, opts.feedLimit ?? 24);
  const txs = await Promise.all(recent.map((h) => getTx(p, h.tx_hash)));
  const feed: FeedRow[] = recent.map((h, i) => ({ txid: h.tx_hash, height: h.height, ...classify(txs[i]!, params, contract.lockingBytecode) }));
  // Within the mempool, order contributions/claims by the state they produced (later state first).
  feed.sort((a, b) => {
    const ha = a.height <= 0 ? Infinity : a.height;
    const hb = b.height <= 0 ? Infinity : b.height;
    if (ha !== hb) return hb - ha;
    return (b.step ?? 0) - (a.step ?? 0);
  });

  return {
    params: paramsToJson(params),
    address: contract.address,
    tokenAddress: contract.tokenAddress,
    lockingBytecode: contract.lockingBytecode,
    state,
    next: nextAction(state, params.seats, params.period),
    turnSeat: turnSeat(state, params.seats),
    paid: paidCount(state, params.seats),
    potUnits: pot.toString(),
    tipHeight: clock.height,
    mtp: clock.mtp,
    asOf: Date.now(),
    feed: feed.filter((r) => r.kind !== 'other'),
    historyCount: history.length,
  };
}

/** Rebuild a circle's params from its covenant address alone (via the genesis OP_RETURN). */
export async function discoverParams(p: TorcProvider, address: string): Promise<CircleParams | null> {
  const { cashAddressToLockingBytecode, decodeAuthenticationInstructions } = await import('@bitauth/libauth');
  const lock = cashAddressToLockingBytecode(address);
  if (typeof lock === 'string') return null;
  const history = await p.getHistory(binToHex(lock.bytecode));
  for (const h of history) {
    const t = await getTx(p, h.tx_hash);
    for (const o of t.outputs) {
      if (o.lockingBytecode[0] !== 0x6a) continue;
      const ins = decodeAuthenticationInstructions(o.lockingBytecode.slice(1)) as { data?: Uint8Array }[];
      const chunks = ins.map((x) => x.data ?? new Uint8Array());
      const category = binToHex(t.inputs[0]!.outpointTransactionHash);
      const params = decodeParamsOpReturn(chunks, category, p.network === 'mainnet' ? 'mainnet' : 'chipnet');
      if (!params) continue;
      const c = circleContract(params, p);
      if (c.lockingBytecode === binToHex(lock.bytecode)) return params;
    }
  }
  return null;
}
