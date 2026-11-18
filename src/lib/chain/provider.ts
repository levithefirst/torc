// A cashscript NetworkProvider over any ElectrumCall (direct WSS or HTTPS relay),
// plus the chain reads the app needs (history, headers, median-time-past).
import type { NetworkProvider, SpendableUtxo } from 'cashscript';
import { binToHex, hexToBin, sha256, cashAddressToLockingBytecode, decodeTransaction, hash256 } from '@bitauth/libauth';
import type { ElectrumCall } from './electrum';
import type { TorcNetwork } from '../torc/circle';

export const scripthashOf = (lockingHex: string) => binToHex(sha256.hash(hexToBin(lockingHex)).reverse());

interface RawUtxo {
  tx_hash: string;
  tx_pos: number;
  value: number | string;
  height: number;
  token_data?: { category: string; amount: string | number; nft?: { capability: 'none' | 'mutable' | 'minting'; commitment: string } };
}

export interface HistoryItem { tx_hash: string; height: number; fee?: number }

export class TorcProvider implements NetworkProvider {
  network: 'mainnet' | 'chipnet';
  constructor(public call: ElectrumCall, network: TorcNetwork) {
    this.network = network;
  }

  async getUtxos(address: string): Promise<SpendableUtxo[]> {
    const r = cashAddressToLockingBytecode(address);
    if (typeof r === 'string') throw new Error(r);
    return this.getUtxosForLockingBytecode(binToHex(r.bytecode));
  }

  async getUtxosForLockingBytecode(lockingBytecode: Uint8Array | string): Promise<SpendableUtxo[] & { height?: number }[]> {
    const hex = typeof lockingBytecode === 'string' ? lockingBytecode : binToHex(lockingBytecode);
    const res = (await this.call('blockchain.scripthash.listunspent', scripthashOf(hex), 'include_tokens')) as RawUtxo[];
    return res.map((u) => ({
      txid: u.tx_hash,
      vout: u.tx_pos,
      satoshis: BigInt(u.value),
      lockingBytecode: hex,
      height: u.height,
      token: u.token_data ? { ...u.token_data, amount: BigInt(u.token_data.amount) } : undefined,
    }));
  }

  async getBlockHeight(): Promise<number> {
    const { height } = (await this.call('blockchain.headers.get_tip')) as { height: number };
    return height;
  }

  async getRawTransaction(txid: string): Promise<string> {
    return (await this.call('blockchain.transaction.get', txid)) as string;
  }

  async sendRawTransaction(txHex: string): Promise<string> {
    return (await this.call('blockchain.transaction.broadcast', txHex)) as string;
  }

  async getHistory(lockingHex: string): Promise<HistoryItem[]> {
    return (await this.call('blockchain.scripthash.get_history', scripthashOf(lockingHex))) as HistoryItem[];
  }

  /** Median-time-past of the tip: the clock timestamp locktimes are checked against. */
  async medianTimePast(): Promise<{ height: number; mtp: number; tipTime: number }> {
    const tip = (await this.call('blockchain.headers.get_tip')) as { height: number; hex: string };
    const r = (await this.call('blockchain.block.headers', tip.height - 10, 11)) as { hex: string; count: number };
    const bytes = hexToBin(r.hex);
    const times: number[] = [];
    for (let i = 0; i < r.count; i++) times.push(new DataView(bytes.buffer, bytes.byteOffset + i * 80 + 68, 4).getUint32(0, true));
    const tipTime = times[times.length - 1]!;
    times.sort((a, b) => a - b);
    return { height: tip.height, mtp: times[Math.floor(times.length / 2)]!, tipTime };
  }
}

export function txidOf(txHex: string): string {
  return binToHex(hash256(hexToBin(txHex)).reverse());
}

export function decodeTx(txHex: string) {
  const t = decodeTransaction(hexToBin(txHex));
  if (typeof t === 'string') throw new Error(t);
  return t;
}
