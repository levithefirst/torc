// Throwaway key helpers (scripts + server demo seats only; never a user's wallet).
import {
  generatePrivateKey,
  secp256k1,
  hash160,
  encodeCashAddress,
  encodePrivateKeyWif,
  decodePrivateKeyWif,
  binToHex,
  hmacSha256,
  validateSecp256k1PrivateKey,
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

/**
 * Demo seat keys derived from a server-only seed: key_i = HMAC-SHA256(seed, "torc-demo-seat|<network>|<i>").
 * The seed lives only in the deployment's encrypted env, so the keys exist nowhere else.
 */
export function deriveDemoSeatKey(seed: string, network: TorcNetwork, index: number): Uint8Array {
  if (seed.length < 32) throw new Error('DEMO_SEED must be at least 32 characters');
  const enc = new TextEncoder();
  for (let n = 0; n < 16; n++) {
    const k = hmacSha256(enc.encode(seed), enc.encode(`torc-demo-seat|${network}|${index}|${n}`));
    if (validateSecp256k1PrivateKey(k)) return k;
  }
  throw new Error('could not derive a valid key');
}
