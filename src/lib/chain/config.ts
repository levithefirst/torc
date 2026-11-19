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

// Explorers per network. The primary is the one we have seen up most reliably; the fallback is
// shown next to it so a dead explorer never leaves a judge without a way to check a tx.
const DEFAULT_EXPLORER: Record<TorcNetwork, { tx: string; address: string; name: string }> = {
  chipnet: { tx: 'https://cbch.loping.net/tx/', address: 'https://cbch.loping.net/address/', name: 'cbch.loping.net' },
  mainnet: { tx: 'https://explorer.bitcoinunlimited.info/tx/', address: 'https://explorer.bitcoinunlimited.info/address/', name: 'explorer.bitcoinunlimited.info' },
};
const FALLBACK_EXPLORER: Record<TorcNetwork, { tx: string; name: string }> = {
  chipnet: { tx: 'https://chipnet.imaginary.cash/tx/', name: 'chipnet.imaginary.cash' },
  mainnet: { tx: 'https://3xpl.com/bitcoin-cash/transaction/', name: '3xpl.com' },
};
export function explorerTx(txid: string, network: TorcNetwork = NETWORK): string {
  const base = (network === NETWORK && process.env.NEXT_PUBLIC_EXPLORER_TX) || DEFAULT_EXPLORER[network].tx;
  return base + txid;
}
/** A second explorer for the same tx, for when the primary is down. */
export function explorerTxAlt(txid: string, network: TorcNetwork = NETWORK): string {
  return FALLBACK_EXPLORER[network].tx + txid;
}
export const explorerAltName = (network: TorcNetwork = NETWORK) => FALLBACK_EXPLORER[network].name;
export function explorerAddress(address: string, network: TorcNetwork = NETWORK): string {
  return DEFAULT_EXPLORER[network].address + address;
}

/**
 * Browsers read the chain through the site's own /api/chain HTTPS relay by default (no console
 * noise where port 50004 is blocked). NEXT_PUBLIC_BROWSER_WSS=1 opts back into a direct Electrum
 * WebSocket for push updates, with the relay as fallback.
 */
export const BROWSER_WSS = process.env.NEXT_PUBLIC_BROWSER_WSS === '1';

export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL || 'https://github.com/levithefirst/torc';
export const DECK_URL = process.env.NEXT_PUBLIC_DECK_URL || '/deck';
export const DONATION_ADDRESS = process.env.NEXT_PUBLIC_DONATION_ADDRESS || '';
