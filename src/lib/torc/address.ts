import { decodeCashAddress, encodeCashAddress, cashAddressToLockingBytecode, lockingBytecodeToCashAddress, binToHex, hexToBin } from '@bitauth/libauth';
import type { TorcNetwork } from './circle';

export const prefixFor = (n: TorcNetwork) => (n === 'mainnet' ? 'bitcoincash' : 'bchtest');

/** Convert any P2PKH / P2SH cashaddr to its token-aware (z / r) form. */
export function toTokenAddress(address: string): string {
  const d = decodeCashAddress(address);
  if (typeof d === 'string') throw new Error(`bad address: ${d}`);
  const type = d.type === 'p2pkh' || d.type === 'p2pkhWithTokens' ? 'p2pkhWithTokens' : 'p2shWithTokens';
  return encodeCashAddress({ payload: d.payload, prefix: d.prefix as 'bitcoincash' | 'bchtest', type }).address;
}

export function isValidAddress(address: string, network: TorcNetwork): boolean {
  const d = decodeCashAddress(address.trim());
  return typeof d !== 'string' && d.prefix === prefixFor(network);
}

export function addressToLockingHex(address: string): string {
  const r = cashAddressToLockingBytecode(address);
  if (typeof r === 'string') throw new Error(r);
  return binToHex(r.bytecode);
}

export function lockingHexToTokenAddress(hex: string, network: TorcNetwork): string {
  const r = lockingBytecodeToCashAddress({ bytecode: hexToBin(hex), prefix: prefixFor(network), tokenSupport: true });
  if (typeof r === 'string') throw new Error(r);
  return r.address;
}
