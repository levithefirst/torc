import { MockNetworkProvider, SignatureTemplate, randomUtxo, type SpendableUtxo } from 'cashscript';
import { binToHex, generatePrivateKey } from '@bitauth/libauth';
import { keyInfo, type KeyInfo } from '../../src/lib/torc/keys';
import { buildGenesis, buildContribute, buildClaim, memberNfts, type WalletSide } from '../../src/lib/torc/txs';
import { circleContract, type CircleParams, type AssetMode } from '../../src/lib/torc/circle';
import { decodeState, type CircleState } from '../../src/lib/torc/state';

export const NET = 'chipnet' as const;
export const ASSET = binToHex(generatePrivateKey()); // random 32-byte "tPUSD" category for tests
export const T0 = 1_763_000_000; // a fixed genesis time

export interface Member extends KeyInfo {
  sig: SignatureTemplate;
}

export function newMember(): Member {
  const k = keyInfo(generatePrivateKey(), NET);
  return { ...k, sig: new SignatureTemplate(k.privateKey) };
}

export async function wallet(provider: MockNetworkProvider, m: Member): Promise<WalletSide> {
  return { utxos: await provider.getUtxos(m.address), unlocker: m.sig.unlockP2PKH(), address: m.address };
}

export function fund(provider: MockNetworkProvider, m: Member, opts: { sats?: bigint; tokens?: bigint; vout0?: boolean } = {}) {
  provider.addUtxo(m.address, randomUtxo({ satoshis: opts.sats ?? 100_000n, vout: opts.vout0 ? 0 : 1 }));
  if (opts.tokens) provider.addUtxo(m.address, randomUtxo({ satoshis: 1000n, vout: 2, token: { category: ASSET, amount: opts.tokens } }));
}

export interface Circle {
  provider: MockNetworkProvider;
  params: CircleParams;
  members: Member[];
  creator: Member;
  contract: ReturnType<typeof circleContract>;
  genesisTxid: string;
}

export async function setupCircle(seats: number, mode: AssetMode = 'token', contribution = 100_000n, period = 86_400): Promise<Circle> {
  const provider = new MockNetworkProvider();
  const creator = newMember();
  fund(provider, creator, { sats: 1_000_000n, vout0: true });
  const members = Array.from({ length: seats }, () => newMember());
  for (const m of members) fund(provider, m, { sats: 200_000n, tokens: mode === "token" ? contribution * BigInt(seats) : undefined });
  const g = buildGenesis({
    provider,
    params: { network: NET, mode, assetCategory: mode === 'token' ? ASSET : undefined, contribution, seats, period },
    wallet: await wallet(provider, creator),
    members: members.map((m) => m.address),
    startTime: T0,
  });
  const tx = await g.builder.send();
  return { provider, params: g.params, members, creator, contract: g.contract, genesisTxid: tx.txid };
}

export async function stateOf(c: Circle): Promise<CircleState> {
  const u = (await c.contract.getUtxos()).find((x) => x.token?.nft?.capability === 'mutable')!;
  return decodeState(u.token!.nft!.commitment);
}

export async function nftOf(c: Circle, m: { address: string }): Promise<SpendableUtxo> {
  const n = memberNfts(c.params, await c.provider.getUtxos(m.address));
  if (!n[0]) throw new Error('member has no NFT');
  return n[0];
}

export async function contribute(c: Circle, m: Member) {
  const r = buildContribute({
    provider: c.provider,
    params: c.params,
    contract: c.contract,
    contractUtxos: await c.contract.getUtxos(),
    wallet: await wallet(c.provider, m),
    memberNft: await nftOf(c, m),
  });
  return r.builder.send();
}

export async function claim(c: Circle, m: Member, locktime: number) {
  const r = buildClaim({
    provider: c.provider,
    params: c.params,
    contract: c.contract,
    contractUtxos: await c.contract.getUtxos(),
    wallet: await wallet(c.provider, m),
    memberNft: await nftOf(c, m),
    locktime,
  });
  return r.builder.send();
}

export async function tokenBalance(c: Circle, address: string): Promise<bigint> {
  return (await c.provider.getUtxos(address))
    .filter((u) => u.token?.category === ASSET && !u.token.nft)
    .reduce((a, u) => a + u.token!.amount, 0n);
}
