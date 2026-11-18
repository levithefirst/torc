// Transaction builders shared by tests, CLI scripts, the demo API and the browser.
// The covenant inputs are unlocked by the contract; every other input is a plain P2PKH
// input unlocked by `wallet.unlocker` (a SignatureTemplate on the server, a placeholder
// that the user's wallet fills in when signing over WizardConnect).
import {
  TransactionBuilder,
  type Contract,
  type NetworkProvider,
  type SpendableUtxo,
  type Unlocker,
  type Output,
} from 'cashscript';
import { hexToBin } from '@bitauth/libauth';
import { TOKEN_DUST, FEE_RATE, circleContract, type CircleParams } from './circle';
import { decodeMember, decodeState, encodeMember, encodeState, hasPaid, allPaid, turnSeat, type CircleState } from './state';
import { toTokenAddress, addressToLockingHex } from './address';

export interface WalletSide {
  /** Spendable P2PKH UTXOs belonging to the signer (BCH and token UTXOs). */
  utxos: SpendableUtxo[];
  /** Unlocks wallet inputs: one unlocker for all, or one per UTXO (HD wallets span many addresses). */
  unlocker: Unlocker | ((utxo: SpendableUtxo) => Unlocker);
  /** Signer's address (any form; converted to token-aware for token outputs). */
  address: string;
}

/** Headroom for the miner fee when picking BCH inputs; real fee is computed by the builder. */
const FEE_HEADROOM = 3000n;

export class TorcError extends Error {}

export function findState(params: CircleParams, contractUtxos: SpendableUtxo[]): SpendableUtxo {
  const s = contractUtxos.filter(
    (u) => u.token?.category === params.circleCategory && u.token.nft?.capability === 'mutable',
  );
  if (s.length !== 1) throw new TorcError(`expected exactly one state NFT at the covenant, found ${s.length}`);
  return s[0]!;
}

export function isContributionUtxo(params: CircleParams, u: SpendableUtxo): boolean {
  if (params.mode === 'token') {
    return !!u.token && u.token.category === params.assetCategory && !u.token.nft && u.token.amount === params.contribution;
  }
  return !u.token && u.satoshis === params.contribution;
}

export function findContributions(params: CircleParams, contractUtxos: SpendableUtxo[]): SpendableUtxo[] {
  return contractUtxos
    .filter((u) => isContributionUtxo(params, u))
    .sort((a, b) => (a.txid === b.txid ? a.vout - b.vout : a.txid < b.txid ? -1 : 1));
}

export function memberNfts(params: CircleParams, utxos: SpendableUtxo[]): SpendableUtxo[] {
  return utxos.filter((u) => u.token?.category === params.circleCategory && u.token.nft?.capability === 'none');
}

const plainUtxos = (utxos: SpendableUtxo[]) => utxos.filter((u) => !u.token).sort((a, b) => Number(b.satoshis - a.satoshis));

/** Add plain BCH inputs until `need` sats are covered (on top of what's already in). */
function addBchFunding(tb: TransactionBuilder, wallet: WalletSide, need: bigint, exclude: Set<string>): void {
  let have = 0n;
  for (const u of plainUtxos(wallet.utxos)) {
    if (have >= need) break;
    if (exclude.has(`${u.txid}:${u.vout}`)) continue;
    tb.addInput(u, unlockFor(wallet, u));
    exclude.add(`${u.txid}:${u.vout}`);
    have += u.satoshis;
  }
  if (have < need) throw new TorcError(`not enough BCH: need ${need} sats more, wallet has ${have}`);
}

export const unlockFor = (w: WalletSide, u: SpendableUtxo): Unlocker =>
  typeof w.unlocker === 'function' ? w.unlocker(u) : w.unlocker;

const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n);

// ---------------------------------------------------------------- genesis

export interface GenesisResult {
  builder: TransactionBuilder;
  params: CircleParams;
  contract: Contract;
  state: CircleState;
}

/** Pick a plain UTXO at vout 0: its txid becomes the circle's category. */
export function pickGenesisInput(wallet: WalletSide): SpendableUtxo | undefined {
  return plainUtxos(wallet.utxos).find((u) => u.vout === 0 && u.satoshis >= 10_000n);
}

/**
 * Build a self-send that creates a vout-0 UTXO, for wallets that have none.
 */
export function buildPrepare(provider: NetworkProvider, wallet: WalletSide, amount: bigint): TransactionBuilder {
  const tb = new TransactionBuilder({ provider });
  addBchFunding(tb, wallet, amount + FEE_HEADROOM, new Set());
  tb.addOutput({ to: wallet.address, amount });
  tb.addBchChangeOutputIfNeeded({ to: wallet.address, feeRate: FEE_RATE });
  return tb;
}

export function buildGenesis(opts: {
  provider: NetworkProvider;
  params: Omit<CircleParams, 'circleCategory'>;
  wallet: WalletSide;
  members: string[]; // one address per seat, in seat order
  startTime: number; // unix seconds; round 0 payout opens at startTime + period
}): GenesisResult {
  const { provider, wallet, members } = opts;
  if (members.length !== opts.params.seats) throw new TorcError(`need ${opts.params.seats} member addresses`);
  const first = pickGenesisInput(wallet);
  if (!first) throw new TorcError('wallet has no plain UTXO at output index 0 (needed to mint the circle category)');
  const params: CircleParams = { ...opts.params, circleCategory: first.txid };
  const contract = circleContract(params, provider);
  const state: CircleState = { round: 0, roundStart: opts.startTime, paidMask: 0 };

  const tb = new TransactionBuilder({ provider });
  tb.addInput(first, unlockFor(wallet, first));
  const outputs: Output[] = [
    {
      to: contract.tokenAddress,
      amount: TOKEN_DUST,
      token: { category: params.circleCategory, amount: 0n, nft: { capability: 'mutable', commitment: encodeState(state) } },
    },
    ...members.map((m, i) => ({
      to: toTokenAddress(m),
      amount: TOKEN_DUST,
      token: { category: params.circleCategory, amount: 0n, nft: { capability: 'none' as const, commitment: encodeMember(i) } },
    })),
  ];
  tb.addOutputs(outputs);
  // Self-describing genesis: the circle's constructor params in an OP_RETURN, so anyone can
  // rebuild the covenant from the chain (and check it hashes to the address).
  tb.addOpReturnOutput(encodeParamsOpReturn(params));
  const need = sum(outputs.map((o) => o.amount)) + FEE_HEADROOM - first.satoshis;
  if (need > 0n) addBchFunding(tb, wallet, need, new Set([`${first.txid}:${first.vout}`]));
  tb.addBchChangeOutputIfNeeded({ to: wallet.address, feeRate: FEE_RATE });
  return { builder: tb, params, contract, state };
}

export const OP_RETURN_TAG = 'TORC';

export function encodeParamsOpReturn(p: CircleParams): string[] {
  const n = (v: bigint | number, bytes: number) => {
    const b = new Uint8Array(bytes);
    let x = BigInt(v);
    for (let i = 0; i < bytes; i++) { b[i] = Number(x & 0xffn); x >>= 8n; }
    return '0x' + Array.from(b, (y) => y.toString(16).padStart(2, '0')).join('');
  };
  return [OP_RETURN_TAG, '0x01', p.mode === 'token' ? '0x01' : '0x00', '0x' + (p.mode === 'token' ? p.assetCategory! : '00'), n(p.contribution, 8), n(p.seats, 1), n(p.period, 4)];
}

/** Parse the genesis OP_RETURN chunks (as raw byte arrays) back into params. */
export function decodeParamsOpReturn(chunks: Uint8Array[], circleCategory: string, network: CircleParams['network']): CircleParams | null {
  const td = new TextDecoder();
  if (chunks.length !== 7 || td.decode(chunks[0]) !== OP_RETURN_TAG || chunks[1]![0] !== 1) return null;
  const le = (b: Uint8Array) => b.reduceRight((a, x) => (a << 8n) | BigInt(x), 0n);
  const hex = (b: Uint8Array) => Array.from(b, (y) => y.toString(16).padStart(2, '0')).join('');
  const mode = chunks[2]![0] === 1 ? 'token' : 'bch';
  return {
    network, mode, circleCategory,
    assetCategory: mode === 'token' ? hex(chunks[3]!) : undefined,
    contribution: le(chunks[4]!), seats: Number(le(chunks[5]!)), period: Number(le(chunks[6]!)),
  };
}

// ---------------------------------------------------------------- contribute

export function buildContribute(opts: {
  provider: NetworkProvider;
  params: CircleParams;
  contract: Contract;
  contractUtxos: SpendableUtxo[];
  wallet: WalletSide;
  memberNft: SpendableUtxo;
}): { builder: TransactionBuilder; seat: number; next: CircleState } {
  const { provider, params, contract, wallet, memberNft } = opts;
  const stateUtxo = findState(params, opts.contractUtxos);
  const state = decodeState(stateUtxo.token!.nft!.commitment);
  const seat = decodeMember(memberNft.token!.nft!.commitment);
  if (seat >= params.seats) throw new TorcError('seat out of range');
  if (hasPaid(state, seat)) throw new TorcError(`seat ${seat} already paid this round`);
  const next: CircleState = { ...state, paidMask: state.paidMask | (1 << seat) };

  const tb = new TransactionBuilder({ provider });
  tb.addInput(stateUtxo, contract.unlock.contribute!());
  tb.addInput(memberNft, unlockFor(wallet, memberNft));
  const used = new Set([`${memberNft.txid}:${memberNft.vout}`]);

  const memberLock = hexToBin(memberNft.lockingBytecode);
  const contributionOut: Output =
    params.mode === 'token'
      ? { to: contract.tokenAddress, amount: TOKEN_DUST, token: { category: params.assetCategory!, amount: params.contribution } }
      : { to: contract.address, amount: params.contribution };
  tb.addOutputs([
    { to: contract.tokenAddress, amount: stateUtxo.satoshis, token: { category: params.circleCategory, amount: 0n, nft: { capability: 'mutable', commitment: encodeState(next) } } },
    contributionOut,
    { to: memberLock, amount: memberNft.satoshis, token: memberNft.token! },
  ]);

  let inSats = memberNft.satoshis;
  if (params.mode === 'token') {
    // Fungible token inputs of the asset, largest first.
    const ft = wallet.utxos
      .filter((u) => !!u.token && u.token.category === params.assetCategory && !u.token.nft)
      .sort((a, b) => Number(b.token!.amount - a.token!.amount));
    let have = 0n;
    for (const u of ft) {
      if (have >= params.contribution) break;
      tb.addInput(u, unlockFor(wallet, u));
      used.add(`${u.txid}:${u.vout}`);
      have += u.token!.amount;
      inSats += u.satoshis;
    }
    if (have < params.contribution) throw new TorcError(`not enough tokens: need ${params.contribution}, have ${have}`);
    if (have > params.contribution) {
      tb.addOutput({ to: toTokenAddress(wallet.address), amount: TOKEN_DUST, token: { category: params.assetCategory!, amount: have - params.contribution } });
      inSats -= TOKEN_DUST;
    }
  }
  const need = contributionOut.amount + FEE_HEADROOM - inSats;
  if (need > 0n) addBchFunding(tb, wallet, need, used);
  tb.addBchChangeOutputIfNeeded({ to: wallet.address, feeRate: FEE_RATE });
  return { builder: tb, seat, next };
}

// ---------------------------------------------------------------- claim

export function buildClaim(opts: {
  provider: NetworkProvider;
  params: CircleParams;
  contract: Contract;
  contractUtxos: SpendableUtxo[];
  wallet: WalletSide;
  memberNft: SpendableUtxo;
  locktime: number; // must be >= roundStart + period and <= current median-time-past
  /** Skip local "is it open yet" checks (tests use this to prove the covenant rejects). */
  unsafeSkipChecks?: boolean;
}): { builder: TransactionBuilder; seat: number; next: CircleState } {
  const { provider, params, contract, wallet, memberNft, locktime } = opts;
  const stateUtxo = findState(params, opts.contractUtxos);
  const state = decodeState(stateUtxo.token!.nft!.commitment);
  const seat = decodeMember(memberNft.token!.nft!.commitment);
  if (!opts.unsafeSkipChecks) {
    if (seat !== turnSeat(state, params.seats)) throw new TorcError(`not seat ${seat}'s turn`);
    if (!allPaid(state, params.seats)) throw new TorcError('not every seat has paid');
    if (locktime < state.roundStart + params.period) throw new TorcError('payout not open yet');
  }
  const contributions = findContributions(params, opts.contractUtxos).slice(0, params.seats);
  if (contributions.length < params.seats && !opts.unsafeSkipChecks) throw new TorcError('missing contribution UTXOs');
  const next: CircleState = { round: state.round + 1, roundStart: locktime, paidMask: 0 };

  const tb = new TransactionBuilder({ provider });
  tb.addInput(stateUtxo, contract.unlock.claim!());
  tb.addInput(memberNft, unlockFor(wallet, memberNft));
  for (const c of contributions) tb.addInput(c, contract.unlock.pool!());

  const memberLock = hexToBin(memberNft.lockingBytecode);
  const pot = params.contribution * BigInt(params.seats);
  tb.addOutputs([
    { to: contract.tokenAddress, amount: stateUtxo.satoshis, token: { category: params.circleCategory, amount: 0n, nft: { capability: 'mutable', commitment: encodeState(next) } } },
    params.mode === 'token'
      ? { to: memberLock, amount: TOKEN_DUST, token: { category: params.assetCategory!, amount: pot } }
      : { to: memberLock, amount: pot },
    { to: memberLock, amount: memberNft.satoshis, token: memberNft.token! },
  ]);
  const inSats = sum(contributions.map((c) => c.satoshis)) + memberNft.satoshis;
  const outSats = memberNft.satoshis + (params.mode === 'token' ? TOKEN_DUST : pot);
  // Claim txs carry the full redeem script per covenant input, so budget ~600 B per input.
  const need = outSats + BigInt(600 * (params.seats + 1)) + 1000n - inSats;
  if (need > 0n) addBchFunding(tb, wallet, need, new Set([`${memberNft.txid}:${memberNft.vout}`]));
  tb.setLocktime(locktime);
  tb.addBchChangeOutputIfNeeded({ to: wallet.address, feeRate: FEE_RATE });
  return { builder: tb, seat, next };
}

export { addressToLockingHex };
