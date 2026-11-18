// Network configuration. NEXT_PUBLIC_* values are inlined at build time for the browser.
import type { TorcNetwork } from '../torc/circle';

export const NETWORK: TorcNetwork = (process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? 'mainnet' : 'chipnet');

const DEFAULT_ELECTRUM: Record<TorcNetwork, string[]> = {
  chipnet: ['chipnet.bch.ninja', 'chipnet.imaginary.cash'],
  mainnet: ['bch.imaginary.cash', 'electrum.imaginary.cash', 'bch.loping.net'],
};

/** Electrum WSS hosts in failover order (comma-separated env, hostnames or host:port). */
export function electrumHosts(network: TorcNetwork = NETWORK): string[] {
  const env = process.env.NEXT_PUBLIC_ELECTRUM_WSS;
  if (env && network === NETWORK) return env.split(',').map((s) => s.trim().replace(/^wss:\/\//, '')).filter(Boolean);
  return DEFAULT_ELECTRUM[network];
}

const DEFAULT_EXPLORER: Record<TorcNetwork, string> = {
  chipnet: 'https://chipnet.imaginary.cash/tx/',
  mainnet: 'https://explorer.bitcoinunlimited.info/tx/',
};
export function explorerTx(txid: string, network: TorcNetwork = NETWORK): string {
  const base = (network === NETWORK && process.env.NEXT_PUBLIC_EXPLORER_TX) || DEFAULT_EXPLORER[network];
  return base + txid;
}

export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL || 'https://github.com/levithefirst/torc';
export const DECK_URL = process.env.NEXT_PUBLIC_DECK_URL || '/deck';
export const DONATION_ADDRESS = process.env.NEXT_PUBLIC_DONATION_ADDRESS || '';
