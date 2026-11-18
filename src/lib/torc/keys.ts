// Throwaway key helpers (scripts + server demo seats only; never a user's wallet).
import {
  generatePrivateKey,
  secp256k1,
  hash160,
  encodeCashAddress,
  encodePrivateKeyWif,
  decodePrivateKeyWif,
  binToHex,
} from '@bitauth/libauth';
import type { TorcNetwork } from './circle';
import { prefixFor } from './address';

export interface KeyInfo {
  privateKey: Uint8Array;
  address: string; // q / bchtest:q
  tokenAddress: string; // z / bchtest:z
  lockingHex: string;
}

export function keyInfo(privateKey: Uint8Array, network: TorcNetwork): KeyInfo {
  const pub = secp256k1.derivePublicKeyCompressed(privateKey);
  if (typeof pub === 'string') throw new Error(pub);
  const pkh = hash160(pub);
  const prefix = prefixFor(network);
  return {
    privateKey,
    address: encodeCashAddress({ payload: pkh, prefix, type: 'p2pkh' }).address,
    tokenAddress: encodeCashAddress({ payload: pkh, prefix, type: 'p2pkhWithTokens' }).address,
    lockingHex: '76a914' + binToHex(pkh) + '88ac',
  };
}

export const newPrivateKey = () => generatePrivateKey();

export function toWif(privateKey: Uint8Array, network: TorcNetwork): string {
  return encodePrivateKeyWif(privateKey, network === 'mainnet' ? 'mainnet' : 'testnet');
}

export function fromWif(wif: string): Uint8Array {
  const d = decodePrivateKeyWif(wif.trim());
  if (typeof d === 'string') throw new Error('invalid WIF');
  return d.privateKey;
}
