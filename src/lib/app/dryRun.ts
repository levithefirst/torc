// Wallet-free dry run of a circle genesis: a local mock chain with one example input (not a real
// coin), so /new can show the exact unsigned genesis a wallet would be asked to sign.
import { MockNetworkProvider, Network, randomUtxo, placeholderP2PKHUnlocker } from 'cashscript';
import { encodeCashAddress } from '@bitauth/libauth';
import { buildGenesis } from '../torc/txs';
import { isValidAddress } from '../torc/address';
import type { CircleParams, TorcNetwork } from '../torc/circle';

export interface DryRun { size: number; fee: number; covenant: string; outputs: number; hex: string }

/** Deterministic, obviously-fake example P2PKH address for seat i. */
export function exampleAddress(i: number, network: TorcNetwork) {
  return encodeCashAddress({ payload: new Uint8Array(20).fill(i + 1), prefix: network === 'mainnet' ? 'bitcoincash' : 'bchtest', type: 'p2pkh' }).address;
}

export function dryRunGenesis(params: Omit<CircleParams, 'circleCategory'>, members: string[], nowSec = Math.floor(Date.now() / 1000)): DryRun {
  const provider = new MockNetworkProvider();
  // The mock defaults to 'mocknet' (bchtest: prefix), which rejects every mainnet address.
  provider.network = params.network === 'mainnet' ? Network.MAINNET : Network.CHIPNET;
  const addrs = members.map((m, i) => (isValidAddress(m, params.network) ? m.trim() : null) ?? exampleAddress(i, params.network));
  const payer = addrs[0]!;
  const u = provider.addUtxo(payer, randomUtxo({ vout: 0, satoshis: 100_000n }));
  const g = buildGenesis({ provider, params, wallet: { utxos: [u], unlocker: placeholderP2PKHUnlocker(payer), address: payer }, members: addrs, startTime: nowSec });
  const hex = g.builder.build();
  return { size: Number(g.builder.getTransactionSize()), fee: Number(g.builder.calculateTransactionFee().feeSats), covenant: g.contract.tokenAddress, outputs: g.builder.outputs.length, hex };
}
